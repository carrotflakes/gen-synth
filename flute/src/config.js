// 定数定義 — 音名・スライダーの仕様など、実行中に変化しない値

// 鍵盤の音(音名と周波数 Hz)
export const NOTES = [
  ["C5", 523.25], ["D5", 587.33], ["E5", 659.26], ["F5", 698.46], ["G5", 783.99],
  ["A5", 880.00], ["B5", 987.77], ["C6", 1046.50], ["D6", 1174.66], ["E6", 1318.51],
];

// 鍵盤に割り当てる物理キー(NOTES と同じ並び)
export const KEYS = "asdfghjkl;";

// スライダー — id は HTML の要素 id、param は Flute のパラメータ名、
// value は raw 値で、param には value/100 を渡す(dsp 側の 0..1 付近の値域に合わせる)。
export const CONTROLS = [
  { id: "breath", label: "息のノイズ", min: 0,  max: 30,  value: 8,  param: "breath" },
  { id: "vib",    label: "ビブラート", min: 0,  max: 100, value: 25, param: "vib" },
  { id: "jet",    label: "ジェット比", min: 20, max: 60,  value: 45, param: "jetRatio" },
  { id: "pres",   label: "息の強さ",   min: 60, max: 120, value: 95, param: "maxP" },
];
