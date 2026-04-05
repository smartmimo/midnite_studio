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
}

export function MicWaveform({ stream, color, height = 64 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    // Clean up previous
    cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    ctxRef.current?.close().catch(() => {});

    if (!stream || stream.getAudioTracks().length === 0) {
      // Draw flat line
      const draw = () => {
        const W = canvas.offsetWidth;
        const H = canvas.offsetHeight;
        canvas.width = W || 224;
        canvas.height = H || height;
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.fillStyle = hexToRgba(color, 0.06);
        ctx2d.fillRect(0, 0, canvas.width, canvas.height);
        ctx2d.beginPath();
        ctx2d.moveTo(0, canvas.height / 2);
        ctx2d.lineTo(canvas.width, canvas.height / 2);
        ctx2d.strokeStyle = hexToRgba(color, 0.25);
        ctx2d.lineWidth = 1.5;
        ctx2d.stroke();
      };
      draw();
      return;
    }

    const audioCtx = new AudioContext();
    ctxRef.current = audioCtx;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = audioCtx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const waveColor = hexToRgba(color, 1.0);
    const bgColor = hexToRgba(color, 0.06);

    const drawFrame = () => {
      rafRef.current = requestAnimationFrame(drawFrame);

      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (W > 0 && (canvas.width !== W || canvas.height !== H)) {
        canvas.width = W;
        canvas.height = H;
      }

      analyser.getByteTimeDomainData(dataArray);

      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
      ctx2d.fillStyle = bgColor;
      ctx2d.fillRect(0, 0, canvas.width, canvas.height);

      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = waveColor;
      ctx2d.shadowColor = waveColor;
      ctx2d.shadowBlur = 6;
      ctx2d.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0; // 0..2
        const y = (v / 2) * canvas.height;

        if (i === 0) {
          ctx2d.moveTo(x, y);
        } else {
          ctx2d.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx2d.lineTo(canvas.width, canvas.height / 2);
      ctx2d.stroke();
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      analyser.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream, color, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: `${height}px`, display: "block" }}
      className="rounded-t-2xl"
    />
  );
}
