import { v4 as uuidv4 } from "uuid";

export class AudioTrack {
  id: string;
  name: string = "Mic Track";
  
  // Recording
  stream: MediaStream | null = null;
  recorder: MediaRecorder | null = null;
  chunks: Blob[] = [];
  audioBlob: Blob | null = null;

  // Effects State
  bass: number = 0;       // -20 to 20
  treble: number = 0;     // -20 to 20
  delayTime: number = 0;  // 0 to 1 seconds
  feedback: number = 0;   // 0 to 0.8
  echoMix: number = 0;    // 0 to 1
  reverbMix: number = 0;  // 0 to 1
  volume: number = 1;     // 0 to 2
  isMuted: boolean = false;

  constructor(id?: string) {
    this.id = id || uuidv4();
  }

  async requestDevice(deviceId?: string): Promise<MediaStream> {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
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
    this.recorder = new MediaRecorder(this.stream);
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
        this.audioBlob = new Blob(this.chunks, { type: "audio/webm;codecs=opus" });
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
    
    sourceNode.connect(bassNode);
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
        bassNode,
        trebleNode,
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
