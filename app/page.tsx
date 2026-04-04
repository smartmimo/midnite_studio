"use client";

import React, { useEffect, useRef, useState } from "react";
import { AudioManager } from "./lib/AudioManager";
import { VideoManager } from "./lib/VideoManager";
import { AudioTrack } from "./lib/AudioTrack";
import { ExportEngine } from "./lib/exportEngine";

import { DeviceSelector } from "./components/DeviceSelector";
import { TrackEditor } from "./components/TrackEditor";
import { RecorderControls } from "./components/RecorderControls";
import { Play, Pause, Download, Loader2 } from "lucide-react";

function formatTime(seconds: number) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds)) return "0:00.000";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export default function StudioPage() {
  const [audioManager] = useState(() => new AudioManager());
  const [videoManager] = useState(() => new VideoManager());

  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "recorded">("idle");
  const [isExporting, setIsExporting] = useState(false);

  const [videoSrc, setVideoSrc] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [overdubbingTrackId, setOverdubbingTrackId] = useState<string | null>(null);

  const handleVideoDeviceSelect = async (deviceId: string) => {
    try {
      const stream = await videoManager.requestDevice(deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (e) {
      console.error(e);
      alert("Failed to access camera");
    }
  };

  const handleAddAudioTrack = async (deviceId: string, name: string) => {
    const newTrack = new AudioTrack();
    newTrack.name = name;
    try {
      await newTrack.requestDevice(deviceId);
      audioManager.addTrack(newTrack);
      setTracks([...audioManager.tracks]);
    } catch (e) {
      console.error(e);
      alert("Failed to access microphone");
    }
  };

  const handleRemoveTrack = (id: string) => {
    audioManager.removeTrack(id);
    setTracks([...audioManager.tracks]);
  };

  const handleTrackUpdate = (track: AudioTrack) => {
    audioManager.updateLiveNodes(track);
    setTracks([...audioManager.tracks]);
  };

  const handleRecordTrack = (id: string) => {
    if (videoRef.current && videoSrc) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
    audioManager.playPreview(0);
    setIsPlaying(true);

    const track = audioManager.tracks.find(t => t.id === id);
    if (track) track.startRecording();
    
    setOverdubbingTrackId(id);
  };

  const handleStopRecordTrack = async (id: string) => {
    if (videoRef.current) videoRef.current.pause();
    audioManager.stopPreview();
    setIsPlaying(false);

    const track = audioManager.tracks.find(t => t.id === id);
    if (track) {
      await track.stopRecording();
    }

    setOverdubbingTrackId(null);
    setTracks([...audioManager.tracks]);
  };

  const handleDuplicateTrack = async (id: string, newPitch: number) => {
    const original = audioManager.tracks.find(t => t.id === id);
    if (!original) return;
    
    // Natively bake the pitch into the duplicate's raw audio buffer
    const duplicate = await audioManager.duplicateWithBakedPitch(id, newPitch);
    
    if (!duplicate) {
       // fallback if no recording present
       const clone = original.clone();
       const baseName = original.name.replace(/^\[[+-]?\d+\]\s*/, '');
       const pitchPrefix = newPitch === 0 ? '' : `[${newPitch > 0 ? '+' + newPitch : newPitch}] `;
       clone.name = `${pitchPrefix}${baseName}`;
       audioManager.addTrack(clone);
       setTracks([...audioManager.tracks]);
       return;
    }

    const baseName = original.name.replace(/^\[[+-]?\d+\]\s*/, '');
    const pitchPrefix = newPitch === 0 ? '' : `[${newPitch > 0 ? '+' + newPitch : newPitch}] `;
    duplicate.name = `${pitchPrefix}${baseName}`;
    
    audioManager.addTrack(duplicate);
    setTracks([...audioManager.tracks]);
  };

  const handleRecord = () => {
    if (audioManager.tracks.length === 0 && !videoManager.stream) {
      return alert("Please select at least one camera or microphone!");
    }
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc);
      setVideoSrc("");
    }
    if (videoRef.current && videoManager.stream && !videoRef.current.srcObject) {
      videoRef.current.srcObject = videoManager.stream;
      videoRef.current.play();
    }
    if (videoManager.stream) videoManager.startRecording();
    audioManager.startRecordingAll();
    setRecordingState("recording");
  };



  const handleStop = async () => {
    setRecordingState("idle");

    if (overdubbingTrackId) {
      if (videoRef.current) videoRef.current.pause();
      audioManager.stopPreview();
      setIsPlaying(false);
    }

    const videoPromise = videoManager.stream ? videoManager.stopRecording() : Promise.resolve(null);
    const audioPromise = audioManager.stopRecordingAll();
    await Promise.all([videoPromise, audioPromise]);

    const finalVideoBlob = videoManager.finalBlob;
    if (finalVideoBlob && finalVideoBlob.size > 0 && !overdubbingTrackId) {
      if (videoRef.current) videoRef.current.srcObject = null;
      setVideoSrc(URL.createObjectURL(finalVideoBlob));
      if (videoManager.duration) {
        setVideoDuration(videoManager.duration);
      }
    }
    
    setOverdubbingTrackId(null);
    setRecordingState("recorded");
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      if (videoRef.current) videoRef.current.pause();
      audioManager.stopPreview();
      setIsPlaying(false);
    } else {
      if (videoRef.current && videoSrc) {
        if (Math.abs(videoRef.current.currentTime - videoDuration) < 0.1 || videoRef.current.ended) {
          videoRef.current.currentTime = 0;
        }
        videoRef.current.play();
      }
      audioManager.playPreview(videoRef.current?.currentTime || 0);
      setIsPlaying(true);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      let finalAudioBlob: Blob | null = null;
      if (audioManager.tracks.length > 0) {
        finalAudioBlob = await audioManager.exportMixedAudio();
      }
      const videoBlob = videoManager.finalBlob;

      if (!videoBlob || videoBlob.size === 0) {
        if (finalAudioBlob) {
          const url = URL.createObjectURL(finalAudioBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "midnite-studio-audio.wav";
          a.click();
        }
      } else {
        if (!finalAudioBlob) {
          const url = URL.createObjectURL(videoBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "midnite-studio-video.webm";
          a.click();
        } else {
          const engine = new ExportEngine();
          const resultBlob = await engine.muxAudioVideo(videoBlob, finalAudioBlob);
          const url = URL.createObjectURL(resultBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "midnite-output.mp4";
          a.click();
        }
      }
    } catch (e) {
      console.error(e);
      alert("Error exporting video");
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    return () => {
      audioManager.stopPreview();
      audioManager.tracks.forEach(t => t.disconnectDevice());
      videoManager.disconnect();
    };
  }, [audioManager, videoManager]);

  return (
    <main className="h-screen w-screen flex overflow-hidden text-sm">

      {/* LEFT SIDEBAR - The Setup */}
      <aside className="w-80 shrink-0 bg-black/60 backdrop-blur-3xl border-r border-white/10 flex flex-col relative z-20">
        <div className="p-6 border-b border-white/5">
          <h1 className="text-2xl font-black tracking-tighter">
            Midnite<span className="text-studio-accent">Studio</span>
          </h1>
          <p className="text-gray-500 mt-1 text-xs font-medium uppercase tracking-widest">Mastering Session</p>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <DeviceSelector
            onVideoDeviceSelect={handleVideoDeviceSelect}
            onAddAudioTrack={handleAddAudioTrack}
          />
        </div>
      </aside>

      {/* RIGHT MAIN AREA */}
      <section className="flex-1 flex flex-col min-w-0 relative">

        {/* TOP STAGE - Video Preview */}
        <div className="flex-1 p-2 flex flex-col gap-2 items-center justify-center relative overflow-hidden">
          <div className="w-full max-w-5xl aspect-video glass-panel rounded-3xl overflow-hidden relative shadow-2xl transition-all shrink">
            <video
              ref={videoRef}
              src={videoSrc || undefined}
              className="w-full h-full object-contain bg-black"
              muted // Local loopback muted
              autoPlay
              controls={false}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                setIsPlaying(false);
                if (overdubbingTrackId) {
                  handleStopRecordTrack(overdubbingTrackId);
                }
              }}
              onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => {
                if (isFinite(e.currentTarget.duration)) {
                  setVideoDuration(e.currentTarget.duration);
                }
              }}
            />
            {!videoRef.current?.srcObject && !videoSrc && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <span className="font-bold tracking-widest uppercase text-xs">STAGE OFFLINE</span>
              </div>
            )}
            {recordingState === "recording" && (
              <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 text-[10px] font-black tracking-widest rounded-full shadow-[0_0_20px_rgba(239,68,68,0.8)] flex items-center gap-2 z-[100]">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div> REC
              </div>
            )}



            {recordingState !== "recorded" && (
              <RecorderControls
                recordingState={recordingState}
                isExporting={isExporting}
                isPlaying={isPlaying}
                onRecord={handleRecord}
                onStop={handleStop}
                onTogglePlay={handleTogglePlay}
                onExport={handleExport}
              />
            )}
          </div>

          {recordingState === "recorded" && videoSrc && (
            <div className="w-[80%] max-w-md bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/5 flex items-center gap-3 shadow-2xl shrink-0 z-10 transition-all">
              <button
                onClick={handleTogglePlay}
                className="flex items-center justify-center w-6 h-6 bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-400 border border-white/10 hover:border-green-500/50 rounded-full transition-all shrink-0 p-0"
              >
                {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
              </button>

              <span className="text-white/60 text-[10px] font-mono tracking-widest w-16 text-right shrink-0">{formatTime(videoCurrentTime)}</span>
              <input
                type="range"
                min={0}
                max={videoDuration || 1}
                step={0.01}
                value={videoCurrentTime}
                onChange={(e) => {
                  if (videoRef.current) {
                    const val = parseFloat(e.target.value);
                    videoRef.current.currentTime = val;
                    setVideoCurrentTime(val);
                  }
                }}
                className="flex-1 accent-studio-accent h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:border-white active:[&::-webkit-slider-thumb]:border-[4px] active:[&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full transition-all"
              />
              <span className="text-white/60 text-[10px] font-mono tracking-widest w-20 shrink-0">{formatTime(videoDuration)}</span>

              <button
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center justify-center w-6 h-6 bg-studio-accent text-white hover:bg-studio-accent-hover rounded-full transition-all shadow-[0_0_10px_rgba(244,63,94,0.4)] disabled:opacity-50 shrink-0"
              >
                {isExporting ? <Loader2 className=" h-3 animate-spin" /> : <Download className=" h-3" />}
              </button>
            </div>
          )}

        </div>

        {/* BOTTOM MIXER - Audio Channels */}
        <div className="h-[420px] shrink-0 bg-black/60 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 backdrop-blur-2xl flex flex-col z-10">
          <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">Input Audio Console</h2>
            <span className="text-[10px] text-gray-600 font-bold tracking-widest">{tracks.length} ACTIVE CHANNELS</span>
          </div>

          <div className="flex-1 flex items-stretch gap-4 p-6 overflow-x-auto overflow-y-hidden custom-scrollbar">
            {tracks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/10 rounded-2xl text-gray-500/50 font-bold uppercase tracking-widest text-lg">
                Add a channel to begin mixing
              </div>
            ) : (
              tracks.map(track => (
                <TrackEditor
                  key={track.id}
                  track={track}
                  canOverdub={recordingState === "recorded"}
                  isOverdubbing={overdubbingTrackId === track.id}
                  onUpdate={handleTrackUpdate}
                  onRemove={handleRemoveTrack}
                  onRecordTrack={handleRecordTrack}
                  onStopRecordTrack={handleStopRecordTrack}
                  onDuplicateTrack={handleDuplicateTrack}
                />
              ))
            )}
          </div>
        </div>

      </section>
    </main>
  );
}
