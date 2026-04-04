export class VideoManager {
  stream: MediaStream | null = null;
  recorder: MediaRecorder | null = null;
  chunks: Blob[] = [];
  finalBlob: Blob | null = null;

  startTime: number = 0;
  duration: number = 0;

  async requestDevice(deviceId?: string): Promise<MediaStream> {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false, // strictly video
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.stream;
    } catch (err) {
      console.error("Failed to get video device", err);
      throw err;
    }
  }

  startRecording() {
    if (!this.stream) throw new Error("No video stream");
    this.chunks = [];
    this.startTime = Date.now();
    
    // Choose best format
    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm';
    }

    this.recorder = new MediaRecorder(this.stream, { mimeType });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(100); // chunk every 100ms
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder || this.recorder.state === "inactive") {
        resolve(this.finalBlob || new Blob());
        return;
      }
      this.recorder.onstop = () => {
        this.duration = (Date.now() - this.startTime) / 1000;
        this.finalBlob = new Blob(this.chunks, { type: this.recorder!.mimeType });
        resolve(this.finalBlob);
      };
      this.recorder.stop();
    });
  }

  disconnect() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
