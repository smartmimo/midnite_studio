"use client";

import React, { useEffect, useRef, useState } from "react";
import { AudioManager } from "./lib/AudioManager";
import { VideoManager } from "./lib/VideoManager";
import { AudioTrack } from "./lib/AudioTrack";
import { ExportEngine } from "./lib/exportEngine";

import { DeviceSelector } from "./components/DeviceSelector";
import { TrackEditor } from "./components/TrackEditor";
import { RecorderControls } from "./components/RecorderControls";

export default function StudioPage() {
  const [audioManager] = useState(() => new AudioManager());
  const [videoManager] = useState(() => new VideoManager());
  
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "recorded">("idle");
  const [isExporting, setIsExporting] = useState(false);
  
  const [videoSrc, setVideoSrc] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

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
    const videoPromise = videoManager.stream ? videoManager.stopRecording() : Promise.resolve(null);
    const audioPromise = audioManager.stopRecordingAll();
    await Promise.all([videoPromise, audioPromise]);
    
    const finalVideoBlob = videoManager.finalBlob;
    if (finalVideoBlob && finalVideoBlob.size > 0) {
      if (videoRef.current) videoRef.current.srcObject = null;
      setVideoSrc(URL.createObjectURL(finalVideoBlob));
    }
    setRecordingState("recorded");
  };

  const handlePreview = () => {
    if (videoRef.current && videoSrc) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
    }
    audioManager.playPreview();
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
        <div className="flex-1 p-8 flex items-center justify-center relative overflow-hidden">
          <div className="w-full max-w-5xl aspect-video glass-panel rounded-3xl overflow-hidden relative shadow-2xl transition-all">
            <video 
              ref={videoRef}
              src={videoSrc || undefined}
              className="w-full h-full object-contain bg-black"
              muted // Local loopback muted
              autoPlay
              controls={false}
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
               <div className="absolute top-6 right-6 bg-red-500 text-white px-4 py-1.5 text-[10px] font-black tracking-widest rounded-full shadow-[0_0_20px_rgba(239,68,68,0.8)] flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> REC
               </div>
            )}
          </div>

          {/* Floating Controls Overlay */}
          <RecorderControls 
             recordingState={recordingState}
             isExporting={isExporting}
             onRecord={handleRecord}
             onStop={handleStop}
             onPreview={handlePreview}
             onExport={handleExport}
           />
        </div>

        {/* BOTTOM MIXER - Audio Channels */}
        <div className="h-[360px] shrink-0 bg-black/60 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 backdrop-blur-2xl flex flex-col z-10">
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
                    onUpdate={handleTrackUpdate}
                    onRemove={handleRemoveTrack}
                  />
                ))
            )}
          </div>
        </div>

      </section>
    </main>
  );
}
