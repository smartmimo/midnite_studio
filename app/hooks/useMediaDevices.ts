import { useState, useEffect } from "react";

export function useMediaDevices() {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const loadDevices = async () => {
    try {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch (e3) {
            console.warn("Could not get any media stream permissions:", e3);
          }
        }
      }
      
      // Stop the tracks immediately so we don't leave the camera/mic running globally.
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  };

  useEffect(() => {
    loadDevices();
    
    const handler = () => loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handler);
  }, []);

  return { videoDevices, audioDevices, error, loadDevices };
}
