import { AudioTrack } from "./AudioTrack";
import { SoundTouchNode } from "@soundtouchjs/audio-worklet";

// Generate a simple synthetic impulse response for the Reverb effect
function createSyntheticImpulseResponse(ctx: BaseAudioContext): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * 2.5; // 2.5s tail
  const buffer = ctx.createBuffer(2, length, sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
        const noise = (Math.random() * 2 - 1);
        channelData[i] = noise * Math.exp(-i / (sampleRate * 0.3)); 
    }
  }
  return buffer;
}

// Convert AudioBuffer to WAV format (Blob)
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2;
  const outBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(outBuffer);
  const channels = [];
  let sample = 0;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  const setUint16 = (data: number) => { view.setUint16(pos, data, true); pos += 2; };
  const setUint32 = (data: number) => { view.setUint32(pos, data, true); pos += 4; };

  setUint32(0x46464952); // "RIFF"
  setUint32(36 + length);
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // length of fmt data
  setUint16(1); // PCM format
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); // block align
  setUint16(16); // bit depth
  setUint32(0x61746164); // "data"
  setUint32(length);

  // write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }
  while (pos < outBuffer.byteLength) {
    for (let i = 0; i < numOfChan; i++) {
      // clip
      let s = Math.max(-1, Math.min(1, channels[i][offset]));
      // convert to 16 bit
      s = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(pos, s, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([outBuffer], { type: "audio/wav" });
}

export class AudioManager {
  tracks: AudioTrack[] = [];
  ctx: AudioContext | null = null;
  impulseBuffer: AudioBuffer | null = null;
  
  // Live preview tracking
  liveSources: AudioBufferSourceNode[] = [];
  liveNodesMap: Map<string, any> = new Map(); // to adjust values on the fly

  constructor() {}

  async initCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.impulseBuffer = createSyntheticImpulseResponse(this.ctx);
      await SoundTouchNode.register(this.ctx, '/soundtouch-processor.js');
    }
  }

  addTrack(track: AudioTrack) {
    this.tracks.push(track);
  }

  removeTrack(id: string) {
    const track = this.tracks.find(t => t.id === id);
    if (track) track.disconnectDevice();
    this.tracks = this.tracks.filter(t => t.id !== id);
  }

  async duplicateWithBakedPitch(id: string, newPitch: number): Promise<AudioTrack | null> {
    const original = this.tracks.find(t => t.id === id);
    if (!original || !original.audioBlob) return null;

    // clone() already cascades basePitch + pitch correctly and inherits the raw audioBlob
    const duplicate = original.clone();
    
    return duplicate;
  }

  startRecordingAll() {
    this.tracks.forEach(t => t.startRecording());
  }

  async stopRecordingAll() {
    await Promise.all(this.tracks.map(t => t.stopRecording()));
  }

  async playPreview(offset: number = 0) {
    await this.initCtx();
    this.stopPreview(); // clear previous

    if (!this.ctx) return;

    for (const track of this.tracks) {
      if (!track.audioBlob) continue;
      
      const arrayBuffer = await track.audioBlob.arrayBuffer();
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

      const sourceNode = this.ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      this.liveSources.push(sourceNode);

      const storeNodes = (nodes: any) => {
        this.liveNodesMap.set(track.id, nodes);
      };

      const finalMixer = track.setupEffectsGraph(this.ctx, sourceNode, this.impulseBuffer, storeNodes);
      finalMixer.connect(this.ctx.destination);
    }

    // Start all exactly at current time
    const startTime = this.ctx.currentTime + 0.1; 
    this.liveSources.forEach(src => src.start(startTime, offset));
  }

  stopPreview() {
    this.liveSources.forEach(src => {
      try { src.stop(); } catch(e) {}
      src.disconnect();
    });
    this.liveSources = [];
    this.liveNodesMap.clear();
  }

  // Update live nodes when slider changes
  updateLiveNodes(track: AudioTrack) {
    const nodes = this.liveNodesMap.get(track.id);
    if (nodes) {
      if (nodes.pitchShifter && nodes.pitchBypassGain && nodes.pitchEffectGain) {
        const totalPitch = track.basePitch + track.pitch;
        if (totalPitch === 0) {
           nodes.pitchBypassGain.gain.value = 1;
           nodes.pitchEffectGain.gain.value = 0;
        } else {
           nodes.pitchBypassGain.gain.value = 0;
           nodes.pitchEffectGain.gain.value = 1;
           const pitchRatio = Math.pow(2, totalPitch / 12);
           nodes.pitchShifter.pitch.value = pitchRatio;
           nodes.pitchShifter.tempo.value = 1.0;
        }
      }
      nodes.bassNode.gain.value = track.bass;
      nodes.trebleNode.gain.value = track.treble;
      nodes.delayNode.delayTime.value = track.delayTime;
      nodes.feedbackGain.gain.value = track.feedback;
      nodes.echoMixGain.gain.value = track.echoMix;
      nodes.reverbMixGain.gain.value = track.reverbMix;
      nodes.outputMixer.gain.value = track.isMuted ? 0 : track.volume;
    }
  }

  async exportMixedAudio(): Promise<Blob> {
    await this.initCtx();
    if (this.tracks.length === 0) throw new Error("No tracks to export");

    // Decoded buffers
    const buffers: { track: AudioTrack, buffer: AudioBuffer }[] = [];
    let maxLength = 0;
    
    for (const track of this.tracks) {
      if (!track.audioBlob) continue;
      const arrayBuffer = await track.audioBlob.arrayBuffer();
      // Use standard ctx for decoding
      const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
      buffers.push({ track, buffer: decoded });
      if (decoded.length > maxLength) maxLength = decoded.length;
    }

    if (buffers.length === 0) throw new Error("No recorded audio to export");

    // Render with OfflineAudioContext
    const sampleRate = this.ctx!.sampleRate;
    const offlineCtx = new OfflineAudioContext(2, maxLength, sampleRate);
    await SoundTouchNode.register(offlineCtx, '/soundtouch-processor.js');
    const offlineImpulse = createSyntheticImpulseResponse(offlineCtx);

    for (const item of buffers) {
      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = item.buffer;
      const finalMixer = item.track.setupEffectsGraph(offlineCtx, sourceNode, offlineImpulse);
      finalMixer.connect(offlineCtx.destination);
      sourceNode.start(0);
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWav(renderedBuffer);
  }
}
