// オーディオグラフの構築と弦バンク(dsp.js StringBank)との通信。
// 弦の合成は AudioWorklet (ks-processor.js) 上で行い、worklet が使えない
// 環境では同じ StringBank を ScriptProcessorNode でメインスレッド実行する。
// 共鳴は弦バンク内のブリッジ結合で物理的に起きるため、ここにはもう
// 擬似共鳴フィルタは無い — このファイルは胴鳴り・残響・出力段のみを持つ。
import { BODY_MODES } from '../config.js';
import { state, currentMaterial } from '../state.js';
import { StringBank } from './dsp.js';

let AC = null, wet = null, ks = null, bank = null;
let bodyBus = null, directGain = null, bodyFilters = [];
let ready = false, initing = null;

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

// 弦バンクへのメッセージ(worklet なら postMessage、フォールバックなら直接呼ぶ)
function send(m) {
  if (ks) ks.port.postMessage(m);
  else if (bank) bank[m.t](m);
}

// worklet から届く実 RMS を描画用に state へ書き戻す。
// 複弦時は後半に相方の弦が並ぶので、同じ見た目の弦にまとめる。
function applyLevels(lv) {
  const ss = state.strings, n = ss.length;
  for (let i = 0; i < n; i++) {
    let v = lv[i] || 0;
    if (lv.length >= n * 2) v = Math.max(v, lv[n + i]);
    ss[i].level = v;
  }
}

// 現在の state から弦バンクの構成([{freq,gL,gR}])を作る。
// 定位は弦ごとに固定 — 共鳴音もその弦の位置から鳴る。
// 複弦は数セント高い相方の弦を実体として後半に足す。
function stringSetup() {
  const ss = state.strings;
  const lo = ss[0].midi, hi = ss[ss.length - 1].midi;
  const panOf = (midi, off = 0) => {
    const p = state.panWidth * Math.max(-1, Math.min(1, ((midi - lo) / (hi - lo || 1)) * 2 - 1)) + off;
    const a = (Math.max(-1, Math.min(1, p)) + 1) * Math.PI / 4;
    return [Math.cos(a), Math.sin(a)];
  };
  const arr = ss.map(s => { const [gL, gR] = panOf(s.midi); return { freq: s.freq, gL, gR }; });
  if (state.courseOn) {
    for (const s of ss) {
      const [gL, gR] = panOf(s.midi, 0.22);
      arr.push({ freq: s.freq * Math.pow(2, 7 / 1200), gL, gR });
    }
  }
  return arr;
}

// ---- 弦バンクの state への同期(audio 未初期化なら no-op、初期化時に反映される) ----
export function syncStrings() { if (ready) send({ t: 'setup', strings: stringSetup() }); }  // 張り替え(音が止まる)
export function syncPans() { if (ready) send({ t: 'setPans', pans: stringSetup().map(d => [d.gL, d.gR]) }); }
export function syncParams() {
  if (!ready) return;
  const P = state.P, MAT = currentMaterial();
  send({
    t: 'setParams', params: {
      decay: P.decay, tone: P.tone, pos: P.pos, symp: P.symp,
      decayMul: MAT.decayMul, toneAdd: MAT.toneAdd, k: MAT.k, soft: MAT.soft,
    },
  });
}

// 弦 i に freq(フレット奏法なら開放弦より高い)の励起を注入する
export function pluckNote(i, freq, vel, pos) {
  ensureAudio().then(() => {
    resumeAudio();
    send({ t: 'pluck', i, freq, vel, pos });
    if (state.courseOn) {
      send({ t: 'pluck', i: state.strings.length + i, freq: freq * Math.pow(2, 7 / 1200), vel: vel * 0.78, pos });
    }
  });
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
    busIn.connect(directGain); directGain.connect(mix);   // direct strings
    bodyBus.connect(mix);                                 // body coloration + ring
    mix.connect(comp);                                    // instrument → compressor
    mix.connect(conv); conv.connect(wet); wet.connect(comp);  // room reverb of the whole instrument
    comp.connect(master); master.connect(AC.destination);

    // Preferred path: real-time synthesis on the audio thread via AudioWorklet.
    try {
      await AC.audioWorklet.addModule(new URL('./ks-processor.js', import.meta.url));
      ks = new AudioWorkletNode(AC, 'ks', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
      ks.port.onmessage = e => { if (e.data.t === 'levels') applyLevels(e.data.levels); };
      ks.connect(busIn);
    } catch (err) {
      // Sandboxed iframes などで worklet モジュールがブロックされる環境では、
      // 同一の StringBank をメインスレッドで回す。
      bank = new StringBank(AC.sampleRate);
      let sp;
      try { sp = AC.createScriptProcessor(2048, 0, 2); }
      catch (e) { sp = AC.createScriptProcessor(2048, 1, 2); }
      sp.onaudioprocess = ev => {
        const b = ev.outputBuffer;
        const L = b.getChannelData(0);
        bank.process(L, b.numberOfChannels > 1 ? b.getChannelData(1) : L);
        applyLevels(bank.takeLevels(L.length));
      };
      sp.connect(busIn);
    }
    ready = true;
    syncStrings();   // 現在の state を弦バンクに反映してから鳴らす
    syncParams();
  })();
  return initing;
}

export function resumeAudio() {
  if (AC && AC.state === 'suspended') AC.resume();
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
