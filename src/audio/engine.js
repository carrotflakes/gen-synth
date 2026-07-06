// オーディオグラフの構築と発音の入口。
// 弦の合成は AudioWorklet (ks-processor.js) 上で行い、blob worklet が使えない
// 環境では ScriptProcessorNode で同じ DSP をメインスレッド実行する。
import { BODY_MODES } from '../config.js';
import { state } from '../state.js';
import { makeVoice, addVoice, renderVoices } from './dsp.js';

let AC = null, wet = null, ks = null;
let bodyBus = null, directGain = null, bodyFilters = [];
let sympBus = null, sympFilters = [];
let ready = false, initing = null, engine = 'none';
const voices = [];   // main-thread voice pool (used by the ScriptProcessor fallback)

// small box → higher modes, large → lower
export const sizeMul = s => Math.pow(2, -(s - 0.5) * 1.7);

function makeIR(dur, dec) {
  const n = Math.floor(AC.sampleRate * dur), b = AC.createBuffer(2, n, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, dec);
  }
  return b;
}

export function ensureAudio() {
  if (ready) return Promise.resolve();
  if (initing) return initing;
  initing = (async () => {
    const P = state.P;
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const busIn = AC.createGain();
    const mix = AC.createGain();                         // direct + body sum
    directGain = AC.createGain(); directGain.gain.value = 0.9 - 0.4 * P.body;
    wet = AC.createGain(); wet.gain.value = P.rev;
    const conv = AC.createConvolver(); conv.buffer = makeIR(2.6, 2.4);
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 8; comp.ratio.value = 3;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    const master = AC.createGain(); master.gain.value = 0.85;

    // 胴鳴り — modal body: parallel resonators at the fixed modes of a wooden
    // soundbox. High-Q bands ring on after the pluck; notes landing on a mode
    // bloom. 胴の大きさ moves every mode.
    bodyBus = AC.createGain(); bodyBus.gain.value = P.body * 3.6;
    const mul = sizeMul(P.size); bodyFilters = [];
    for (const [f, q, gain] of BODY_MODES) {
      const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * mul; bp.Q.value = q;
      const mg = AC.createGain(); mg.gain.value = gain;
      busIn.connect(bp); bp.connect(mg); mg.connect(bodyBus);
      bodyFilters.push({ bp, base: f });
    }
    busIn.connect(directGain); directGain.connect(mix);   // direct string
    bodyBus.connect(mix);                                 // body coloration + ring
    mix.connect(comp);                                    // instrument → compressor
    mix.connect(conv); conv.connect(wet); wet.connect(comp);  // room reverb of the whole instrument

    // 共鳴弦 — sympathetic strings: a high-Q resonator tuned to every string's pitch
    // (plus its octave), always listening. A plucked note whose partials coincide with
    // another string's pitch sets that resonator ringing — the piano/koto "halo".
    sympBus = AC.createGain(); sympBus.gain.value = P.symp * 6; sympBus.connect(comp);
    sympFilters = [];
    for (let i = 0; i < state.strings.length; i++) {
      for (const h of [1, 2]) {
        const bp = AC.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = state.strings[i].freq * h; bp.Q.value = h === 1 ? 30 : 38;
        const mg = AC.createGain(); mg.gain.value = h === 1 ? 1 : 0.45;
        mix.connect(bp); bp.connect(mg); mg.connect(sympBus);
        sympFilters.push({ bp, i, h });
      }
    }
    comp.connect(master); master.connect(AC.destination);

    // Preferred path: real-time synthesis on the audio thread via AudioWorklet.
    try {
      await AC.audioWorklet.addModule(new URL('./ks-processor.js', import.meta.url));
      ks = new AudioWorkletNode(AC, 'ks', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      ks.connect(busIn); engine = 'worklet';
    } catch (err) {
      // Sandboxed iframes などで worklet モジュールがブロックされる環境では、
      // 同一の DSP (dsp.js) を ScriptProcessorNode でメインスレッド実行する。
      let sp;
      try { sp = AC.createScriptProcessor(2048, 0, 2); }
      catch (e) { sp = AC.createScriptProcessor(2048, 1, 2); }
      sp.onaudioprocess = ev => {
        const b = ev.outputBuffer;
        renderVoices(voices, b.getChannelData(0), b.numberOfChannels > 1 ? b.getChannelData(1) : b.getChannelData(0));
      };
      sp.connect(busIn); engine = 'sp';
    }
    ready = true;
  })();
  return initing;
}

export function resumeAudio() {
  if (AC && AC.state === 'suspended') AC.resume();
}

export function sendPluck(m) {
  if (engine === 'worklet') { ks.port.postMessage({ t: 'pluck', ...m }); }
  else { addVoice(voices, makeVoice(m, AC.sampleRate)); }
}

// 音階・調律の変更後に共鳴弦フィルタを追従させる
export function retuneSymp() {
  if (!sympFilters.length || !AC) return;
  for (const sf of sympFilters) {
    const s = state.strings[sf.i]; if (!s) continue;
    sf.bp.frequency.setTargetAtTime(s.freq * sf.h, AC.currentTime, 0.03);
  }
}

// ---- slider → audio graph (no-ops until the graph exists) ----
export function setReverb(v) { if (wet) wet.gain.value = v; }
export function setBody(v) {
  if (bodyBus) bodyBus.gain.value = v * 3.6;
  if (directGain) directGain.gain.value = 0.9 - 0.4 * v;
}
export function setSize(v) {
  const m = sizeMul(v);
  for (const bf of bodyFilters) bf.bp.frequency.value = bf.base * m;
}
export function setSymp(v) { if (sympBus) sympBus.gain.value = v * 6; }
