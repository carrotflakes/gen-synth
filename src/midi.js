// MIDI input (Web MIDI) — ノートオンを受けて弦をフレット演奏する
import { state } from './state.js';
import { noteFreq } from './music.js';
import { playString } from './instrument.js';
import { ensureAudio } from './audio/engine.js';

// highest string at or below the note (fret up from it)
function frettedBase(note) {
  let b = 0;
  for (let i = 0; i < state.strings.length; i++) { if (state.strings[i].midi <= note) b = i; }
  return b;
}

function onMidi(e) {
  const d = e.data; if (!d || d.length < 2) return;
  const cmd = d[0] & 0xf0, note = d[1], v = d[2] || 0;
  if (cmd === 0x90 && v > 0) {
    const i = frettedBase(note);
    const freq = noteFreq(note);                 // exact target pitch (tuning-aware, chromatic via fretting)
    playString(i, freq, Math.max(0.05, v / 127));
  }
  // note-off ignored — a plucked string rings out on its own
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
