"use client";

import React, { useEffect, useRef, useState } from "react";
import { AudioManager } from "./lib/AudioManager";
import { VideoManager } from "./lib/VideoManager";
import { AudioTrack } from "./lib/AudioTrack";
import { ExportEngine } from "./lib/exportEngine";

import { DeviceSelector } from "./components/DeviceSelector";
import { TrackEditor } from "./components/TrackEditor";
import { RecorderControls } from "./components/RecorderControls";
import { RecordedWaveformTrack } from "./components/RecordedWaveformTrack";
import { Play, Pause, Download, Loader2, Menu, X } from "lucide-react";

const TRACK_COLORS = [
  "#f43f5e", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ec4899", "#3b82f6", "#a3e635",
];

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Refs for 60fps playhead — bypasses React state entirely
  const playheadRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const maxDurationRef = useRef<number>(1);
  const animFrameRef = useRef<number>(0);

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
    // Assign a distinct color cycling through the palette
    newTrack.color = TRACK_COLORS[audioManager.tracks.length % TRACK_COLORS.length];
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
    const duplicate = await audioManager.duplicateWithBakedPitch(id);

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

  // Keep maxDurationRef in sync for the RAF seek calculations
  useEffect(() => {
    const recTracks = tracks.filter(t => t.audioBlob && t.duration > 0);
    maxDurationRef.current = recTracks.length > 0
      ? Math.max(...recTracks.map(t => t.duration))
      : Math.max(videoDuration || 1, 1);
  }, [tracks, videoDuration]);

  // 60fps playhead animation — reads video.currentTime directly, zero React re-renders
  useEffect(() => {
    const tick = () => {
      animFrameRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const maxDur = maxDurationRef.current;
      if (!video || maxDur <= 0) return;
      const pct = Math.min(100, (video.currentTime / maxDur) * 100);
      if (playheadRef.current) playheadRef.current.style.left = `${pct}%`;
      if (progressFillRef.current) progressFillRef.current.style.width = `${pct}%`;
      if (timeDisplayRef.current) timeDisplayRef.current.textContent = formatTime(video.currentTime);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  return (
    <main className="h-screen w-screen flex overflow-hidden text-sm relative">

      {/* LEFT SIDEBAR - The Setup */}
      <aside className={`w-80 shrink-0 bg-black/60 backdrop-blur-3xl border-r border-white/10 flex flex-col z-50 transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 absolute md:relative h-full`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter">
              Midnite<span className="text-studio-accent">Studio</span>
            </h1>
            <p className="text-gray-500 mt-1 text-xs font-medium uppercase tracking-widest">Mastering Session</p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden text-gray-500 hover:text-white p-1 bg-white/5 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          <DeviceSelector
            onVideoDeviceSelect={handleVideoDeviceSelect}
            onAddAudioTrack={handleAddAudioTrack}
          />
        </div>
      </aside>

      {/* RIGHT MAIN AREA */}
      <section className="flex-1 flex flex-col min-w-0 relative w-full">
        {/* Mobile menu toggle */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden absolute top-4 left-4 z-40 p-2 bg-black/50 hover:bg-black/80 rounded-full border border-white/10 text-white backdrop-blur-md shadow-lg transition-colors"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* TOP STAGE - Video + Waveform Panel */}
        <div className="flex-1 p-2 md:p-4 flex flex-row gap-3 items-stretch overflow-hidden min-h-0">

          {/* Square Video Preview */}
          <div className="w-56 md:w-64 shrink-0 flex flex-col gap-2">
            <div className="w-full aspect-square glass-panel rounded-2xl overflow-hidden relative shadow-2xl">
              <video
                ref={videoRef}
                src={videoSrc || undefined}
                className="w-full h-full object-cover bg-black"
                muted
                autoPlay
                controls={false}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  if (overdubbingTrackId) handleStopRecordTrack(overdubbingTrackId);
                }}
                onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  if (isFinite(e.currentTarget.duration)) setVideoDuration(e.currentTarget.duration);
                }}
              />
              {!videoRef.current?.srcObject && !videoSrc && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </div>
                  <span className="font-bold tracking-widest uppercase text-[9px] text-center">STAGE<br/>OFFLINE</span>
                </div>
              )}
              {recordingState === "recording" && (
                <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-0.5 text-[9px] font-black tracking-widest rounded-full shadow-[0_0_15px_rgba(239,68,68,0.8)] flex items-center gap-1.5 z-[100]">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div> REC
                </div>
              )}
            </div>

            {/* Recorder controls below video */}
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

          {/* Right Panel — DAW Timeline */}
          <div className="flex-1 flex flex-col gap-2 min-w-0 min-h-0 overflow-hidden">
            {recordingState === "recorded" ? (() => {
              const recordedTracks = tracks.filter(t => t.audioBlob && t.duration > 0);
              const maxDuration = recordedTracks.length > 0
                ? Math.max(...recordedTracks.map(t => t.duration))
                : (videoDuration || 1);
              const handleTimelineSeek = (e: React.MouseEvent<HTMLDivElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const newTime = ratio * maxDuration;
                if (videoRef.current) {
                  videoRef.current.currentTime = newTime;
                  setVideoCurrentTime(newTime);
                }
                if (isPlaying) {
                  audioManager.stopPreview();
                  audioManager.playPreview(newTime);
                }
              };

              const handleTimelineDrag = (e: React.MouseEvent<HTMLDivElement>) => {
                if (e.buttons !== 1) return;
                handleTimelineSeek(e);
              };

              return (
                <>
                  {/* Timeline area */}
                  <div
                    className="flex-1 overflow-y-auto custom-scrollbar relative select-none cursor-crosshair"
                    onClick={handleTimelineSeek}
                    onMouseMove={handleTimelineDrag}
                  >
                    {/* Track rows */}
                    <div className="flex flex-col gap-1.5 pb-2 relative min-h-full">
                      {recordedTracks.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-600 text-xs font-bold tracking-widest uppercase py-10">
                          No recorded tracks
                        </div>
                      ) : (
                        recordedTracks.map(track => (
                          <RecordedWaveformTrack
                            key={track.id}
                            name={track.name}
                            blob={track.audioBlob!}
                            color={track.color}
                            duration={track.duration}
                            widthPercent={maxDuration > 0 ? (track.duration / maxDuration) * 100 : 100}
                            isMuted={track.isMuted}
                          />
                        ))
                      )}
                    </div>

                    {/* Shared playhead — position driven by 60fps RAF loop via ref */}
                    {recordedTracks.length > 0 && (
                      <div
                        ref={playheadRef}
                        className="absolute top-0 bottom-2 w-[2px] pointer-events-none z-20"
                        style={{
                          left: "0%",
                          background: "rgba(255,255,255,0.9)",
                          boxShadow: "0 0 6px 2px rgba(255,255,255,0.45), 0 0 16px 4px rgba(255,255,255,0.2)",
                        }}
                      />
                    )}
                  </div>

                  {/* Compact footer: play/pause · time · export */}
                  <div className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/5 flex items-center gap-3 shadow-xl shrink-0">
                    <button
                      onClick={handleTogglePlay}
                      className="flex items-center justify-center w-7 h-7 bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-400 border border-white/10 hover:border-green-500/50 rounded-full transition-all shrink-0"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>

                    <span ref={timeDisplayRef} className="text-white/60 text-[10px] font-mono tracking-widest">
                      {formatTime(videoCurrentTime)}
                    </span>
                    <span className="text-white/20 text-[10px]">/</span>
                    <span className="text-white/40 text-[10px] font-mono tracking-widest">
                      {formatTime(maxDuration)}
                    </span>

                    {/* mini progress bar — width driven by 60fps RAF loop via ref */}
                    <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        ref={progressFillRef}
                        className="h-full bg-white/40 rounded-full"
                        style={{ width: "0%" }}
                      />
                    </div>

                    <button
                      onClick={handleExport}
                      disabled={isExporting}
                      className="flex items-center justify-center w-7 h-7 bg-studio-accent text-white hover:bg-studio-accent-hover rounded-full transition-all shadow-[0_0_10px_rgba(244,63,94,0.4)] disabled:opacity-50 shrink-0"
                    >
                      {isExporting ? <Loader2 className="h-3.5 animate-spin" /> : <Download className="h-3.5" />}
                    </button>
                  </div>
                </>
              );
            })() : (
              /* Pre-recording placeholder */
              <div className="flex-1 glass-panel rounded-2xl flex flex-col items-center justify-center text-gray-600 gap-3 border-dashed">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
                </div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-center">
                  Recorded waveforms<br/>will appear here
                </p>
              </div>
            )}
          </div>


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
