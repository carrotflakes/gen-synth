// Karplus-Strong string bank — 弦一本一本を常駐の digital waveguide として保持する。
// 撥弦は「ボイス生成」ではなく該当する弦の遅延線への励起注入なので、同じ弦の
// 連打は 1 本の弦として繋がる。全弦の出力はブリッジ(bridge)で足し合わされ、
// その一部が各弦の遅延線に還流する — 倍音が一致する弦だけが実際に振動し始める
// (共鳴弦)。共鳴音は各弦固有の定位 gL/gR で鳴る。
//
// AudioWorklet (ks-processor.js) と ScriptProcessor フォールバック (engine.js) の
// 両方から使う。DOM や AudioContext には依存しないこと。

// ブリッジ結合の最大強度(共鳴パラメータ symp=1 のときの β)。
// 各弦の書き戻しからブリッジ平均を引く: x_i − (β/n)Σx。結合行列
// I − (β/n)J は対称で固有値が {1−β(同相), 1, …, 1} なので、β ≤ 2 なら
// ノルム ≤ 1 — ループゲイン g < 1 と合わせて構造的に発振できない。
// 符号が重要: +(β/n)Σ だと同相モードの固有値が 1+(n−1)β/n を超えて発散する
// (物理的にもブリッジの反射は反転)。
//
// ソース弦自身の損失は β/n / 周期で、他弦への転送量と同じオーダー。
// 以前使っていた Householder ブレンド接合は転送量の n 倍の損失を与えるため
// ループゲイン補償が必要で、長い減衰では補償が上限に当たって音が縮んでいた。
// この形なら補償なしで減衰時間がほぼ保たれる。
const COUPLING = 0.08;
const GMAX = 0.99995;

// 撥弦時に既存の振動へ掛ける減衰 — 指や爪が触れた瞬間、前の振動は一部止まる
const TOUCH_DAMP = 0.35;

// ミュート(掌で弦を抑える)中にループゲインへ掛ける追加減衰。
// ループゲイン g と同じく「弦ループ 1 周あたり」の係数なので、サンプル単位より
// ずっと強い値が要る: 0.5 なら 110Hz の弦で T60 ≈ 90ms、高い弦ほど速く消える
// (周回が速いぶん物理的にもそうなる)。遅延線は生きているので、抑えたまま
// 弾くとスタッカートになる。
const MUTE_G = 0.5;

const clamp01 = v => Math.max(0, Math.min(1, v));

export class StringBank {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.strings = [];
    this.params = { decay: 0.62, tone: 0.5, pos: 0.22, symp: 0.4, decayMul: 1, toneAdd: 0, k: 0, soft: 0 };
    this.levels = new Float32Array(0);
    this.tns = new Float32Array(0);   // per-sample scratch: filtered loop signal of each string
    this.c = 0;                       // effective bridge blend
    this.muteG = 1;                   // 1 = open, MUTE_G = palm-muted
  }

  // m.on: 全弦を抑える / 離す。抑えている間だけ減衰が速くなる。
  mute(m) { this.muteG = m.on ? MUTE_G : 1; }

  // 弦の張り替え(初期化・音階/調律/複弦の変更)。遅延線は作り直される。
  // m.strings: [{freq, gL, gR}]
  setup(m) {
    this.strings = m.strings.map(d => ({
      openFreq: d.freq, freq: d.freq,
      line: new Float32Array(Math.ceil(this.sr / d.freq) + 2),
      N: 2, idx: 0,
      apx: 0, apy: 0,   // stiffness allpass state
      tx: 0, ty: 0,     // tuning allpass state
      S: 0.5, g: 0.99, k: 0, ta: 0, velTone: 0,
      gL: d.gL, gR: d.gR,
      energy: 0,
    }));
    this.levels = new Float32Array(this.strings.length);
    this.tns = new Float32Array(this.strings.length);
    this.c = this.params.symp * COUPLING;
    for (const s of this.strings) this.retune(s, s.openFreq);
  }

  // m.params: {decay, tone, pos, symp, decayMul, toneAdd, k, soft} (部分更新可)
  // 鳴っている最中の弦にも即座に効く。
  setParams(m) {
    Object.assign(this.params, m.params);
    this.c = this.params.symp * COUPLING;
    for (const s of this.strings) this.retune(s, s.freq);
  }

  // m.pans: [[gL, gR]] — 遅延線に触れず定位だけ更新する
  setPans(m) {
    m.pans.forEach(([gL, gR], i) => {
      const s = this.strings[i]; if (s) { s.gL = gL; s.gR = gR; }
    });
  }

  // ループ全体の遅延が sr/freq になるよう、整数の遅延線長 N と
  // 端数を受け持つチューニング用オールパス(ta)を決める。
  // 整数丸めのままだと数セントの誤差が出て、狭い共鳴帯域(数セント幅)から
  // 倍音が外れてしまい、弦同士がほとんど共鳴しなくなる。
  retune(s, freq) {
    const q = this.params;
    const T60 = 0.28 * Math.pow(48, q.decay) * q.decayMul;
    s.freq = freq;
    s.g = Math.min(GMAX, Math.pow(10, -3 / (freq * T60)));
    s.S = clamp01(0.5 + 0.49 * (q.tone + q.toneAdd + s.velTone));
    s.k = q.k;
    // ループ内フィルタの低域位相遅延を差し引いて遅延線に割り当てる:
    // 剛性オールパスは +(1−k)/(1+k)、減衰ローパスは新しい方の隣接サンプルを
    // 混ぜるぶん −(1−S)/2 サンプル。
    const D = Math.max(2.5, this.sr / freq - (1 - s.k) / (1 + s.k) + (1 - s.S) * 0.5);
    const N = Math.min(Math.floor(D - 0.5), s.line.length);
    const f = D - N;                 // fractional delay in [0.5, 1.5)
    s.N = N;
    s.ta = (1 - f) / (1 + f);
  }

  // 弦 i を撥く。freq > openFreq ならフレット奏法(遅延線を短くして高い音)。
  // m: {i, freq?, vel?}
  pluck(m) {
    const s = this.strings[m.i]; if (!s) return;
    const vel = m.vel ?? 1;
    const freq = Math.max(m.freq || s.openFreq, s.openFreq);  // fretting only raises pitch
    const oldN = s.N;
    s.velTone = (vel - 0.6) * 0.3;               // harder pluck → a little brighter
    this.retune(s, freq);
    const N = s.N, line = s.line, q = this.params;
    if (N > oldN) line.fill(0, oldN, N);         // 前のフレットで凍結していた区間を消す
    if (s.idx >= N) s.idx = 0;

    // excitation: comb-filtered noise (pluck position) + attack-softening lowpass
    // m.pos が来ればその撥弦だけ位置を上書き(ポインタの高さ由来)。無ければスライダー値。
    const pos = m.pos ?? q.pos;
    const noise = new Float32Array(N);
    for (let i = 0; i < N; i++) noise[i] = Math.random() * 2 - 1;
    const d = Math.max(1, Math.round(pos * N));
    const exc = new Float32Array(N); let peak = 1e-6;
    for (let i = 0; i < N; i++) { exc[i] = noise[i] - noise[(i + d) % N]; peak = Math.max(peak, Math.abs(exc[i])); }
    if (q.soft > 0) {
      let yp = 0;
      for (let i = 0; i < N; i++) { yp = q.soft * yp + (1 - q.soft) * exc[i]; exc[i] = yp; }
      peak = 1e-6; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(exc[i]));
    }
    const sc = 0.5 * vel / peak;
    for (let i = 0; i < N; i++) line[i] = line[i] * TOUCH_DAMP + exc[i] * sc;
  }

  // 1 ブロック合成して L/R に書き込む(上書き)。
  process(L, R) {
    L.fill(0); if (R !== L) R.fill(0);
    const SS = this.strings, c = this.c, n = SS.length, len = L.length;
    if (!n) return;
    const tns = this.tns, mg = this.muteG;
    for (let i = 0; i < len; i++) {
      // pass 1: 各弦のループ信号を読み、フィルタを通す
      let sum = 0;
      for (let m = 0; m < n; m++) {
        const s = SS[m], line = s.line, N = s.N, idx = s.idx;
        const cur = line[idx];
        const nxt = line[idx + 1 >= N ? 0 : idx + 1];
        const lp = s.S * cur + (1 - s.S) * 0.5 * (cur + nxt);   // damping lowpass
        const ap = s.k * lp + s.apx - s.k * s.apy;              // allpass → inharmonicity (stiffness)
        s.apx = lp; s.apy = ap;
        const tn = s.ta * ap + s.tx - s.ta * s.ty;              // fractional-delay tuning allpass
        s.tx = ap; s.ty = tn;
        tns[m] = tn; sum += tn;
        L[i] += cur * s.gL; R[i] += cur * s.gR;
        s.energy += cur * cur;
      }
      // pass 2: ブリッジ接合 x − (β/n)Σx を通して書き戻す
      const j = c * sum / n;
      for (let m = 0; m < n; m++) {
        const s = SS[m];
        s.line[s.idx] = s.g * mg * (tns[m] - j);
        s.idx = s.idx + 1 >= s.N ? 0 : s.idx + 1;
      }
    }
  }

  // 前回呼び出し以降の各弦の RMS(描画用)。呼ぶとエネルギー積算はリセットされる。
  takeLevels(nSamples) {
    for (let m = 0; m < this.strings.length; m++) {
      const s = this.strings[m];
      this.levels[m] = Math.sqrt(s.energy / nSamples);
      s.energy = 0;
    }
    return this.levels;
  }
}
