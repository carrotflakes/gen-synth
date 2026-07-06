// 実行中に変化する状態の集約。各モジュールはここを読み書きする。
import { MATERIALS } from './config.js';

export const state = {
  scaleName: "陽 pentatonic",
  mat: 2,                 // default: スチール
  panWidth: 0.85,         // pitch → stereo position (0 = mono, on by default)
  courseOn: false,        // 複弦: double each note with a detuned partner
  tuning: 'et',           // 'et' equal temperament | 'ji' just intonation

  strings: [],            // {freq,midi,name,x, amp,amp0,t0,tau,fret,wv,phase}
  ripples: [],            // pluck blooms on the canvas

  // synthesis / effects parameters (sliders)
  P: { decay: 0.62, tone: 0.5, pos: 0.22, rev: 0.34, body: 0.5, size: 0.5, symp: 0.4 },

  view: { W: 0, H: 0, DPR: 1 },
};

export const currentMaterial = () => MATERIALS[state.mat];
