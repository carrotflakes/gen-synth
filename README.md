# 絃 GEN — 物理モデル弦楽器

Karplus–Strong 合成による撥弦楽器の Web アプリ。15 本の弦それぞれを常駐の digital waveguide(遅延線 + フィルタのループ)としてシミュレートし、撥弦は弦への励起注入として扱う — 同じ弦を連打すれば前の振動と繋がり、全弦をつなぐブリッジ結合により倍音が一致する弦が実際に共鳴して各弦固有の定位で鳴る。胴鳴り(モーダル共鳴)と残響を重ねる。

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
    dsp.js            StringBank — 常駐 waveguide 弦バンク + ブリッジ結合(純粋・共有コード)
    ks-processor.js   AudioWorklet プロセッサ(StringBank の薄いラッパ)
    engine.js         オーディオグラフ(胴鳴り・残響)と弦バンクへのメッセージ
```

音声合成は AudioWorklet(オーディオスレッド)で行い、worklet が使えない環境では同じ `StringBank` を ScriptProcessorNode でフォールバック実行する。

## 弦のシミュレーション(audio/dsp.js)

- 弦ごとに遅延線・減衰ローパス・剛性オールパス(インハーモニシティ)・端数遅延のチューニングオールパスを持つループが常駐する。フレット奏法は遅延線長の動的変更。
- 弦間の共鳴はブリッジ接合で行う。恒等写像とエネルギー保存型の Householder 反射 `(2/n)Σ−x` のブレンドなので構造的に発振せず、接合が奪う損失はループゲイン側で補償して減衰時間を保つ(詳細は dsp.js のコメント)。
- 各弦の実 RMS を描画側に返しており、画面の弦の振動(共鳴の震えを含む)は音と一致する。

`dsp.js` は DOM / AudioContext 非依存の純粋モジュールなので、Node でそのまま数値検証できる。
