import { useState, type ReactNode } from 'react'
/**
 * 本文だけを書いて送るフォーム。
 *
 * 返信と、回の画面からのその場の投稿で同じものを使う。どちらも
 * 「思いついたことをすぐ書く」ための入力で、種別・ページ・タグ・画像は
 * 要らない。それらを使いたいときは AddLogView へ行ってもらう。
 *
 * 同じ見た目のフォームを2か所に書かないよう部品にしてある。
 */
type Props = {
  /** 入力欄の見出し。「返信」など */
  label: string
  /** 送信ボタンの文言 */
  submitLabel: string
  /** 送信中の文言 */
  busyLabel: string
  /** 入力欄を区別するためのid。同じ画面に複数出るため必要 */
  fieldId: string
  value: string
  onChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  busy: boolean
  error: string | null
  /** 閉じられるフォームだけ渡す。その場の投稿は閉じないので渡さない */
  onCancel?: () => void
  autoFocus?: boolean
  placeholder?: string
  /**
   * 普段は1行にして、触れたら広がる形にするか。
   *
   * 読みに来ただけのときに入力欄が場所を取るのを避ける。
   * 「開く」ボタンを挟むとタップが1回増える。輪講中にその場で書く
   * ための入力欄（#61）なので、そのコストは軽くない。
   */
  compact?: boolean
  /** ラベルの右に添えるもの。「種別やページを付けて書く」への導線など */
  labelAction?: ReactNode
}

export default function BodyForm({
  label,
  submitLabel,
  busyLabel,
  fieldId,
  value,
  onChange,
  onSubmit,
  busy,
  error,
  onCancel,
  autoFocus = false,
  placeholder,
  compact = false,
  labelAction,
}: Props) {
  const [focused, setFocused] = useState(false)

  // 書きかけを畳むと消えたように見えるので、中身があれば開いたままにする
  const expanded = !compact || focused || value.trim() !== ''

  return (
    <form className="reply-form" onSubmit={onSubmit}>
      <div className="reply-label-row">
        <label className="reply-label" htmlFor={fieldId}>
          {label}
        </label>
        {labelAction}
      </div>
      <textarea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={expanded ? 3 : 1}
        required
        autoFocus={autoFocus}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <p className="screen-error">{error}</p>}
      <div className="button-row" hidden={!expanded}>
        {onCancel && (
          <button type="button" className="quiet-button" onClick={onCancel}>
            キャンセル
          </button>
        )}
        <button type="submit" className="secondary-button" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  )
}
