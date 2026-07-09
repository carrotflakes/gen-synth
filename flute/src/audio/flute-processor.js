// AudioWorklet 側の薄いラッパ — フルートのシミュレーション本体は dsp.js の Flute。
// port メッセージ {t: 'note'|'off'|'setParams', ...} を同名メソッドに渡すだけ。
import { Flute } from './dsp.js';

class FluteProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.flute = new Flute(sampleRate);
    this.port.onmessage = e => {
      const m = e.data;
      if (typeof this.flute[m.t] === 'function') this.flute[m.t](m);
    };
  }
  process(_in, out) {
    this.flute.process(out[0][0]);
    return true;
  }
}
registerProcessor('flute', FluteProcessor);
