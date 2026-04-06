"use client";

import React, { useEffect, useRef } from "react";

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface Props {
  stream: MediaStream | null;
  color: string;
  height?: number;
  /** Pass a shared AudioContext to avoid hitting browser limits (max 6-50) */
  sharedAudioCtx?: AudioContext | null;
}

// Internal singleton to ensure we never have more than one context for visualizations if no shared one is provided
let internalSharedCtx: AudioContext | null = null;
function getSharedCtx() {
  if (!internalSharedCtx || internalSharedCtx.state === "closed") {
    internalSharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return internalSharedCtx;
}

export function MicWaveform({ stream, color, height = 64, sharedAudioCtx }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dbDisplayRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d", { alpha: false });
    if (!ctx2d) return;

    // Clean up previous nodes
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();

    if (!stream || stream.getAudioTracks().length === 0) {
      // Draw flat line
      const draw = () => {
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        if (W > 0 && (canvas.width !== W || canvas.height !== H)) {
          canvas.width = W;
          canvas.height = H;
        }
        ctx2d.fillStyle = "#0c0c0c"; // match studio bg
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
        ctx2d.beginPath();
        ctx2d.moveTo(0, canvas.height / 2);
        ctx2d.lineTo(canvas.width, canvas.height / 2);
        ctx2d.strokeStyle = hexToRgba(color, 0.25);
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();

        if (dbDisplayRef.current) {
          dbDisplayRef.current.textContent = "-100 dB";
        }
      };
      draw();
      return;
    }

    // Use shared context or singleton
    const audioCtx = sharedAudioCtx || getSharedCtx();

    // Ensure it's running (browsers suspend contexts until a user gesture)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => { });
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256; // Minimum for performance
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const floatArray = new Float32Array(bufferLength);

    const waveColor = hexToRgba(color, 1.0);
    const bgColor = "#0c0c0c";

    const drawFrame = () => {
      rafRef.current = requestAnimationFrame(drawFrame);

      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W > 0 && (canvas.width !== W || canvas.height !== H)) {
        canvas.width = W;
        canvas.height = H;
      }

      analyser.getByteTimeDomainData(dataArray);
      analyser.getFloatTimeDomainData(floatArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += floatArray[i] * floatArray[i];
      }
      const rms = Math.sqrt(sum / bufferLength);
      let db = 20 * Math.log10(rms);
      if (!isFinite(db) || db < -100) db = -100;

      if (dbDisplayRef.current) {
        dbDisplayRef.current.textContent = `${Math.round(db)} dB`;
      }

      ctx2d.fillStyle = bgColor;
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);

      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = waveColor;
      ctx2d.shadowColor = waveColor;
      ctx2d.shadowBlur = 4;
      ctx2d.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v / 2) * canvas.height;
        if (i === 0) ctx2d.moveTo(x, y);
        else ctx2d.lineTo(x, y);
        x += sliceWidth;
      }

      ctx2d.lineTo(canvas.width, canvas.height / 2);
      ctx2d.stroke();
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [stream, color, height, sharedAudioCtx]);

  return (
    <div className="flex items-center justify-between gap-2">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: `${height}px`, display: "block" }}
        className="rounded-t-2xl flex-1"
      />
      <span ref={dbDisplayRef} className="text-[10px] font-mono text-gray-500 w-11 text-right tracking-tighter">
        -100 dB
      </span>
    </div>
  );
}
