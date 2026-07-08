// ポインタ(マウス / タッチ)とキーボードによる撥弦
import { KEYS } from './config.js';
import { state } from './state.js';
import { pluck } from './instrument.js';
import { setMute } from './audio/engine.js';
import { dismissHint } from './ui.js';

function nearest(px) {
  let best = 0, bd = 1e9;
  state.strings.forEach((s, i) => { const dd = Math.abs(s.x - px); if (dd < bd) { bd = dd; best = i; } });
  return { i: best, d: bd };
}

// ポインタの y を弦上の位置(0=上端, 1=下端)に変換 — 撥弦位置に使う
function fracY(y) {
  const { top, bot } = state.view;
  return (y - top) / (bot - top || 1);
}

export function setupPointer(cv) {
  // ポインタ(指/マウス/ペン)ごとに独立した状態を持ち、マルチタッチで同時撥弦できるようにする
  const active = new Map(); // pointerId -> { lastIdx, lastX, lastT }
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function onDown(e) {
    e.preventDefault(); dismissHint();
    const p = pos(e);
    const st = { lastIdx: -1, lastX: p.x, lastT: performance.now() };
    active.set(e.pointerId, st);
    const n = nearest(p.x); if (n.d < 34) { pluck(n.i, 1, fracY(p.y)); st.lastIdx = n.i; }
  }
  function onMove(e) {
    const st = active.get(e.pointerId); if (!st) return;
    e.preventDefault();
    const p = pos(e), t = performance.now();
    const n = nearest(p.x);
    if (n.d < 34 && n.i !== st.lastIdx) {
      const dt = Math.max(8, t - st.lastT), spd = Math.abs(p.x - st.lastX) / dt;
      pluck(n.i, Math.min(1, 0.45 + spd * 0.5), fracY(p.y)); st.lastIdx = n.i;
    }
    st.lastX = p.x; st.lastT = t;
  }
  function onUp(e) { active.delete(e.pointerId); }
  cv.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
}

export function setupKeyboard() {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Space') {
      e.preventDefault();          // フォーカス中のチップの誤クリックやスクロールを防ぐ
      setMute(true);               // 押している間、掌で全弦を抑える
      return;
    }
    const k = KEYS.indexOf(e.key.toLowerCase());
    if (k >= 0 && k < state.strings.length) { pluck(k, 0.95); dismissHint(); }
  });
  addEventListener('keyup', e => {
    if (e.code === 'Space') setMute(false);
  });
}
