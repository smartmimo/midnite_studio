import React, { useState } from "react";
import { Mic2, Trash2, Volume2, VolumeX } from "lucide-react";
import { AudioTrack } from "../lib/AudioTrack";

interface Props {
  track: AudioTrack;
  onUpdate: (track: AudioTrack) => void;
  onRemove: (id: string) => void;
}
function formatTime(seconds: number) {
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TrackEditor({ track, onUpdate, onRemove }: Props) {
  const [, setTick] = useState(0);
  const triggerUpdate = () => {
    setTick(t => t + 1);
    onUpdate(track);
  };

  const isMuted = track.isMuted;

  return (
    <div className="glass-panel w-56 shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_rgba(244,63,94,0.1)] group">
      
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
            <button 
              onClick={() => { track.isMuted = !track.isMuted; triggerUpdate(); }}
              className={`p-1.5 rounded-lg transition-colors ${
                isMuted ? 'bg-red-500/20 text-red-500' : 'text-gray-400 hover:text-white'
              }`}
            >
             {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
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
function MiniSlider({ label, value, min, max, step, onChange, format = (v: number) => v.toFixed(2) }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[10px] font-bold text-gray-400 tracking-wider">
        <span>{label}</span>
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
