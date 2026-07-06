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
