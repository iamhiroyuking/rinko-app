# OG画像の作り直し方

リンクを貼ったときに出る画像（`public/og-image.jpg`）の元は
[og-image.svg](og-image.svg)。SVGのままだとクローラが描画しないので、
ラスタにして `public/` へ置く。

## 手順

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --screenshot=/tmp/og.png --window-size=1200,630 \
  "file://$PWD/docs/og-image.svg"

sips -s format jpeg -s formatOptions 88 /tmp/og.png --out public/og-image.jpg
```

## 決めごと

**中央の正方形からはみ出さないこと。**

受け取る側のアプリ（LINE・Slackなど）は、この画像を**正方形に切って**小さく
出すことがある。どこを切るかは向こうが決めるので、こちらからは指定できないし、
**相手の機種を知る方法も無い**。1枚の画像で全部に対応するには、
大事なものを中央の正方形に収めておくしかない。

そのため中身は横 285〜915（＝高さと同じ630の正方形）に収めてある。
横に広げると、iPhoneのトーク画面で右側が落ちる。実際に落とした。

**変換に `qlmanage` は使えない。** 正方形に潰されて、右が切れる。
ヘッドレスのChromeなら指定した比率のまま描ける。

**JPEGにする。** 背景がグラデーションなのでPNGだと大きい（328KB→64KB）。

**SVGのコメントに `--` を書かないこと。** XMLのコメントには入れられない決まりで、
書くとファイルごと壊れる。コマンドをこのファイルに置いているのはそのため。
