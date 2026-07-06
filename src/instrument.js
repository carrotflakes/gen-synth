// 楽器モデル — 弦の構築・配置と撥弦(音 + 見た目の振幅)、共鳴のカップリング
import { SCALES, NAMES, ROOT, N_STRINGS } from './config.js';
import { state, currentMaterial } from './state.js';
import { noteFreq } from './music.js';
import { ensureAudio, resumeAudio, sendPluck } from './audio/engine.js';
import { stringTop, stringBot } from './render.js';

export function buildStrings() {
  const sc = SCALES[state.scaleName]; state.strings = [];
  for (let i = 0; i < N_STRINGS; i++) {
    const oct = Math.floor(i / sc.length), deg = i % sc.length;
    const midi = ROOT + oct * 12 + sc[deg];
    state.strings.push({
      freq: noteFreq(midi), midi,
      name: NAMES[midi % 12] + (Math.floor(midi / 12) - 1),
      x: 0, amp: 0, amp0: 0, t0: -9, tau: 1, fret: 0, wv: 2 + i * 0.35, phase: Math.random() * 6.28,
    });
  }
  layout();
}

export function layout() {
  const { W } = state.view;
  const marginX = Math.min(W * 0.12, 120);
  const span = W - marginX * 2;
  state.strings.forEach((s, i) => { s.x = marginX + span * (i / (state.strings.length - 1)); });
}

export const midiLo = () => state.strings[0].midi;
export const midiHi = () => state.strings[state.strings.length - 1].midi;

// Sympathetic coupling strength: how strongly a note at f0 excites a string at f,
// via coincident partials (n·f0 ≈ d·f). Higher-order coincidences couple weaker.
export function coupling(f0, f) {
  let best = 0;
  for (let n = 1; n <= 6; n++) for (let d = 1; d <= 6; d++) {
    const cents = Math.abs(1200 * Math.log2((n * f0) / (d * f)));
    if (cents < 35) { const s = (1 - cents / 35) / (n * d); if (s > best) best = s; }
  }
  return best;
}

// Open string: pluck(i) plays strings[i] at its own pitch. playString can also sound
// a *higher* target pitch on a lower string — like fretting: the finger shortens the
// vibrating length, so only the part below the fret rings.
export function pluck(i, vel = 1, sympathetic = false) {
  const s = state.strings[i]; if (!s) return;
  playString(i, s.freq, s.midi, vel, sympathetic);
}

export function playString(i, freq, midi, vel = 1, sympathetic = false) {
  const s = state.strings[i]; if (!s) return;
  const { P, view } = state;
  const MAT = currentMaterial();
  const T60 = 0.28 * Math.pow(48, P.decay) * MAT.decayMul;
  const base = Math.min(46, view.W * 0.06);
  const fretFrac = Math.max(0, 1 - s.freq / freq);   // 0 = open; →1 as the note climbs the string
  s.amp0 = Math.min(1, vel) * base;
  s.amp = s.amp0; s.t0 = performance.now() / 1000; s.phase = Math.random() * 6.28;
  s.tau = Math.max(0.25, T60 * 0.55); s.fret = fretFrac;
  if (sympathetic) { s.fret = 0; return; }  // sympathetic strings only shimmer, don't re-drive
  state.ripples.push({
    x: s.x,
    y: stringTop() + (stringBot() - stringTop()) * (fretFrac + (1 - fretFrac) * 0.5),
    r: 6, a: 0.7, vel,
  });

  // visual halo: neighbouring strings that share partials quiver in sympathy
  if (P.symp > 0.02) {
    for (let j = 0; j < state.strings.length; j++) {
      if (j === i) continue;
      const c = coupling(freq, state.strings[j].freq) * P.symp;
      if (c > 0.04) {
        const o = state.strings[j];
        const add = Math.min(0.55, c * 1.6) * base * vel;
        if (add > o.amp) {
          o.amp0 = add; o.amp = add; o.t0 = performance.now() / 1000 + 0.02;
          o.phase = Math.random() * 6.28; o.tau = Math.max(0.5, T60 * 0.7); o.fret = 0;
        }
      }
    }
  }
  ensureAudio().then(() => {
    resumeAudio();
    const p = state.panWidth * Math.max(-1, Math.min(1, ((midi - midiLo()) / (midiHi() - midiLo() || 1)) * 2 - 1));
    const velTone = (vel - 0.6) * 0.3;               // harder pluck → a little brighter
    const emit = (f, v, pan) => {
      const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
      sendPluck({
        freq: f, decay: P.decay, tone: P.tone, pos: P.pos, vel: v,
        decayMul: MAT.decayMul, toneAdd: MAT.toneAdd + velTone, k: MAT.k, soft: MAT.soft,
        gL: Math.cos(a), gR: Math.sin(a),
      });
    };
    emit(freq, vel, p);                        // main string
    if (state.courseOn) {                      // 複弦: a slightly detuned partner, spread aside
      emit(freq * Math.pow(2, 7 / 1200), vel * 0.78, p + 0.22);
    }
  });
}
