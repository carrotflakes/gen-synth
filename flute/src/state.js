// 実行中に変化する状態の集約。各モジュールはここを読み書きする。
import { CONTROLS } from './config.js';

export const state = {
  freq: 440,           // 最後に発音した音の周波数

  // 合成パラメータ(スライダー)。CONTROLS の初期値 / 100 を既定値にする。
  P: Object.fromEntries(CONTROLS.map(c => [c.param, c.value / 100])),
};
