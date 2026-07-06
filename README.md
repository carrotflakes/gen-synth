# 絃 GEN — 物理モデル弦楽器

Karplus–Strong 合成による撥弦楽器の Web アプリ。ノイズの励起を遅延線とフィルタのループに通す digital waveguide で弦の振動を模し、胴鳴り(モーダル共鳴)・共鳴弦・残響を重ねる。

クリック / タップ / なぞりで撥弦。キーボード(`A S D F ...`)や Web MIDI 入力にも対応。

## 実行方法

ES Modules を使っているため、HTTP サーバー経由で開く(`file://` では動かない):

```sh
npx serve
# または
python3 -m http.server
```

ブラウザで `http://localhost:8000`(または表示されたポート)を開く。ビルドは不要。

## 構成

```
index.html            マークアップ
style.css             スタイル
src/
  main.js             エントリポイント(初期化・resize)
  config.js           定数(音階・材質・胴モード・自動演奏パターン)
  state.js            実行時状態の集約(パラメータ・弦・ビュー)
  music.js            音律(平均律 / 純正律)と周波数変換
  instrument.js       楽器モデル(弦の構築・撥弦・共鳴カップリング)
  render.js           Canvas 描画ループ
  input.js            ポインタ / キーボード入力
  midi.js             Web MIDI 入力
  ui.js               コンソール UI(スライダー・チップ・自動演奏)
  audio/
    dsp.js            Karplus-Strong DSP(純粋関数・共有コード)
    ks-processor.js   AudioWorklet プロセッサ
    engine.js         オーディオグラフ(胴鳴り・共鳴弦・残響)と発音の入口
```

音声合成は AudioWorklet(オーディオスレッド)で行い、worklet が使えない環境では同じ DSP(`dsp.js`)を ScriptProcessorNode でフォールバック実行する。
