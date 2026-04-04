import React from "react";
import { Circle, Square, Play, Pause, Download, Loader2 } from "lucide-react";

type RecordingState = "idle" | "recording" | "recorded";

interface Props {
  recordingState: RecordingState;
  isExporting: boolean;
  isPlaying?: boolean;
  onRecord: () => void;
  onStop: () => void;
  onTogglePlay: () => void;
  onExport: () => void;
}

export function RecorderControls({ recordingState, isExporting, isPlaying, onRecord, onStop, onTogglePlay, onExport }: Props) {
  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-3xl border border-white/10 px-4 py-2 flex items-center justify-center gap-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-[100] rounded-full">

      {recordingState !== "recording" ? (
        <button
          onClick={onRecord}
          className="flex items-center justify-center w-10 h-10 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/50 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
          title="Start Recording"
        >
          <Circle className="w-4 h-4 fill-current" />
        </button>
      ) : (
        <button
          onClick={onStop}
          className="flex items-center justify-center w-10 h-10 bg-white/10 text-white hover:bg-white border border-white/30 hover:text-black rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(255,255,255,0.2)]"
          title="Stop Recording"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      )}

      <div className={`flex items-center gap-3 transition-all duration-500 overflow-hidden ${recordingState === 'recorded' ? 'w-[100px] opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        {recordingState === "recorded" && (
          <>
            <button
              onClick={onTogglePlay}
              className="flex items-center justify-center w-9 h-9 bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-400 border border-white/10 hover:border-green-500/50 rounded-full transition-all shrink-0"
              title={isPlaying ? "Pause Mix" : "Preview Mix"}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              onClick={onExport}
              disabled={isExporting}
              className="flex items-center justify-center w-9 h-9 bg-studio-accent text-white hover:bg-studio-accent-hover rounded-full transition-all shadow-[0_0_10px_rgba(244,63,94,0.4)] disabled:opacity-50 shrink-0"
              title="Export Final MP4"
            >
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            </button>
          </>
        )}
      </div>

    </div>
  );
}
