# 横はみ出しの確認手順

スマホで「右側が見切れる」不具合は、**目で見ても気づきにくい**。実際に
BookSummaryView で見落とし、実機のスクリーンショットで初めて分かった
（2026-08-16）。数字で確かめる。

## やり方

開発サーバーを開き、確認したい幅にしてから、コンソールで次を実行する。

```js
await (async () => {
  const bookId = '<教材のid>'
  const unitId = '<回のid>'
  const routes = [
    ['/', '本棚'],
    [`/books/${bookId}`, '教材の概要'],
    [`/books/${bookId}/edit`, '教材を編集'],
    [`/books/${bookId}/units`, '回のリスト'],
    [`/books/${bookId}/units/new`, '回を作成'],
    [`/books/${bookId}/units/${unitId}`, '回（記録）'],
    [`/books/${bookId}/units/${unitId}/logs/new`, '発言を追加'],
    [`/books/${bookId}/search`, '検索'],
    ['/books/new', '教材を追加'],
    ['/trash', 'ゴミ箱'],
  ]
  const out = []
  for (const [path, name] of routes) {
    history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise((r) => setTimeout(r, 700))
    const vw = document.documentElement.clientWidth
    const sw = document.documentElement.scrollWidth
    if (sw > vw + 1) {
      const bad = []
      document.querySelectorAll('*').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.right > vw + 1 && r.width > 0) {
          bad.push(el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/)[0])
        }
      })
      out.push({ name, scrollWidth: sw, worst: [...new Set(bad)].slice(0, 5) })
    }
  }
  console.log(JSON.stringify({ viewport: document.documentElement.clientWidth, overflowing: out }, null, 1))
})()
```

`overflowing` が空なら、その幅では横にはみ出していない。

## 確認する幅

- **320px** … 小さいiPhone
- **375px** … 標準的なiPhone
- 768px / 1280px … タブレットとPC（こちらは目視で足りることが多い）

## はみ出す原因になりやすいもの

- **グリッドやフレックスの子は既定で `min-width: auto`。** 中に折り返せない
  長い文字列があると、その幅まで広がって画面から出る。`min-width: 0` を付ける
- **`overflow-wrap: break-word` は最小幅の計算に効かない。** 見た目だけ折り返す。
  区切りの無い文字列（招待リンクのトークンなど）には `anywhere` を使う
- 縦に積んでいたものを横に並べたときに初めて出る。並べ方を変えたら必ず測る
