"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic2 } from "lucide-react";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Props {
  name: string;
  blob: Blob;
  color: string;
  duration?: number;
  /** Width as a percentage of the timeline container (0–100) */
  widthPercent?: number;
  isMuted?: boolean;
  preDecodedBuffer?: AudioBuffer | null;
  startTimeOffset?: number;
  maxDuration?: number;
  onOffsetChange?: (newOffset: number) => void;
}

export function RecordedWaveformTrack({ name, blob, color, duration, widthPercent = 100, isMuted = false, preDecodedBuffer, startTimeOffset = 0, maxDuration = 1, onOffsetChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [decoded, setDecoded] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [initialOffset, setInitialOffset] = useState(0);
  const [localOffset, setLocalOffset] = useState(startTimeOffset);

  // Sync prop changes
  useEffect(() => {
    if (!isDragging) {
      setLocalOffset(startTimeOffset);
    }
  }, [startTimeOffset, isDragging]);

  useEffect(() => {
    if (!blob || blob.size === 0) return;
    let cancelled = false;

    const renderWaveform = (audioBuffer: AudioBuffer) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const W = canvas.offsetWidth || 400;
      const H = canvas.offsetHeight || 80;
      canvas.width = W;
      canvas.height = H;

      const rawData = audioBuffer.getChannelData(0);
      const step = Math.ceil(rawData.length / W);
      const ctx2d = canvas.getContext("2d", { alpha: false });
      if (!ctx2d) return;

      // Background
      ctx2d.fillStyle = "#0c0c0c"; // use solid bg for perf
      ctx2d.fillRect(0, 0, W, H);

      // Waveform bars
      ctx2d.fillStyle = hexToRgba(color, 1.0);
      ctx2d.shadowColor = color;
      ctx2d.shadowBlur = 4;

      for (let i = 0; i < W; i++) {
        let min = 1.0, max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = rawData[i * step + j] ?? 0;
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        const barH = Math.max(1, (max - min) * H * 0.9);
        const y = H / 2 - barH / 2;
        ctx2d.fillRect(i, y, 1, barH);
      }
      setDecoded(true);
    };

    if (preDecodedBuffer) {
      renderWaveform(preDecodedBuffer);
      return;
    }

    blob.arrayBuffer().then((buf) => {
      if (cancelled) return;
      const offlineCtx = new OfflineAudioContext(1, 44100 * (duration || 1), 44100);
      return offlineCtx.decodeAudioData(buf).then((audioBuffer) => {
        renderWaveform(audioBuffer);
      });
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [blob, color, duration]);

  const formattedDuration = duration
    ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`
    : null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsDragging(true);
    setStartX(e.clientX);
    setInitialOffset(localOffset);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    const deltaX = e.clientX - startX;
    const parentWidth = e.currentTarget.parentElement?.offsetWidth || 1;
    const timeDelta = (deltaX / parentWidth) * maxDuration;
    setLocalOffset(initialOffset + timeDelta);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.stopPropagation();
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (onOffsetChange) onOffsetChange(localOffset);
  };

  return (
    <div
      className={`flex flex-col rounded-xl overflow-hidden shrink-0 border transition-all duration-300 ${isDragging ? "cursor-grabbing shadow-2xl z-50 scale-[1.01]" : "cursor-grab"}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: `${widthPercent}%`,
        marginLeft: `${(localOffset / maxDuration) * 100}%`,
        borderColor: hexToRgba(color, isMuted ? 0.1 : 0.25),
        background: hexToRgba(color, isMuted ? 0.02 : 0.04),
        opacity: isMuted ? 0.35 : 1,
        filter: isMuted ? "grayscale(0.85)" : "none",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b"
        style={{ borderColor: hexToRgba(color, 0.15) }}
      >
        <Mic2
          className="w-3 h-3 shrink-0"
          style={{ color: hexToRgba(color, 0.9) }}
        />
        <span
          className="text-[10px] font-bold tracking-widest uppercase truncate"
          style={{ color: hexToRgba(color, 0.85) }}
        >
          {name}
        </span>
        {formattedDuration && (
          <span className="text-[9px] font-mono text-gray-600 ml-auto shrink-0">
            {formattedDuration}
          </span>
        )}
        {!decoded && (
          <span className="text-[9px] text-gray-600 ml-1 shrink-0">decoding…</span>
        )}
      </div>

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "72px", display: "block" }}
      />
    </div>
  );
}
