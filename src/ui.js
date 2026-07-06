// コンソール UI — スライダー・チップ(音階 / 材質 / オプション)・自動演奏・ヒント
import { SCALES, MATERIALS, AUTOPLAY_PATTERNS, AUTOPLAY_INTERVAL_MS } from './config.js';
import { state } from './state.js';
import { ensureAudio, syncParams, syncPans, syncStrings, setReverb, setBody, setSize } from './audio/engine.js';
import { buildStrings, pluck } from './instrument.js';

const $ = id => document.getElementById(id);

export function dismissHint() {
  const h = $('hint');
  if (h && !h.classList.contains('gone')) h.classList.add('gone');
}

function fmtPct(v) { return Math.round(v * 100) + '%'; }

function refresh() {
  const P = state.P;
  $('vDecay').textContent = fmtPct(P.decay);
  $('vTone').textContent = P.tone > 0.5 ? '明るい' : P.tone < 0.5 ? '暗い' : '標準';
  $('vPos').textContent = fmtPct(P.pos * 2);
  $('vRev').textContent = fmtPct(P.rev);
  $('vBody').textContent = fmtPct(P.body);
  $('vSize').textContent = P.size < 0.34 ? '小' : P.size > 0.66 ? '大' : '中';
  $('vSymp').textContent = fmtPct(P.symp);
}

function setupSliders() {
  const P = state.P;
  // decay/tone/pos/symp は弦バンクのループ係数なので、鳴っている弦にも即座に効く
  $('decay').oninput = e => { P.decay = +e.target.value; syncParams(); refresh(); };
  $('tone').oninput = e => { P.tone = +e.target.value; syncParams(); refresh(); };
  $('pos').oninput = e => { P.pos = +e.target.value; syncParams(); refresh(); };
  $('rev').oninput = e => { P.rev = +e.target.value; setReverb(P.rev); refresh(); };
  $('body').oninput = e => { P.body = +e.target.value; setBody(P.body); refresh(); };
  $('size').oninput = e => { P.size = +e.target.value; setSize(P.size); refresh(); };
  $('symp').oninput = e => { P.symp = +e.target.value; syncParams(); refresh(); };
}

function setupOptions() {
  $('pan').onclick = e => {
    const on = e.target.getAttribute('aria-pressed') !== 'true';
    e.target.setAttribute('aria-pressed', on); state.panWidth = on ? 0.85 : 0;
    syncPans();
  };
  $('course').onclick = e => {
    const on = e.target.getAttribute('aria-pressed') !== 'true';
    e.target.setAttribute('aria-pressed', on); state.courseOn = on;
    syncStrings();   // 相方の弦を張る / 外す
  };
  $('ji').onclick = e => {
    const on = e.target.getAttribute('aria-pressed') !== 'true';
    e.target.setAttribute('aria-pressed', on); state.tuning = on ? 'ji' : 'et';
    buildStrings();
  };
}

function setupScaleChips() {
  const sc = $('scales');
  Object.keys(SCALES).forEach(name => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = name.split(' ')[0];
    b.setAttribute('aria-pressed', name === state.scaleName);
    b.onclick = () => {
      state.scaleName = name; buildStrings();
      [...sc.children].forEach((c, i) => c.setAttribute('aria-pressed', Object.keys(SCALES)[i] === name));
    };
    sc.appendChild(b);
  });
}

function setupMaterialChips() {
  const mc = $('materials');
  MATERIALS.forEach((M, idx) => {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = M.name;
    b.setAttribute('aria-pressed', idx === state.mat);
    b.onclick = () => {
      state.mat = idx;
      syncParams();   // 材質は弦のループ係数なので、鳴っている弦の音色も変わる
      [...mc.children].forEach((c, i) => c.setAttribute('aria-pressed', i === idx));
    };
    mc.appendChild(b);
  });
}

// autoplay arpeggiator
function setupAutoplay() {
  let autoTimer = null, step = 0;
  let pat = AUTOPLAY_PATTERNS[0];
  $('auto').onclick = e => {
    const on = e.target.getAttribute('aria-pressed') === 'true';
    if (on) { clearInterval(autoTimer); autoTimer = null; e.target.setAttribute('aria-pressed', 'false'); }
    else {
      ensureAudio(); dismissHint();
      pat = AUTOPLAY_PATTERNS[Math.floor(Math.random() * AUTOPLAY_PATTERNS.length)]; step = 0;
      e.target.setAttribute('aria-pressed', 'true');
      autoTimer = setInterval(() => {
        const idx = pat[step % pat.length] % state.strings.length;
        pluck(idx, 0.55 + Math.random() * 0.35);
        if (Math.random() < 0.22) pluck((idx + 2) % state.strings.length, 0.4); // occasional harmony
        step++;
        if (step % (pat.length * 2) === 0) pat = AUTOPLAY_PATTERNS[Math.floor(Math.random() * AUTOPLAY_PATTERNS.length)];
      }, AUTOPLAY_INTERVAL_MS);
    }
  };
}

export function setupUI() {
  setupSliders();
  setupOptions();
  setupScaleChips();
  setupMaterialChips();
  setupAutoplay();
  $('hint').onclick = dismissHint;
  refresh();
}
