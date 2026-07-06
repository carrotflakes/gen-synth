// AudioWorklet 側の薄いラッパ — 弦のシミュレーション本体は dsp.js の StringBank。
// port メッセージ {t: 'setup'|'setParams'|'setPans'|'pluck', ...} を同名メソッドに
// 渡し、描画用に各弦の RMS を定期的に返送する。
import { StringBank } from './dsp.js';

const LEVEL_EVERY = 4;   // blocks (~11ms @ 128 samples) per levels message

class KS extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bank = new StringBank(sampleRate);
    this.blocks = 0; this.samples = 0;
    this.port.onmessage = e => {
      const m = e.data;
      if (typeof this.bank[m.t] === 'function') this.bank[m.t](m);
    };
  }
  process(_in, out) {
    const L = out[0][0], R = out[0][1] || out[0][0];
    this.bank.process(L, R);
    this.samples += L.length;
    if (++this.blocks >= LEVEL_EVERY) {
      this.blocks = 0;
      this.port.postMessage({ t: 'levels', levels: this.bank.takeLevels(this.samples) });
      this.samples = 0;
    }
    return true;
  }
}
registerProcessor('ks', KS);
