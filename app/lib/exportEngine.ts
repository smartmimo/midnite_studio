import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export class ExportEngine {
  ffmpeg: FFmpeg;
  loaded: boolean = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  async load(onProgress?: (p: any) => void) {
    if (this.loaded) return;
    
    // Ensure we see what ffmpeg is doing during dev
    this.ffmpeg.on("log", ({ message }) => console.log(message));
    
    if (onProgress) {
        this.ffmpeg.on("progress", onProgress);
    }
    
    try {
      await this.ffmpeg.load({
        coreURL: "/ffmpeg/ffmpeg-core.js",
        wasmURL: "/ffmpeg/ffmpeg-core.wasm"
      });
      this.loaded = true;
    } catch (e) {
        console.error("Failed loading FFmpeg", e);
        throw e;
    }
  }

  async muxAudioVideo(videoBlob: Blob, audioBlob: Blob, onProgress?: (p: any) => void): Promise<Blob> {
    if (!this.loaded) await this.load(onProgress);

    await this.ffmpeg.writeFile("video.webm", await fetchFile(videoBlob));
    await this.ffmpeg.writeFile("audio.wav", await fetchFile(audioBlob));

    // Mux command
    // map 0:v:0 -> video from first input
    // map 1:a:0 -> audio from second input
    await this.ffmpeg.exec([
      "-i", "video.webm",
      "-i", "audio.wav",
      "-c:v", "copy",
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:a", "aac",
      "output.mp4"
    ]);

    const data = (await this.ffmpeg.readFile("output.mp4")) as any;
    return new Blob([data], { type: "video/mp4" });
  }
}
