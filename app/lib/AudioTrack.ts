import { v4 as uuidv4 } from "uuid";

export class AudioTrack {
  id: string;
  name: string = "Mic Track";
  
  // Recording
  stream: MediaStream | null = null;
  recorder: MediaRecorder | null = null;
  chunks: Blob[] = [];
  audioBlob: Blob | null = null;
  audioBuffer: AudioBuffer | null = null;

  async decodeBlob(ctx: BaseAudioContext) {
    if (!this.audioBlob || this.audioBuffer) return this.audioBuffer;
    const arrayBuffer = await this.audioBlob.arrayBuffer();
    this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    // Correct the approximate duration from stopRecording with the exact buffer duration
    this.duration = this.audioBuffer.duration;
    return this.audioBuffer;
  }

  // Effects State
  basePitch: number = 0;  // Hidden shift accumulated from duplications
  pitch: number = 0;      // -12 to 12
  bass: number = 0;       // -20 to 20
  treble: number = 0;     // -20 to 20
  delayTime: number = 0;  // 0 to 1 seconds
  feedback: number = 0;   // 0 to 0.8
  echoMix: number = 0;    // 0 to 1
  reverbMix: number = 0;  // 0 to 1
  volume: number = 1;     // 0 to 2
  isMuted: boolean = false;
  color: string = "#f43f5e";

  // Track Length
  startTime: number = 0;
  duration: number = 0;

  constructor(id?: string) {
    this.id = id || uuidv4();
  }

  async requestDevice(deviceId?: string): Promise<MediaStream> {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    const audioConstraints = {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
      sampleRate: 48000,
      channelCount: 2
    };

    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId }, ...audioConstraints } : audioConstraints,
      video: false,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.stream;
    } catch (err) {
      console.error("Failed to get audio device", err);
      throw err;
    }
  }

  startRecording() {
    if (!this.stream) throw new Error("No audio stream");
    this.chunks = [];
    this.audioBuffer = null;
    this.startTime = Date.now();
    try {
      // Force high quality audio bitrate (256 kbps)
      this.recorder = new MediaRecorder(this.stream, { audioBitsPerSecond: 256000 });
    } catch (e) {
      this.recorder = new MediaRecorder(this.stream);
    }
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100);
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === "inactive") {
        resolve(this.audioBlob || new Blob());
        return;
      }
      this.recorder.onstop = () => {
        this.duration = (Date.now() - this.startTime) / 1000;
        this.audioBlob = new Blob(this.chunks, { type: "audio/webm;codecs=opus" });
        this.chunks = []; // Clear RAM
        resolve(this.audioBlob);
      };
      this.recorder.stop();
    });
  }

  disconnectDevice() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  clone(): AudioTrack {
    const newTrack = new AudioTrack();
    // Copy effects
    newTrack.basePitch = this.basePitch + this.pitch;
    newTrack.pitch = 0;
    newTrack.bass = this.bass;
    newTrack.treble = this.treble;
    newTrack.delayTime = this.delayTime;
    newTrack.feedback = this.feedback;
    newTrack.echoMix = this.echoMix;
    newTrack.reverbMix = this.reverbMix;
    newTrack.volume = this.volume;
    newTrack.isMuted = this.isMuted;
    newTrack.color = this.color;

    // Copy audio data
    newTrack.duration = this.duration;
    newTrack.audioBlob = this.audioBlob;
    
    // Note: Live MediaStream and recorder are intentionally NOT cloned.
    return newTrack;
  }

  /**
   * Sets up the effects graph in a given context (live AudioContext or OfflineAudioContext).
   * Returns the final OutputMixer node so it can be connected to the context's destination.
   */
  setupEffectsGraph(
    ctx: BaseAudioContext,
    sourceNode: AudioNode,
    impulseBuffer: AudioBuffer | null,
    // Provide a way to interact with nodes dynamically if we are in live playback
    storeNodes?: (nodes: any) => void 
  ): AudioNode {
    // 0. Pitch Shift
    const SoundTouchNodeClass = (window as any).SoundTouchNodeClass;
    if (!SoundTouchNodeClass) {
      throw new Error("SoundTouchNodeClass not injected");
    }
    const pitchShifter = new SoundTouchNodeClass(ctx);
    const totalPitch = this.basePitch + this.pitch;
    const pitchRatio = Math.pow(2, totalPitch / 12);
    pitchShifter.pitch.value = pitchRatio;
    pitchShifter.tempo.value = 1.0;
    
    sourceNode.connect(pitchShifter);

    // 1. EQ
    const bassNode = ctx.createBiquadFilter();
    bassNode.type = "lowshelf";
    bassNode.frequency.value = 150;
    bassNode.gain.value = this.bass;

    const trebleNode = ctx.createBiquadFilter();
    trebleNode.type = "highshelf";
    trebleNode.frequency.value = 4000;
    trebleNode.gain.value = this.treble;

    // 2. Bus
    const eqBus = ctx.createGain();
    
    pitchShifter.connect(bassNode);
    bassNode.connect(trebleNode);
    trebleNode.connect(eqBus);

    // 3. Dry Path
    const outputMixer = ctx.createGain();
    outputMixer.gain.value = this.isMuted ? 0 : this.volume;
    
    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;
    eqBus.connect(dryGain);
    dryGain.connect(outputMixer);

    // 4. Echo (Delay)
    const delayNode = ctx.createDelay(2.0); // max delay 2s
    delayNode.delayTime.value = this.delayTime;

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = this.feedback;

    const echoMixGain = ctx.createGain();
    echoMixGain.gain.value = this.echoMix;

    eqBus.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode); // feedback loop
    delayNode.connect(echoMixGain);
    echoMixGain.connect(outputMixer);

    // 5. Reverb
    const convolverNode = ctx.createConvolver();
    if (impulseBuffer) {
      convolverNode.buffer = impulseBuffer;
    }

    const reverbMixGain = ctx.createGain();
    reverbMixGain.gain.value = this.reverbMix;

    eqBus.connect(convolverNode);
    convolverNode.connect(reverbMixGain);
    reverbMixGain.connect(outputMixer);

    if (storeNodes) {
      storeNodes({
        pitchShifter,
        bassNode,
        trebleNode,
        eqBus,
        dryGain,
        convolverNode,
        delayNode,
        feedbackGain,
        echoMixGain,
        reverbMixGain,
        outputMixer
      });
    }

    return outputMixer;
  }
}
