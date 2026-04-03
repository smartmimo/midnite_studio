import React from "react";
import { Circle, Square, Play, Download, Loader2 } from "lucide-react";

type RecordingState = "idle" | "recording" | "recorded";

interface Props {
  recordingState: RecordingState;
  isExporting: boolean;
  onRecord: () => void;
  onStop: () => void;
  onPreview: () => void;
  onExport: () => void;
}

export function RecorderControls({ recordingState, isExporting, onRecord, onStop, onPreview, onExport }: Props) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-panel px-6 py-4 rounded-full flex items-center justify-center gap-6 shadow-2xl z-50 animate-in slide-in-from-bottom-10 fade-in duration-500">
      
      {recordingState !== "recording" ? (
        <button 
          onClick={onRecord}
          className="flex items-center justify-center w-14 h-14 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white hover:scale-110 border border-red-500/50 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.8)]"
          title="Start Recording"
        >
          <Circle className="w-6 h-6 fill-current" />
        </button>
      ) : (
        <button 
          onClick={onStop}
          className="flex items-center justify-center w-14 h-14 bg-white/10 text-white hover:bg-white border border-white/30 hover:text-black rounded-full font-bold transition-all hover:scale-110 animate-pulse"
          title="Stop Recording"
        >
          <Square className="w-6 h-6 fill-current" />
        </button>
      )}

      <div className={`flex items-center gap-4 transition-all duration-500 overflow-hidden ${recordingState === 'recorded' ? 'w-[200px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        {recordingState === "recorded" && (
          <>
            <button 
              onClick={onPreview}
              className="flex items-center justify-center w-12 h-12 bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-400 border border-white/10 hover:border-green-500/50 rounded-full transition-all hover:scale-105"
              title="Preview Mix"
            >
              <Play className="w-5 h-5 fill-current ml-1" />
            </button>
            
            <button 
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center justify-center w-12 h-12 bg-studio-accent text-white hover:bg-studio-accent-hover rounded-full transition-all hover:scale-105 disabled:opacity-50 disabled:grayscale shadow-[0_0_15px_rgba(244,63,94,0.4)]"
              title="Export Final MP4"
            >
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </button>
          </>
        )}
      </div>

    </div>
  );
}
