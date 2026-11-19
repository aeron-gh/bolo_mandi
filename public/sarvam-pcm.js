/* global AudioWorkletProcessor, registerProcessor */
// The context is already resampled to 16 kHz. Send mono PCM in 80 ms frames.
class SarvamPcm extends AudioWorkletProcessor {
  samples = new Int16Array(1280);
  length = 0;

  constructor() {
    super();
    this.port.onmessage = () => {
      this.flush();
      this.port.postMessage(null);
    };
  }

  flush() {
    if (!this.length) return;
    const chunk = this.samples.slice(0, this.length);
    this.port.postMessage(chunk.buffer, [chunk.buffer]);
    this.length = 0;
  }

  process(inputs) {
    const mono = inputs[0]?.[0];
    if (!mono) return true;
    for (const sample of mono) {
      this.samples[this.length++] = Math.max(-1, Math.min(1, sample)) * 32767;
      if (this.length === this.samples.length) this.flush();
    }
    return true;
  }
}
registerProcessor("sarvam-pcm", SarvamPcm);
