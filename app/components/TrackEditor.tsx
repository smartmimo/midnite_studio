import React, { useState } from "react";
import { Mic2, Trash2, Volume2, VolumeX, Circle, Square } from "lucide-react";
import { AudioTrack } from "../lib/AudioTrack";
import { MicWaveform } from "./MicWaveform";

interface Props {
  track: AudioTrack;
  canOverdub: boolean;
  isOverdubbing?: boolean;
  onUpdate: (track: AudioTrack) => void;
  onRemove: (id: string) => void;
  onRecordTrack: (id: string) => void;
  onStopRecordTrack?: (id: string) => void;
  onDuplicateTrack?: (id: string, newPitch: number) => void;
  sharedAudioCtx?: AudioContext | null;
}
function formatTime(seconds: number) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TrackEditor({ track, canOverdub, isOverdubbing, onUpdate, onRemove, onRecordTrack, onStopRecordTrack, onDuplicateTrack, sharedAudioCtx }: Props) {
  const [, setTick] = useState(0);
  const triggerUpdate = () => {
    setTick(t => t + 1);
    onUpdate(track);
  };

  const isMuted = track.isMuted;

  return (
    <div className="glass-panel w-56 shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_rgba(244,63,94,0.1)] group">
      
      {/* Live Waveform */}
      <MicWaveform stream={track.stream} color={track.color} height={64} sharedAudioCtx={sharedAudioCtx} />

      {/* Strip Header */}
      <div className="bg-black/50 p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Mic2 className="w-4 h-4 text-studio-accent shrink-0" />
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm truncate w-24" title={track.name}>
              {track.name}
            </h3>
            {track.duration > 0 && (
              <span className="text-[10px] text-gray-500 font-mono tracking-wider">
                {formatTime(track.duration)}
              </span>
            )}
          </div>
        </div>
          <div className="flex items-center gap-2">
            {isOverdubbing ? (
              <button 
                onClick={() => onStopRecordTrack?.(track.id)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/20 transition-colors animate-pulse"
                title="Stop Overdubbing"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : canOverdub && track.duration === 0 ? (
              <button 
                onClick={() => onRecordTrack(track.id)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/20 transition-colors"
                title="Overdub this track"
              >
                <Circle className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button 
                onClick={() => { track.isMuted = !track.isMuted; triggerUpdate(); }}
                className={`p-1.5 rounded-lg transition-colors ${
                  isMuted ? 'bg-red-500/20 text-red-500' : 'text-gray-400 hover:text-white'
                }`}
              >
               {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <button 
              onClick={() => onRemove(track.id)}
              className="text-gray-500 hover:text-red-500 transition-colors p-1.5"
            >
              <Trash2 className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* FX Section */}
      <div className="flex flex-col gap-4 p-5 flex-1 overflow-y-auto custom-scrollbar">
        <MiniSlider 
           label="PITCH" value={track.pitch} min={-12} max={12} step={1} 
           format={(v: number) => {
             if (v === 0) return "ORIG";
             return v > 0 ? `+${Math.round(v)}` : Math.round(v).toString();
           }}
           onChange={(v: number) => { track.pitch = v; triggerUpdate(); }} 
           actionNode={
             track.pitch !== 0 && onDuplicateTrack && (
                <button 
                   onClick={() => onDuplicateTrack(track.id, track.pitch)}
                   className="text-[8px] px-1.5 py-0.5 rounded bg-studio-accent/20 text-studio-accent font-bold hover:bg-studio-accent hover:text-white transition-colors border border-studio-accent/30"
                   title="Duplicate track with this pitch"
                >
                   DUP
                </button>
             )
           }
        />
        <MiniSlider 
           label="VOLUME" value={track.volume} min={0} max={2} step={0.05} 
           format={(v: number) => `${Math.round(v * 100)}%`}
           onChange={(v: number) => { track.volume = v; triggerUpdate(); }} 
        />
        <hr className="border-white/5 my-1" />
        <MiniSlider label="BASS" value={track.bass} min={-20} max={20} step={1} onChange={(v: number) => { track.bass = v; triggerUpdate(); }} />
        <MiniSlider label="TREBLE" value={track.treble} min={-20} max={20} step={1} onChange={(v: number) => { track.treble = v; triggerUpdate(); }} />
        <MiniSlider label="REVERB" value={track.reverbMix} min={0} max={1} step={0.05} onChange={(v: number) => { track.reverbMix = v; triggerUpdate(); }} />
        <hr className="border-white/5 my-1" />
        <MiniSlider label="ECHO TME" value={track.delayTime} min={0} max={1} step={0.05} onChange={(v: number) => { track.delayTime = v; triggerUpdate(); }} />
        <MiniSlider label="ECHO FB" value={track.feedback} min={0} max={0.8} step={0.05} onChange={(v: number) => { track.feedback = v; triggerUpdate(); }} />
        <MiniSlider label="ECHO MIX" value={track.echoMix} min={0} max={1} step={0.05} onChange={(v: number) => { track.echoMix = v; triggerUpdate(); }} />
      </div>
      
    </div>
  );
}

// Mini horizontal slider for FX
function MiniSlider({ label, value, min, max, step, onChange, format = (v: number) => v.toFixed(2), actionNode }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 tracking-wider">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {actionNode}
        </div>
        <span className="text-white/80">{format(value)}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}
