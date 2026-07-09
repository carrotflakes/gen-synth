// 画面上の鍵盤 — 音のボタンを生成し、ポインタ / 物理キーで発音する。
// フルートは単声なので、押している音が無くなったら消音する。
import { NOTES, KEYS } from './config.js';
import { noteOn, noteOff, ensureAudio } from './audio/engine.js';
import { dismissHint } from './ui.js';
import { stopSong } from './player.js';

const $ = id => document.getElementById(id);

export function setupKeyboard() {
  const kb = $('kb'), status = $('status'), noteOut = $('noteOut');
  const buttons = [];
  const held = new Set();   // 現在押されている音のインデックス(単声なので最後の 1 つが鳴る)

  function press(idx) {
    stopSong();   // 手動演奏が自動演奏より優先
    const [name, freq] = NOTES[idx];
    ensureAudio().then(() => { status.textContent = '演奏中は音を押し続けてください'; });
    noteOn(freq);
    noteOut.textContent = name + ' · ' + Math.round(freq) + ' Hz';
    buttons[idx].classList.add('on');
    held.add(idx);
    dismissHint();
  }
  function release(idx) {
    held.delete(idx);
    buttons[idx].classList.remove('on');
    if (held.size === 0) noteOff();
    else { const last = [...held].pop(); noteOn(NOTES[last][1]); }   // 残っている音へ戻す
  }

  NOTES.forEach(([name], idx) => {
    const b = document.createElement('button');
    b.className = 'key';
    b.textContent = name;
    b.addEventListener('pointerdown', e => { e.preventDefault(); press(idx); });
    b.addEventListener('pointerup', () => release(idx));
    b.addEventListener('pointerleave', () => { if (held.has(idx)) release(idx); });
    b.addEventListener('pointercancel', () => release(idx));
    buttons.push(b);
    kb.appendChild(b);
  });

  // 物理キーボード(a s d f …)でも鳴らす
  addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = KEYS.indexOf(e.key.toLowerCase());
    if (k >= 0 && k < NOTES.length && !held.has(k)) press(k);
  });
  addEventListener('keyup', e => {
    const k = KEYS.indexOf(e.key.toLowerCase());
    if (k >= 0 && k < NOTES.length && held.has(k)) release(k);
  });
}
