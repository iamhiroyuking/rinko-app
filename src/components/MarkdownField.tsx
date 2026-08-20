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
              className={preview === on ? 'status-button selected' : 'status-button'}
              aria-pressed={preview === on}
              onClick={() => setPreview(on)}
            >
              {on ? 'プレビュー' : '書く'}
            </button>
          ))}
        </div>
      </div>

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
