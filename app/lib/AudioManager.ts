import { AudioTrack } from "./AudioTrack";
import { noiseGateWorkletCode } from "./noiseGateWorklet";
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
  masterGain: GainNode | null = null;
  impulseBuffer: AudioBuffer | null = null;
  private soundTouchRegistered: boolean = false;

  // Live preview tracking
  liveSources: AudioBufferSourceNode[] = [];
  liveNodesMap: Map<string, any> = new Map(); // to adjust values on the fly

  constructor() { }

  async initCtx() {
    if (this.ctx && this.ctx.state === "closed") {
      this.ctx = null;
      this.soundTouchRegistered = false;
    }

    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass({
        sampleRate: 48000, // Lock internal DSP engine to 48kHz for maximum quality, avoiding Windows OS resampling artifacts
        latencyHint: "interactive" // Ensure no audio buffer dropouts during heavy timeline playbacks
      });
    }

    if (!this.masterGain) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
    }

    if (!this.soundTouchRegistered) {
      this.impulseBuffer = createSyntheticImpulseResponse(this.ctx);
      const mod = await import("@soundtouchjs/audio-worklet");
      (window as any).SoundTouchNodeClass = mod.SoundTouchNode;
      await mod.SoundTouchNode.register(this.ctx, '/soundtouch-processor.js');
      
      const gateBlob = new Blob([noiseGateWorkletCode], { type: 'application/javascript' });
      await this.ctx.audioWorklet.addModule(URL.createObjectURL(gateBlob));

      this.soundTouchRegistered = true;
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  get context(): AudioContext | null {
    return this.ctx;
  }

  addTrack(track: AudioTrack) {
    this.tracks.push(track);
  }

  removeTrack(id: string) {
    const track = this.tracks.find(t => t.id === id);
    if (track) track.disconnectDevice();
    this.tracks = this.tracks.filter(t => t.id !== id);
  }

  async duplicateWithBakedPitch(id: string): Promise<AudioTrack | null> {
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

  async decodeAllTracks() {
    await this.initCtx();
    if (!this.ctx) return;
    await Promise.all(this.tracks.map(t => t.decodeBlob(this.ctx!)));
  }

  async playPreview(offset: number = 0) {
    await this.decodeAllTracks();
    this.stopPreview(); // clear previous

    if (!this.ctx) return;

    for (const track of this.tracks) {
      if (!track.audioBuffer) continue;

      const sourceNode = this.ctx.createBufferSource();
      sourceNode.buffer = track.audioBuffer;
      this.liveSources.push(sourceNode);

      const storeNodes = (nodes: any) => {
        this.liveNodesMap.set(track.id, nodes);
      };

      const finalMixer = track.setupEffectsGraph(this.ctx, sourceNode, this.impulseBuffer, storeNodes);
      if (this.masterGain) {
        finalMixer.connect(this.masterGain);
      }
    }

    // Start all exactly at current time or scaled
    const when = (this.ctx?.currentTime || 0) + 0.15;
    
    for (const track of this.tracks) {
      if (!track.audioBuffer) continue;
      
      const sourceNode = this.liveSources.find(s => s.buffer === track.audioBuffer);
      if (!sourceNode) continue;
      
      const trackRelativeTime = offset - track.startTimeOffset;
      let startWhen = when;
      let bufferOffset = 0;

      if (trackRelativeTime < 0) {
          // Track plays in the future
          startWhen += Math.abs(trackRelativeTime);
          bufferOffset = 0;
      } else {
          // Playhead already past the start of the track, start immediately
          startWhen = when;
          bufferOffset = trackRelativeTime;
      }
      
      if (bufferOffset < track.audioBuffer.duration) {
          sourceNode.start(startWhen, bufferOffset);
      }
    }
  }

  stopPreview() {
    this.liveSources.forEach(src => {
      try { src.stop(); } catch (e) { }
      src.disconnect();
    });
    this.liveSources = [];

    // CRITICAL: Disconnect EVERY node to kill AudioWorklet background processes
    // and allow garbage collection of the entire audio graph.
    this.liveNodesMap.forEach((nodes: any) => {
      Object.values(nodes).forEach((node: any) => {
        if (node instanceof AudioNode) {
          try { node.disconnect(); } catch (e) { }
        }
      });
    });

    this.liveNodesMap.clear();
  }

  // Update live nodes when slider changes
  updateLiveNodes(track: AudioTrack) {
    const nodes = this.liveNodesMap.get(track.id);
    if (nodes) {
      if (nodes.noiseGateNode) {
        const thresholdParam = nodes.noiseGateNode.parameters.get('threshold');
        if (thresholdParam) thresholdParam.value = track.noiseGateThreshold;
      }
      
      const totalPitch = track.basePitch + track.pitch;
      const pitchRatio = Math.pow(2, totalPitch / 12);
      if (nodes.pitchShifter) {
        nodes.pitchShifter.pitch.value = pitchRatio;
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
      // This will use the cache if already decoded
      const decoded = await track.decodeBlob(this.ctx!);
      if (decoded) {
        buffers.push({ track, buffer: decoded });
        if (decoded.duration > maxLength) maxLength = decoded.duration;
      }
    }

    if (buffers.length === 0) throw new Error("No recorded audio to export");

    for (const item of buffers) {
      const end = item.track.startTimeOffset + item.track.duration;
      if (end > maxLength) maxLength = end;
    }
    // ensure at least min time
    if (maxLength < 1) maxLength = 1;

    // Render with OfflineAudioContext
    const sampleRate = this.ctx!.sampleRate;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(maxLength * sampleRate), sampleRate);
    const mod = await import("@soundtouchjs/audio-worklet");
    await mod.SoundTouchNode.register(offlineCtx, '/soundtouch-processor.js');
    
    const gateBlob = new Blob([noiseGateWorkletCode], { type: 'application/javascript' });
    await offlineCtx.audioWorklet.addModule(URL.createObjectURL(gateBlob));

    const offlineImpulse = createSyntheticImpulseResponse(offlineCtx);

    for (const item of buffers) {
      const sourceNode = offlineCtx.createBufferSource();
      sourceNode.buffer = item.buffer;
      const finalMixer = item.track.setupEffectsGraph(offlineCtx, sourceNode, offlineImpulse);
      finalMixer.connect(offlineCtx.destination);
      
      const startWhen = Math.max(0, item.track.startTimeOffset);
      const startOffset = Math.max(0, -item.track.startTimeOffset);
      if (startOffset < item.buffer.length / sampleRate) {
        sourceNode.start(startWhen, startOffset);
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWav(renderedBuffer);
  }
}
