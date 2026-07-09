// ウェーブガイド・フルート — 管(bore)とジェット(jet)を遅延線でモデル化した
// 単声のシミュレーション。息の圧力がエッジのジェットを励起し、管の共鳴と
// 相互作用して自励振動が育つ。撥弦の StringBank と同じく、DOM / AudioContext に
// 依存しない純粋モジュールとして書き、AudioWorklet (flute-processor.js) と
// ScriptProcessor フォールバック (engine.js) の両方から使う。

const LEN = 8192;   // 遅延線バッファ長(2 のべき乗、freq の下限を決める)

export class Flute {
  constructor(sampleRate) {
    this.sr = sampleRate;
    this.bore = new Float32Array(LEN);   // 管(bore)の遅延線
    this.jetd = new Float32Array(LEN);   // ジェットの遅延線
    this.bi = 0; this.ji = 0;            // それぞれの書き込み位置
    this.lp = 0; this.dcx = 0; this.dcy = 0;   // 反射端のローパス + DC 除去の状態
    this.env = 0; this.target = 0;       // 息のエンベロープ(現在値 / 目標値)
    this.freq = 440;
    // レガート時の管長切り替え — 旧管長のタップと新管長のタップを短時間
    // クロスフェードする(トーンホール開閉で一瞬 2 つの共鳴が共存する状態の模擬)。
    this.prevFreq = 440; this.xf = 1;    // xf: 0(旧のみ) → 1(新のみ)
    this.vphase = 0;                     // ビブラート LFO の位相
    // 音色パラメータ(setParams で更新)。値域は engine 側で 0..1 付近に正規化済み。
    this.params = { breath: 0.08, vib: 0.25, jetRatio: 0.45, maxP: 0.95 };
  }

  // ---- port メッセージ({t:'note'|'off'|'setParams', ...})に対応するメソッド ----

  // 発音開始。freq を設定し息を立ち上げる。
  // 既に鳴っている最中(レガート)は旧管長を覚えておき、process 内で
  // 旧 → 新のタップをクロスフェードして繋ぐ。無音からは即座に切り替える。
  // m.vel(0..1、省略時 1)は息の強さ — エンベロープの目標値として圧力に効く。
  note(m) {
    if (this.env >= 0.01 && m.freq !== this.freq) {
      this.prevFreq = this.freq;
      this.xf = 0;
    } else {
      this.xf = 1;
    }
    this.freq = m.freq;
    this.target = m.vel ?? 1;
  }

  // 発音停止(息を下げる。管の共鳴は自然に減衰する)。
  off() { this.target = 0; }

  // m.params: {breath, vib, jetRatio, maxP}(部分更新可)。鳴っている最中にも効く。
  setParams(m) { Object.assign(this.params, m.params); }

  // 遅延線 buf から len サンプル前の値を線形補間で読む(端数遅延に対応)。
  readDelay(buf, writeIdx, len) {
    const ri = writeIdx - len;
    const i0 = Math.floor(ri), frac = ri - i0;
    const a = buf[(i0 + LEN) % LEN];
    const b = buf[(i0 + 1 + LEN) % LEN];
    return a + frac * (b - a);
  }

  // 1 ブロック合成して out(モノラル)に書き込む(上書き)。
  process(out) {
    const sr = this.sr, p = this.params;
    for (let i = 0; i < out.length; i++) {
      // 息のエンベロープ — 立ち上がりはゆっくり、離鍵はやや速く
      const rate = this.target > this.env ? 0.0008 : 0.0025;
      this.env += (this.target - this.env) * rate;
      // ビブラート(≈5.2Hz)
      this.vphase += 2 * Math.PI * 5.2 / sr;
      if (this.vphase > 2 * Math.PI) this.vphase -= 2 * Math.PI;
      const vibAmt = Math.sin(this.vphase) * p.vib * 0.02;

      const boreLen = Math.min(8000, Math.max(4, sr / this.freq - 2));
      const jetLen = Math.max(2, boreLen * p.jetRatio);
      const noise = (Math.random() * 2 - 1) * p.breath;
      const bp = p.maxP * this.env * (1 + noise + vibAmt) * 0.9;   // エッジに当たる息の圧力

      // 管の端からの反射 — ローパスで丸め、DC 成分を抜く。
      // レガート直後は旧管長のタップと等パワーでクロスフェード(≈25ms)。
      let boreOut = this.readDelay(this.bore, this.bi, boreLen);
      if (this.xf < 1) {
        this.xf = Math.min(1, this.xf + 1 / (0.025 * sr));
        const oldLen = Math.min(8000, Math.max(4, sr / this.prevFreq - 2));
        const oldOut = this.readDelay(this.bore, this.bi, oldLen);
        const g = this.xf * Math.PI / 2;
        boreOut = oldOut * Math.cos(g) + boreOut * Math.sin(g);
      }
      this.lp += 0.55 * (boreOut - this.lp);
      this.dcy = this.lp - this.dcx + 0.995 * this.dcy;
      this.dcx = this.lp;
      const refl = this.dcy;

      // ジェット遅延 → 非線形飽和(x·(x²−1) を [-1,1] にクリップ)
      const pdiff = bp - 0.5 * refl;
      this.jetd[this.ji] = pdiff;
      this.ji = (this.ji + 1) % LEN;
      let jx = this.readDelay(this.jetd, this.ji, jetLen);
      let jet = jx * (jx * jx - 1);
      if (jet > 1) jet = 1; else if (jet < -1) jet = -1;

      // ジェットの寄与と反射を管へ戻す
      this.bore[this.bi] = jet + 0.5 * refl;
      this.bi = (this.bi + 1) % LEN;

      out[i] = boreOut * 0.4;
    }
  }
}
