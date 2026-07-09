// 自動演奏 — 収録曲のシーケンスを noteOn/noteOff で再生する。
// 異なる音高への移行は noteOff を挟まずレガート(dsp 側の管長クロスフェード)で繋ぎ、
// 同じ音の連打だけ短いギャップを入れてタンギングを模す。
import { NOTES } from './config.js';
import { noteOn, noteOff, ensureAudio } from './audio/engine.js';
import { dismissHint } from './ui.js';

const $ = id => document.getElementById(id);

// notes: [NOTES のインデックス, 拍数] の列。インデックス -1 は休符(息継ぎ)。
// 音域は鍵盤と同じ C5..E6(0..9)。
export const SONGS = [
  {
    name: 'きらきら星', bpm: 104,
    notes: [
      [0,1],[0,1],[4,1],[4,1],[5,1],[5,1],[4,1.75],[-1,.25],
      [3,1],[3,1],[2,1],[2,1],[1,1],[1,1],[0,1.75],[-1,.25],
      [4,1],[4,1],[3,1],[3,1],[2,1],[2,1],[1,1.75],[-1,.25],
      [4,1],[4,1],[3,1],[3,1],[2,1],[2,1],[1,1.75],[-1,.25],
      [0,1],[0,1],[4,1],[4,1],[5,1],[5,1],[4,1.75],[-1,.25],
      [3,1],[3,1],[2,1],[2,1],[1,1],[1,1],[0,2],
    ],
  },
  {
    name: 'かえるのうた', bpm: 120,
    notes: [
      [0,1],[1,1],[2,1],[3,1],[2,1],[1,1],[0,1],[-1,1],
      [2,1],[3,1],[4,1],[5,1],[4,1],[3,1],[2,1],[-1,1],
      [0,1],[-1,1],[0,1],[-1,1],[0,1],[-1,1],[0,1],[-1,1],
      [0,.5],[0,.5],[1,.5],[1,.5],[2,.5],[2,.5],[3,.5],[3,.5],
      [2,1],[1,1],[0,1],[-1,1],
    ],
  },
  {
    name: 'よろこびの歌', bpm: 116,
    notes: [
      [2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1],
      [0,1],[0,1],[1,1],[2,1],[2,1.5],[1,.5],[1,1.75],[-1,.25],
      [2,1],[2,1],[3,1],[4,1],[4,1],[3,1],[2,1],[1,1],
      [0,1],[0,1],[1,1],[2,1],[1,1.5],[0,.5],[0,2],
    ],
  },
];

const GAP = 0.08;   // 同音連打・フレーズ末の消音ギャップ(秒)

let timers = [];         // 再生中の setTimeout id
let playingBtn = null;   // 再生中の曲ボタン(ハイライト用)
let litKey = null;       // 点灯中の鍵盤

function lightKey(idx) {
  if (litKey) litKey.classList.remove('on');
  litKey = idx >= 0 ? document.querySelectorAll('#kb .key')[idx] : null;
  if (litKey) litKey.classList.add('on');
}

export function stopSong() {
  if (!playingBtn) return;
  for (const t of timers) clearTimeout(t);
  timers = [];
  playingBtn.classList.remove('playing');
  playingBtn = null;
  lightKey(-1);
  noteOff();
}

function playSong(song, btn) {
  stopSong();
  playingBtn = btn;
  btn.classList.add('playing');
  dismissHint();

  const beat = 60 / song.bpm;
  const noteOut = $('noteOut'), status = $('status');
  status.textContent = '自動演奏中 — ' + song.name;

  ensureAudio().then(() => {
    if (playingBtn !== btn) return;   // 待っている間に停止された
    let t = 0.1;   // 開始までのわずかな余白(秒)
    const ev = song.notes;
    for (let i = 0; i < ev.length; i++) {
      const [idx, beats] = ev[i], dur = beats * beat;
      if (idx >= 0) {
        const [name, freq] = NOTES[idx];
        timers.push(setTimeout(() => {
          noteOn(freq);
          lightKey(idx);
          noteOut.textContent = name + ' · ' + Math.round(freq) + ' Hz';
        }, t * 1000));
        // 次が同じ音・休符・曲末なら消音してアタックを立て直す(レガートでは繋ぎっぱなし)
        const next = ev[i + 1];
        if (!next || next[0] === idx || next[0] < 0) {
          timers.push(setTimeout(noteOff, (t + Math.max(dur - GAP, dur * 0.5)) * 1000));
        }
      }
      t += dur;
    }
    timers.push(setTimeout(() => { stopSong(); status.textContent = '演奏おわり — 鍵盤でも吹けます'; }, (t + 0.3) * 1000));
  });
}

export function setupPlayer() {
  const box = $('songs');
  SONGS.forEach(song => {
    const b = document.createElement('button');
    b.className = 'song';
    b.textContent = '▸ ' + song.name;
    b.onclick = () => { if (playingBtn === b) stopSong(); else playSong(song, b); };
    box.appendChild(b);
  });
}
