// ポインタ(マウス / タッチ)とキーボードによる撥弦
import { KEYS } from './config.js';
import { state } from './state.js';
import { pluck } from './instrument.js';
import { dismissHint } from './ui.js';

function nearest(px) {
  let best = 0, bd = 1e9;
  state.strings.forEach((s, i) => { const dd = Math.abs(s.x - px); if (dd < bd) { bd = dd; best = i; } });
  return { i: best, d: bd };
}

export function setupPointer(cv) {
  let down = false, lastIdx = -1, lastX = 0, lastT = 0;
  function pos(e) {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  }
  function onDown(e) {
    e.preventDefault(); down = true; dismissHint();
    const p = pos(e); lastX = p.x; lastT = performance.now();
    const n = nearest(p.x); if (n.d < 34) { pluck(n.i, 1); lastIdx = n.i; }
  }
  function onMove(e) {
    if (!down) return; e.preventDefault();
    const p = pos(e), t = performance.now();
    const n = nearest(p.x);
    if (n.d < 34 && n.i !== lastIdx) {
      const dt = Math.max(8, t - lastT), spd = Math.abs(p.x - lastX) / dt;
      pluck(n.i, Math.min(1, 0.45 + spd * 0.5)); lastIdx = n.i;
    }
    lastX = p.x; lastT = t;
  }
  function onUp() { down = false; lastIdx = -1; }
  cv.addEventListener('mousedown', onDown); addEventListener('mousemove', onMove); addEventListener('mouseup', onUp);
  cv.addEventListener('touchstart', onDown, { passive: false });
  cv.addEventListener('touchmove', onMove, { passive: false });
  addEventListener('touchend', onUp);
}

export function setupKeyboard() {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = KEYS.indexOf(e.key.toLowerCase());
    if (k >= 0 && k < state.strings.length) { pluck(k, 0.95); dismissHint(); }
  });
}
