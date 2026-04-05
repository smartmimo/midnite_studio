import React from "react";
import { Circle, Square, Play, Pause, Download, Loader2 } from "lucide-react";

type RecordingState = "idle" | "recording" | "recorded";

interface Props {
  recordingState: RecordingState;
  isExporting: boolean;
  isPlaying?: boolean;
  canRecord?: boolean;
  onRecord: () => void;
  onStop: () => void;
  onTogglePlay: () => void;
  onExport: () => void;
}

export function RecorderControls({
  recordingState,
  isExporting,
  isPlaying,
  canRecord = true,
  onRecord,
  onStop,
  onTogglePlay,
  onExport
}: Props) {
  return (
    <div className="flex items-center gap-3">
      {recordingState !== "recording" ? (
        <button
          onClick={onRecord}
          disabled={!canRecord || recordingState === "recording"}
          className={`
            flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-300
            ${!canRecord 
              ? "bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed" 
              : "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] shadow-lg"
            }
          `}
        >
          <Circle className={`w-3.5 h-3.5 ${canRecord ? "fill-current" : ""}`} />
          <span>Start Session</span>
        </button>
      ) : (
        <button
          onClick={onStop}
          className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-bold text-xs tracking-widest uppercase hover:bg-gray-200 transition-all duration-300 shadow-xl"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop Session</span>
        </button>
      )}

      {recordingState === "recorded" && (
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
          <div className="w-px h-6 bg-white/10 mx-1" />
          
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-green-500/20 text-gray-300 hover:text-green-400 border border-white/10 hover:border-green-500/50 rounded-xl font-bold text-xs tracking-widest uppercase transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                <span>Preview</span>
              </>
            )}
          </button>

          <button
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-studio-accent text-white hover:bg-studio-accent-hover rounded-xl font-bold text-xs tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Export Session</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
