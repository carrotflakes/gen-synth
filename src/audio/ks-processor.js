// Karplus-Strong runs on the audio thread — no per-note buffers, no main-thread jank.
// AudioWorklet モジュールとしてロードされる (engine.js の addModule)。
import { makeVoice, addVoice, renderVoices } from './dsp.js';

class KS extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.port.onmessage = e => {
      const m = e.data;
      if (m.t === 'pluck') addVoice(this.voices, makeVoice(m, sampleRate));
    };
  }
  process(_in, out) {
    const L = out[0][0], R = out[0][1] || out[0][0];
    renderVoices(this.voices, L, R);
    return true;
  }
}
registerProcessor('ks', KS);
