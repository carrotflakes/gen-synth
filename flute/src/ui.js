// コンソール UI — スライダー(息のノイズ・ビブラート・ジェット比・息の強さ)
import { CONTROLS } from './config.js';
import { state } from './state.js';
import { syncParams } from './audio/engine.js';

const $ = id => document.getElementById(id);

export function dismissHint() {
  const h = $('hint');
  if (h && !h.classList.contains('gone')) h.classList.add('gone');
}

// スライダーは全て Flute のパラメータ。入力ごとに state.P を更新して worklet に送る
// (鳴っている最中の音にも即座に効く)。
function setupSliders() {
  for (const c of CONTROLS) {
    const el = $(c.id), out = $(c.id + 'Out');
    el.oninput = () => {
      state.P[c.param] = +el.value / 100;
      out.textContent = el.value + '%';
      syncParams();
    };
    out.textContent = el.value + '%';
  }
}

export function setupUI() {
  setupSliders();
  $('hint').onclick = dismissHint;
}
