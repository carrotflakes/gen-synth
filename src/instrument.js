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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 弦上の位置 t(0=上端アンカー, 1=下端アンカー)→ 撥弦位置(端からの距離)。
// 端ほど細く明るく、中央ほど太い。レンジは「弾く位置」スライダーと同じ。
const fracToPos = t => clamp(Math.min(t, 1 - t), 0.04, 0.5);

export function pluck(i, vel = 1, frac) {
  const s = state.strings[i]; if (!s) return;
  playString(i, s.freq, vel, frac);
}

// frac: ポインタで弾いた弦上の高さ。渡されればその撥弦の音色と光の位置を
// そこから決める。無ければ音色はスライダーの「弾く位置」に従い、光は
// 振動区間(フレットから下)の中央で咲く。
export function playString(i, freq, vel = 1, frac) {
  const s = state.strings[i]; if (!s) return;
  const fretFrac = Math.max(0, 1 - s.freq / freq);   // 0 = open; →1 as the note climbs the string
  s.phase = Math.random() * 6.28;
  s.fret = fretFrac;
  const t = frac != null ? clamp(frac, 0, 1) : fretFrac + (1 - fretFrac) * 0.5;
  state.ripples.push({
    x: s.x,
    y: stringTop() + (stringBot() - stringTop()) * t,
    r: 6, a: 0.7, vel,
  });
  pluckNote(i, freq, vel, frac != null ? fracToPos(t) : undefined);
}
