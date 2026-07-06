// Karplus-Strong の DSP 本体。
// AudioWorklet (ks-processor.js) と ScriptProcessor フォールバック (engine.js) の
// 両方から使う純粋関数のみを置く — DOM や AudioContext には依存しないこと。

export const MAX_VOICES = 24;

// Build one Karplus-Strong voice (excitation is tiny: tens–hundreds of samples).
export function makeVoice(m, sampleRate) {
  const N = Math.max(2, Math.round(sampleRate / m.freq));
  const T60 = 0.28 * Math.pow(48, m.decay) * m.decayMul;
  const g = Math.min(0.99995, Math.pow(10, -3 / (m.freq * T60)));
  const S = Math.max(0, Math.min(1, 0.5 + 0.49 * (m.tone + m.toneAdd)));
  const noise = new Float32Array(N);
  for (let i = 0; i < N; i++) noise[i] = Math.random() * 2 - 1;
  const d = Math.max(1, Math.round(m.pos * N));
  const line = new Float32Array(N); let peak = 1e-6;
  for (let i = 0; i < N; i++) { line[i] = noise[i] - noise[(i + d) % N]; peak = Math.max(peak, Math.abs(line[i])); }
  if (m.soft > 0) {                             // soften the pluck attack (material)
    let yp = 0;
    for (let i = 0; i < N; i++) { yp = m.soft * yp + (1 - m.soft) * line[i]; line[i] = yp; }
    peak = 1e-6; for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(line[i]));
  }
  const sc = 0.5 * m.vel / peak;
  for (let i = 0; i < N; i++) line[i] *= sc;
  return { line, N, idx: 0, S, g, k: m.k, apx: 0, apy: 0, gL: m.gL, gR: m.gR };
}

export function addVoice(voices, voice) {
  voices.push(voice);
  if (voices.length > MAX_VOICES) voices.shift();
}

// Render every voice into the stereo block L/R (adds in place, reaps silent voices).
export function renderVoices(voices, L, R) {
  L.fill(0); if (R !== L) R.fill(0);
  for (let v = voices.length - 1; v >= 0; v--) {
    const vo = voices[v], line = vo.line, N = vo.N, S = vo.S, g = vo.g, k = vo.k, gL = vo.gL, gR = vo.gR;
    let idx = vo.idx, apx = vo.apx, apy = vo.apy, e = 0;
    for (let i = 0; i < L.length; i++) {
      const cur = line[idx];
      const nxt = line[idx + 1 >= N ? 0 : idx + 1];
      const lp = S * cur + (1 - S) * 0.5 * (cur + nxt);   // damping lowpass
      const ap = k * lp + apx - k * apy;                  // allpass → inharmonicity (stiffness)
      apx = lp; apy = ap;
      line[idx] = ap * g;
      L[i] += cur * gL; R[i] += cur * gR; e += cur * cur;
      idx++; if (idx >= N) idx = 0;
    }
    vo.idx = idx; vo.apx = apx; vo.apy = apy;
    if (e / L.length < 2e-8) voices.splice(v, 1);         // reap silent voices
  }
}
