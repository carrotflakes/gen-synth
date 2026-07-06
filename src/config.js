// 定数定義 — 音階・材質・胴モードなど、実行中に変化しない値

// musical scales (semitone offsets)
export const SCALES = {
  "陽 pentatonic": [0, 2, 4, 7, 9],
  "陰 都節": [0, 1, 5, 7, 8],
  "琉球": [0, 4, 5, 7, 11],
  "長 major": [0, 2, 4, 5, 7, 9, 11],
  "短 minor": [0, 2, 3, 5, 7, 8, 10],
};

export const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export const ROOT = 48;               // C3
export const N_STRINGS = 15;

// 5-limit just ratios relative to the tonic (= ROOT's pitch class)
export const JI = [1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/3, 9/5, 15/8];

// 弦の材質 — each profile reshapes the string loop: how long it rings (decayMul),
// how bright the harmonic decay is (toneAdd → loop damping), how inharmonic/stiff it is
// (k → an allpass in the loop that stretches partials), and how hard the pluck attacks
// (soft → excitation lowpass). Colours tint the strings to match.
export const MATERIALS = [
  { name: "桐",     en: "paulownia", decayMul: 0.72, toneAdd: -0.18, k: 0.0,   soft: 0.5,  core: "#ffcf6e", edge: "#8a5a26", glow: "#ffb44a" },
  { name: "ナイロン", en: "nylon",     decayMul: 0.9,  toneAdd: -0.08, k: 0.015, soft: 0.6,  core: "#f2ead0", edge: "#9a8f66", glow: "#f0dfa0" },
  { name: "スチール", en: "steel",     decayMul: 1.45, toneAdd: 0.15,  k: 0.05,  soft: 0.12, core: "#e2ecf6", edge: "#6b7a8a", glow: "#aecdf0" },
  { name: "ガラス",  en: "glass",     decayMul: 1.7,  toneAdd: 0.28,  k: 0.13,  soft: 0.03, core: "#c2f0ff", edge: "#4f9fb0", glow: "#8fe6ff" },
];

// 胴鳴りの共鳴モード [freq, Q, gain]
// air/Helmholtz → top plate → higher body modes
export const BODY_MODES = [
  [110, 15, 1.0], [210, 13, 0.95], [400, 11, 0.8],
  [640, 10, 0.62], [1150, 9, 0.46], [2200, 8, 0.32],
];

export const KEYS = "asdfghjkl;'";

export const AUTOPLAY_PATTERNS = [
  [0, 2, 4, 6, 4, 2],
  [0, 3, 5, 7, 9, 7, 5, 3],
  [7, 5, 3, 1, 3, 5],
  [0, 4, 2, 6, 4, 8, 6, 10],
];
export const AUTOPLAY_INTERVAL_MS = 260;
