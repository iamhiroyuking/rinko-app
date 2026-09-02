import { useEffect, useRef, useState } from 'react'
import LogBody from './LogBody'

type Props = {
  id: string
  value: string
  onChange: (value: string) => void
  rows?: number
  required?: boolean
}

/**
 * Markdownで書く入力欄（#128）。
 *
 * 書いたものが投稿するまで見えないと、`- ` や `**` が生の記号のまま並ぶ。
 * 出来上がりを見る手段と、記法を覚えていなくても書ける手段を足してある。
 *
 * **打ちながら整形される形（WYSIWYG）にはしていない。** それには
 * リッチテキストの土台が要り、圧縮後で150〜400KB増える。Markdownの導入で
 * 既に146KB→183KBになった直後で、しかも入力の中身がHTMLになるため、
 * 「生のHTMLを描画しない」という #113 の防壁を作り直すことになる。
 * ここは切り替えと差し込みで足りるか先に試す。
 *
 * プレビューは左右に並べず切り替えにしている。スマホでは横に並べる幅が無い。
 */
export default function MarkdownField({
  id,
  value,
  onChange,
  rows = 5,
  required = false,
}: Props) {
  const [preview, setPreview] = useState(false)
  const textarea = useRef<HTMLTextAreaElement>(null)

  /**
   * ボタンで書き換えたあと、選び直したい範囲。
   *
   * **描画が終わってからでないと入らない。** 値を変えた直後は React が
   * まだ textarea を更新していないので、その場で setSelectionRange しても
   * 消える（requestAnimationFrame でも間に合わなかった）。
   * 押すたびにフォーカスが外れると、続きを打つのにクリックし直しになる。
   */
  const pendingRange = useRef<[number, number] | null>(null)

  useEffect(() => {
    const range = pendingRange.current
    const el = textarea.current
    if (!range || !el) return

    pendingRange.current = null
    el.focus()
    el.setSelectionRange(range[0], range[1])
  }, [value])

  /**
   * 選んだ範囲を記号で挟む（**強調** など）。
   * 選んでいなければ記号だけ置いて、間にカーソルを戻す。
   */
  function surround(mark: string) {
    const el = textarea.current
    if (!el) return

    const { selectionStart: start, selectionEnd: end } = el
    const selected = value.slice(start, end)
    const next =
      value.slice(0, start) + mark + selected + mark + value.slice(end)
    pendingRange.current = [
      start + mark.length,
      start + mark.length + selected.length,
    ]
    onChange(next)
  }

  /** 選んだ行すべての行頭に印を付ける（箇条書き） */
  function prefixLines(mark: string) {
    const el = textarea.current
    if (!el) return

    const { selectionStart: start, selectionEnd: end } = el
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const after = value.indexOf('\n', end)
    const lineEnd = after === -1 ? value.length : after

    const marked = value
      .slice(lineStart, lineEnd)
      .split('\n')
      .map((line) => (line.startsWith(mark) ? line : mark + line))
      .join('\n')

    pendingRange.current = [lineStart, lineStart + marked.length]
    onChange(value.slice(0, lineStart) + marked + value.slice(lineEnd))
  }

  return (
    <>
      <div className="editor-bar">
        <div className="editor-tools">
          <button
            type="button"
            className="quiet-button"
            onClick={() => prefixLines('- ')}
            disabled={preview}
          >
            箇条書き
          </button>
          <button
            type="button"
            className="quiet-button"
            onClick={() => surround('**')}
            disabled={preview}
          >
            太字
          </button>
        </div>

        <div className="status-choice">
          {[false, true].map((on) => (
            <button
              key={String(on)}
              type="button"
              className={
                preview === on ? 'status-button selected' : 'status-button'
              }
              aria-pressed={preview === on}
              onClick={() => setPreview(on)}
            >
              {on ? 'プレビュー' : '書く'}
            </button>
          ))}
        </div>
      </div>

      {/*
        「ボタン2つ（箇条書き・太字）だけでは記法が分からない」という声から
        追加（実使用で出た指摘）。別ページにすると、書きかけの本文を
        離れて見に行くことになり本末転倒なので、その場で開ける <details> にした。
        ここに載せるのは実際に効く記法だけ。remark-gfm は入れていないので
        取り消し線・テーブルは書いても効かない。黄色のハイライトは
        Markdown標準に無い拡張構文が要るため見送った。
      */}
      <details className="markdown-help">
        <summary>書き方（Markdown）</summary>
        <table className="markdown-help-table">
          <tbody>
            <tr>
              <td># 見出し</td>
              <td>見出し</td>
            </tr>
            <tr>
              <td>**太字**</td>
              <td>
                <strong>太字</strong>
              </td>
            </tr>
            <tr>
              <td>- 項目</td>
              <td>箇条書き</td>
            </tr>
            <tr>
              <td>1. 項目</td>
              <td>番号付きの箇条書き</td>
            </tr>
            <tr>
              <td>&gt; 引用</td>
              <td>引用</td>
            </tr>
            <tr>
              <td>[表示名](URL)</td>
              <td>リンク</td>
            </tr>
            <tr>
              <td>$x^2$</td>
              <td>数式（文中）</td>
            </tr>
            <tr>
              <td>$$x^2$$</td>
              <td>数式（独立した行）</td>
            </tr>
          </tbody>
        </table>
        <p className="panel-note">
          改行はそのまま反映されます。数式はKaTeXの書き方に沿います。取り消し線・表・黄色のハイライトは今のところ書けません。
        </p>
      </details>

      {preview ? (
        // 空のまま切り替えると何も出ず、壊れたように見える
        <div className="editor-preview">
          {value.trim() === '' ? (
            <p className="panel-note">まだ何も書かれていません。</p>
          ) : (
            <LogBody>{value}</LogBody>
          )}
        </div>
      ) : (
        <textarea
          id={id}
          ref={textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          required={required}
        />
      )}
    </>
  )
}
