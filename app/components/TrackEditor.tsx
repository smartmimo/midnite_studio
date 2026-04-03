import React, { useState } from "react";
import { Mic2, Trash2, Volume2, VolumeX, ListFilter } from "lucide-react";
import { AudioTrack } from "../lib/AudioTrack";

interface Props {
  track: AudioTrack;
  onUpdate: (track: AudioTrack) => void;
  onRemove: (id: string) => void;
}

export function TrackEditor({ track, onUpdate, onRemove }: Props) {
  const [, setTick] = useState(0);
  const triggerUpdate = () => {
    setTick(t => t + 1);
    onUpdate(track);
  };

  const isMuted = track.isMuted;

  return (
    <div className="glass-panel w-48 shrink-0 flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:shadow-[0_0_30px_rgba(244,63,94,0.1)] group">
      
      {/* Strip Header */}
      <div className="bg-black/50 p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Mic2 className="w-4 h-4 text-studio-accent shrink-0" />
          <h3 className="font-semibold text-sm truncate" title={track.name}>
            {track.name}
          </h3>
        </div>
        <button 
          onClick={() => onRemove(track.id)}
          className="text-gray-500 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* FX Section (Stacked small dials) */}
      <div className="flex flex-col gap-4 p-4 border-b border-white/5 flex-1 overflow-y-auto custom-scrollbar">
        <MiniSlider label="BASS" value={track.bass} min={-20} max={20} step={1} onChange={(v: number) => { track.bass = v; triggerUpdate(); }} />
        <MiniSlider label="TREBLE" value={track.treble} min={-20} max={20} step={1} onChange={(v: number) => { track.treble = v; triggerUpdate(); }} />
        <hr className="border-white/5 my-1" />
        <MiniSlider label="ECHO TME" value={track.delayTime} min={0} max={1} step={0.05} onChange={(v: number) => { track.delayTime = v; triggerUpdate(); }} />
        <MiniSlider label="ECHO FB" value={track.feedback} min={0} max={0.8} step={0.05} onChange={(v: number) => { track.feedback = v; triggerUpdate(); }} />
        <MiniSlider label="ECHO MIX" value={track.echoMix} min={0} max={1} step={0.05} onChange={(v: number) => { track.echoMix = v; triggerUpdate(); }} />
        <hr className="border-white/5 my-1" />
        <MiniSlider label="REVERB" value={track.reverbMix} min={0} max={1} step={0.05} onChange={(v: number) => { track.reverbMix = v; triggerUpdate(); }} />
      </div>

      {/* Main Fader Section */}
      <div className="p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-4">
        
        <button 
          onClick={() => { track.isMuted = !track.isMuted; triggerUpdate(); }}
          className={`w-full py-2 rounded-lg font-bold text-xs tracking-widest transition-all ${
            isMuted 
              ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {isMuted ? 'MUTED' : 'MUTE'}
        </button>

        {/* Vertical Fader wrapper */}
        <div className="relative h-48 w-full flex justify-center items-center group-hover:scale-105 transition-transform">
          <input 
            type="range"
            min={0} max={2} step={0.05}
            value={track.volume}
            onChange={(e) => { track.volume = parseFloat(e.target.value); triggerUpdate(); }}
            className="fader absolute w-[192px] h-[10px]"
            style={{ 
               transform: 'rotate(-90deg)',
               transformOrigin: 'center'
            }}
          />
        </div>
        
        <div className="flex flex-col items-center gap-1 text-center">
            <Volume2 className={`w-4 h-4 ${isMuted ? 'text-gray-600' : 'text-white'}`} />
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
              {(track.volume * 100).toFixed(0)}%
            </span>
        </div>
      </div>
      
    </div>
  );
}

// Mini horizontal slider for FX
function MiniSlider({ label, value, min, max, step, onChange }: any) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] font-bold text-gray-400 tracking-wider">
        <span>{label}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mini-fx-slider"
      />
    </div>
  );
}
