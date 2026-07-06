// 楽器モデル — 弦の構築・配置と撥弦。
// 音は engine 経由で弦バンクに励起を注入する。弦の振動量(共鳴含む)は
// 音声側から state.strings[i].level に返ってくるので、ここでは管理しない。
import { SCALES, NAMES, ROOT, N_STRINGS } from './config.js';
import { state } from './state.js';
import { noteFreq } from './music.js';
import { pluckNote, syncStrings } from './audio/engine.js';
import { stringTop, stringBot } from './render.js';

export function buildStrings() {
  const sc = SCALES[state.scaleName]; state.strings = [];
  for (let i = 0; i < N_STRINGS; i++) {
    const oct = Math.floor(i / sc.length), deg = i % sc.length;
    const midi = ROOT + oct * 12 + sc[deg];
    state.strings.push({
      freq: noteFreq(midi), midi,
      name: NAMES[midi % 12] + (Math.floor(midi / 12) - 1),
      x: 0, amp: 0, level: 0, fret: 0, wv: 2 + i * 0.35, phase: Math.random() * 6.28,
    });
  }
  layout();
  syncStrings();
}

export function layout() {
  const { W } = state.view;
  const marginX = Math.min(W * 0.12, 120);
  const span = W - marginX * 2;
  state.strings.forEach((s, i) => { s.x = marginX + span * (i / (state.strings.length - 1)); });
}

// Open string: pluck(i) plays strings[i] at its own pitch. playString can also sound
// a *higher* target pitch on a lower string — like fretting: the finger shortens the
// vibrating length, so only the part below the fret rings.
export function pluck(i, vel = 1) {
  const s = state.strings[i]; if (!s) return;
  playString(i, s.freq, vel);
}

export function playString(i, freq, vel = 1) {
  const s = state.strings[i]; if (!s) return;
  const fretFrac = Math.max(0, 1 - s.freq / freq);   // 0 = open; →1 as the note climbs the string
  s.phase = Math.random() * 6.28;
  s.fret = fretFrac;
  state.ripples.push({
    x: s.x,
    y: stringTop() + (stringBot() - stringTop()) * (fretFrac + (1 - fretFrac) * 0.5),
    r: 6, a: 0.7, vel,
  });
  pluckNote(i, freq, vel);
}
