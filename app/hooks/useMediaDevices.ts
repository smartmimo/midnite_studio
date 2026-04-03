import { useState, useEffect } from "react";

export function useMediaDevices() {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }
    loadDevices();
    
    const handler = () => loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, []);

  return { videoDevices, audioDevices, error };
}
