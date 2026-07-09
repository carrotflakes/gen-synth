// MIDI input (Web MIDI) — ノートオン/オフを受けてフルートを吹鳴する。
// フルートは単声の持続音なので、押されているノートを順に覚えておき、
// 最後に押した音が鳴る。離したら残っている音へ戻り、全部離すと消音。
// 音高は MIDI ノート番号から直接周波数を出すので、画面の鍵盤に無い半音も鳴る。
import { NOTES } from './config.js';
import { noteOn, noteOff, ensureAudio } from './audio/engine.js';
import { stopSong } from './player.js';

const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
const NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const noteName = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);

const held = [];     // 押されている音 {note, vel}(押した順)
let litKey = null;   // 点灯中の画面鍵盤

// 画面鍵盤に同じ音があれば点灯する(半音など鍵盤に無い音は消灯のみ)
function lightKey(freq) {
  if (litKey) litKey.classList.remove('on');
  litKey = null;
  if (freq > 0) {
    const idx = NOTES.findIndex(([, f]) => Math.abs(f - freq) < 1);
    if (idx >= 0) litKey = document.querySelectorAll('#kb .key')[idx] || null;
    if (litKey) litKey.classList.add('on');
  }
}

function sound(note, vel) {
  const freq = midiToFreq(note);
  noteOn(freq, vel);
  lightKey(freq);
  const out = document.getElementById('noteOut');
  if (out) out.textContent = noteName(note) + ' · ' + Math.round(freq) + ' Hz';
}

function onMidi(e) {
  const d = e.data; if (!d || d.length < 2) return;
  const cmd = d[0] & 0xf0, note = d[1], v = d[2] || 0;
  if (cmd === 0x90 && v > 0) {
    stopSong();   // 手動演奏が自動演奏より優先
    // ベロシティ → 息の強さ。弱すぎると発振しないので 0.45 を下限にする。
    const vel = 0.45 + 0.55 * (v / 127);
    const i = held.findIndex(h => h.note === note);
    if (i >= 0) held.splice(i, 1);
    held.push({ note, vel });
    sound(note, vel);
  } else if (cmd === 0x80 || (cmd === 0x90 && v === 0)) {
    const i = held.findIndex(h => h.note === note);
    if (i < 0) return;
    held.splice(i, 1);
    if (held.length === 0) { noteOff(); lightKey(0); }
    else if (i === held.length) {   // 鳴っていた音を離した → 残りへ戻す
      const h = held[held.length - 1];
      sound(h.note, h.vel);
    }
  }
}

export function setupMidi(btn) {
  function midiBtn(count) {
    btn.setAttribute('aria-pressed', count > 0);
    btn.textContent = count > 0 ? ('MIDI ●' + (count > 1 ? ' ×' + count : '')) : 'MIDI 未検出';
  }
  function bindInputs(access) {
    let n = 0; access.inputs.forEach(inp => { inp.onmidimessage = onMidi; n++; }); return n;
  }
  btn.onclick = () => {
    if (!navigator.requestMIDIAccess) { btn.textContent = 'MIDI非対応'; return; }
    ensureAudio();
    navigator.requestMIDIAccess().then(access => {
      midiBtn(bindInputs(access));
      access.onstatechange = () => midiBtn(bindInputs(access));   // catch hot-plugged devices
    }, () => { btn.textContent = 'MIDI拒否'; });
  };
}
