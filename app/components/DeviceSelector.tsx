import React, { useState } from "react";
import { Camera, Mic, Plus, RefreshCw } from "lucide-react";
import { useMediaDevices } from "../hooks/useMediaDevices";

interface Props {
  onVideoDeviceSelect: (deviceId: string) => void;
  onAddAudioTrack: (deviceId: string, name: string) => void;
}

export function DeviceSelector({ onVideoDeviceSelect, onAddAudioTrack }: Props) {
  const { videoDevices, audioDevices, error, loadDevices } = useMediaDevices();
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedAudio, setSelectedAudio] = useState<string>("");

  const handleVideoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedVideo(e.target.value);
    onVideoDeviceSelect(e.target.value);
  };

  const handleAddTrack = () => {
    if (!selectedAudio) return;
    const device = audioDevices.find(d => d.deviceId === selectedAudio);
    onAddAudioTrack(selectedAudio, device?.label || "Mic");
  };

  return (
    <div className="flex flex-col gap-8">
      
      {error && (
        <div className="text-red-400 text-[10px] p-3 rounded-xl border border-red-400/20 bg-red-400/5">
          <p className="mb-2">Device access denied. Please click allow in your browser or click retry.</p>
          <button onClick={loadDevices} className="w-full bg-red-400/20 hover:bg-red-400/30 p-2 rounded-lg font-bold transition-colors">
            Retry Permissions
          </button>
        </div>
      )}

      {audioDevices.length === 0 && videoDevices.length === 0 && !error && (
        <button 
          onClick={loadDevices} 
          className="w-full flex justify-center items-center gap-2 bg-white/10 hover:bg-studio-accent border border-white/10 text-white p-3 rounded-xl font-semibold transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Scan Devices
        </button>
      )}

      {/* Video Selection */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold tracking-widest text-gray-500 uppercase flex items-center gap-2">
          <Camera className="w-4 h-4 text-studio-accent" /> Main Camera
        </h3>
        <select 
          className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-studio-accent focus:bg-white/10 transition-colors text-sm font-medium hover:border-white/20 appearance-none cursor-pointer"
          value={selectedVideo}
          onChange={handleVideoChange}
        >
          <option value="" className="bg-black text-white">Select Camera...</option>
          {videoDevices.map(d => (
            <option key={d.deviceId} value={d.deviceId} className="bg-black text-white">{d.label || 'Camera'}</option>
          ))}
        </select>
      </div>

      {/* Audio Selection */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold tracking-widest text-gray-500 uppercase flex items-center gap-2">
          <Mic className="w-4 h-4 text-studio-accent" /> Add Channel
        </h3>
        <div className="flex flex-col gap-2">
          <select 
            className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-studio-accent focus:bg-white/10 transition-colors text-sm font-medium hover:border-white/20 appearance-none cursor-pointer"
            value={selectedAudio}
            onChange={(e) => setSelectedAudio(e.target.value)}
          >
            <option value="" className="bg-black text-white">Select Microphone...</option>
            {audioDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId} className="bg-black text-white">{d.label || 'Microphone'}</option>
            ))}
          </select>
          <button 
            onClick={handleAddTrack}
            disabled={!selectedAudio}
            className="w-full flex justify-center items-center gap-2 bg-white/10 hover:bg-studio-accent border border-white/10 hover:border-studio-accent text-white p-3 rounded-xl font-semibold transition-all disabled:opacity-30 disabled:hover:bg-white/10 disabled:hover:border-white/10 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            PLUG IN MIC
          </button>
        </div>
      </div>

    </div>
  );
}
