// 音楽理論 — MIDI ノート番号と周波数の変換(平均律 / 純正律)
import { ROOT, JI } from './config.js';
import { state } from './state.js';

export function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

const rootFreq = midiToFreq(ROOT);

// respects current tuning; tonic + octaves stay fixed
export function noteFreq(m) {
  if (state.tuning === 'et') return midiToFreq(m);
  const rel = m - ROOT, oct = Math.floor(rel / 12), pc = ((rel % 12) + 12) % 12;
  return rootFreq * Math.pow(2, oct) * JI[pc];
}
