// エントリポイント — 各モジュールの初期化と resize / boot
import { buildStrings, layout } from './instrument.js';
import { initRenderer, resizeRenderer, startRenderLoop } from './render.js';
import { setupPointer, setupKeyboard } from './input.js';
import { setupMidi } from './midi.js';
import { setupUI } from './ui.js';

const cv = document.getElementById('c');
initRenderer(cv);

function resize() {
  resizeRenderer();
  layout();
}
addEventListener('resize', resize);

resize();
buildStrings();
setupUI();
setupPointer(cv);
setupKeyboard();
setupMidi(document.getElementById('midi'));
startRenderLoop();

// コンソールはチップ生成や折り返しで高さが変わるので、変化のたびに描画領域を再計算する
if (window.ResizeObserver) {
  new ResizeObserver(resize).observe(document.getElementById('console'));
}
