// エントリポイント — UI と鍵盤と自動演奏と MIDI の初期化
import { setupUI } from './ui.js';
import { setupKeyboard } from './keyboard.js';
import { setupPlayer } from './player.js';
import { setupMidi } from './midi.js';

setupUI();
setupKeyboard();
setupPlayer();
setupMidi(document.getElementById('midi'));
