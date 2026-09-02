import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

type Props = {
  /** 記録の本文。Markdownとして解釈する */
  children: string
}

/**
 * 記録の本文。箇条書きなどのMarkdownを反映する（#113）。
 *
 * **他人が書いた文字列を描画する場所なので、安全側の既定を崩さないこと。**
 * 共有しているアプリなので、ここが緩むと書いた人が他の参加者の画面で
 * 好きなものを動かせる。守っているのは次の3つ。
 *
 * - `react-markdown` は既定で生のHTMLを描画しない。
 *   **`rehype-raw` を足さないこと。** 足した瞬間に `<script>` が通る
 * - リンクのURLは既定の `urlTransform` が `javascript:` などを落とす。
 *   ここも差し替えない
 * - `dangerouslySetInnerHTML` は使わない
 *
 * `remark-breaks` を入れているのは既存の記録のため。Markdownは本来
 * 1つの改行を空白として畳むので、これが無いと今までプレーンテキストで
 * 書かれた記録の改行が消える。
 *
 * `rehype-katex` は `rehype-raw` とは別物で、上の防壁を崩さない。
 * `remark-math` が `$...$` を数式のASTノードとして解析し、KaTeXが
 * それを安全な（スクリプトを含まない）HTML/SVGに変換するだけなので、
 * 書いた人が任意のHTMLを差し込む経路にはならない。
 */
export default function LogBody({ children }: Props) {
  return (
    <div className="log-body">
      <Markdown
        remarkPlugins={[remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 記録から外のページへ飛ぶときは別タブ。読んでいた位置を失わない
          a({ node: _node, ...props }) {
            return <a {...props} target="_blank" rel="noreferrer nofollow" />
          },
        }}
      >
        {children}
      </Markdown>
    </div>
  )
}
