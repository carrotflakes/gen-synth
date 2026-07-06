// Canvas 描画 — 弦・撥弦の光・フレット表示のフレームループ
import { state, currentMaterial } from './state.js';

let cv = null, ctx2d = null;

export const stringTop = () => state.view.H * 0.10;
export const stringBot = () => state.view.H * 0.90;

export function initRenderer(canvas) {
  cv = canvas;
  ctx2d = canvas.getContext('2d');
}

export function resizeRenderer() {
  const v = state.view;
  v.DPR = Math.min(2, window.devicePixelRatio || 1);
  v.W = innerWidth; v.H = innerHeight;
  cv.width = v.W * v.DPR; cv.height = v.H * v.DPR;
  ctx2d.setTransform(v.DPR, 0, 0, v.DPR, 0, 0);
}

export function startRenderLoop() {
  requestAnimationFrame(frame);
}

function frame() {
  const now = performance.now() / 1000;
  const { W, H } = state.view;
  const MAT = currentMaterial();
  const ripples = state.ripples;

  // backdrop
  const g = ctx2d.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#181209'); g.addColorStop(.5, '#14100c'); g.addColorStop(1, '#0e0b07');
  ctx2d.fillStyle = g; ctx2d.fillRect(0, 0, W, H);

  const top = stringTop(), bot = stringBot();

  // pluck blooms
  ctx2d.globalCompositeOperation = 'lighter';
  for (let k = ripples.length - 1; k >= 0; k--) {
    const r = ripples[k]; r.r += 6; r.a *= 0.90;
    if (r.a < 0.02) { ripples.splice(k, 1); continue; }
    const rg = ctx2d.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.r);
    rg.addColorStop(0, `rgba(255,150,70,${r.a * 0.5})`);
    rg.addColorStop(1, 'rgba(255,150,70,0)');
    ctx2d.fillStyle = rg; ctx2d.beginPath(); ctx2d.arc(r.x, r.y, r.r, 0, 6.2832); ctx2d.fill();
  }
  ctx2d.globalCompositeOperation = 'source-over';

  // strings — 振幅は音声エンジンが返す実 RMS (s.level) から作るので、
  // 共鳴で本当に振動している弦だけが震える
  const base = Math.min(46, W * 0.06);
  for (const s of state.strings) {
    const target = base * Math.min(1, Math.pow((s.level || 0) * 5, 0.65));  // 弱い共鳴も見えるよう圧縮
    s.amp += (target - s.amp) * 0.25;
    const active = s.amp > 0.4;
    const disp = active ? s.amp * Math.sin(2 * Math.PI * s.wv * now + s.phase) : 0;
    const fr = active ? s.fret : 0;                 // fretted fraction (0 = open, whole string)

    // glow layer when ringing
    if (active) {
      ctx2d.globalCompositeOperation = 'lighter';
      ctx2d.strokeStyle = MAT.glow || `rgba(255,180,90,${Math.min(0.5, s.amp / 40)})`;
      ctx2d.globalAlpha = Math.min(0.5, s.amp / 40);
      ctx2d.lineWidth = 6; ctx2d.beginPath();
      drawString(s.x, top, bot, disp, fr);
      ctx2d.stroke(); ctx2d.globalAlpha = 1;
      ctx2d.globalCompositeOperation = 'source-over';
    }
    // the string itself
    const grad = ctx2d.createLinearGradient(s.x - 6, 0, s.x + 6, 0);
    grad.addColorStop(0, MAT.edge); grad.addColorStop(.5, MAT.core); grad.addColorStop(1, MAT.edge);
    ctx2d.strokeStyle = active ? MAT.core : grad;
    ctx2d.lineWidth = active ? 1.8 : 1.1;
    ctx2d.beginPath(); drawString(s.x, top, bot, disp, fr); ctx2d.stroke();

    // finger stopping the string (fretted note)
    if (fr > 0.001) {
      const fy = top + (bot - top) * fr;
      ctx2d.fillStyle = MAT.core;
      ctx2d.beginPath(); ctx2d.arc(s.x, fy, 4.5, 0, 6.2832); ctx2d.fill();
      ctx2d.globalAlpha = 0.35; ctx2d.beginPath(); ctx2d.arc(s.x, fy, 8, 0, 6.2832); ctx2d.fill(); ctx2d.globalAlpha = 1;
    }

    // anchors
    ctx2d.fillStyle = '#5a4a30';
    ctx2d.fillRect(s.x - 4, top - 3, 8, 3); ctx2d.fillRect(s.x - 4, bot, 8, 3);

    // note label
    ctx2d.fillStyle = active ? '#ffcf6e' : '#6f6552';
    ctx2d.font = '10px ui-monospace,Menlo,monospace';
    ctx2d.textAlign = 'center';
    ctx2d.fillText(s.name, s.x, bot + 18);
  }
  requestAnimationFrame(frame);
}

function drawString(x, top, bot, disp, fret = 0) {
  ctx2d.moveTo(x, top);
  const seg = 20, span = Math.max(0.001, 1 - fret);
  for (let i = 1; i <= seg; i++) {
    const t = i / seg, y = top + (bot - top) * t;
    const shape = t < fret ? 0 : Math.sin(Math.PI * (t - fret) / span);  // only below the fret vibrates
    ctx2d.lineTo(x + disp * shape, y);
  }
}
