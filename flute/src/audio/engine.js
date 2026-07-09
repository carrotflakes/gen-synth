// オーディオグラフの構築と Flute(dsp.js)との通信。
// 合成は AudioWorklet (flute-processor.js) 上で行い、worklet が使えない環境では
// 同じ Flute を ScriptProcessorNode でメインスレッド実行する。
import { state } from '../state.js';
import { Flute } from './dsp.js';

let AC = null, node = null, flute = null;
let ready = false, initing = null;

// Flute へのメッセージ(worklet なら postMessage、フォールバックなら直接呼ぶ)
function send(m) {
  if (node) node.port.postMessage(m);
  else if (flute) flute[m.t](m);
}

// 現在の state.P を worklet に反映(未初期化なら初期化時に反映される)
export function syncParams() { if (ready) send({ t: 'setParams', params: { ...state.P } }); }

// 発音 / 消音。vel(0..1)は息の強さで、省略時は最大。
export function noteOn(freq, vel = 1) {
  state.freq = freq;
  ensureAudio().then(() => { resumeAudio(); send({ t: 'note', freq, vel }); });
}
export function noteOff() { send({ t: 'off' }); }

export function ensureAudio() {
  if (ready) return Promise.resolve();
  if (initing) return initing;
  initing = (async () => {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor();
    comp.connect(AC.destination);

    // Preferred path: 合成をオーディオスレッドの AudioWorklet で回す。
    try {
      await AC.audioWorklet.addModule(new URL('./flute-processor.js', import.meta.url));
      node = new AudioWorkletNode(AC, 'flute');
      node.connect(comp);
    } catch (err) {
      // Sandboxed iframes などで worklet がブロックされる環境では、同じ Flute を
      // メインスレッドで回す。
      flute = new Flute(AC.sampleRate);
      let sp;
      try { sp = AC.createScriptProcessor(2048, 0, 1); }
      catch (e) { sp = AC.createScriptProcessor(2048, 1, 1); }
      sp.onaudioprocess = ev => flute.process(ev.outputBuffer.getChannelData(0));
      sp.connect(comp);
    }
    ready = true;
    syncParams();   // 現在の state を反映してから鳴らす
  })();
  return initing;
}

export function resumeAudio() {
  if (AC && AC.state === 'suspended') AC.resume();
}
