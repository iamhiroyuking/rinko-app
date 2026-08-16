import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type PrimaryAction = {
  label: string
  to: string
}

export type SecondaryLink = {
  label: string
  to: string
}

type Props = {
  title: string
  description?: string
  /**
   * 戻る先。渡さなければ戻るボタンを出さない（ホームとログイン画面）。
   *
   * ブラウザの戻るに任せていない。フォームを送ったあとに遷移した画面で
   * 戻るを押すと入力途中のフォームに戻ってしまい、行き先が予測できないため。
   */
  backTo?: string
  /** ヘッダー右に置くもの。ログアウトのように本文の操作と混ぜたくないものを入れる */
  headerAction?: ReactNode
  /** その画面でいちばんやりたいこと。ボタンとして目立たせる */
  primaryAction?: PrimaryAction
  /** 主要ではない移動先。主要操作より下に、控えめに並べる */
  secondaryLinks?: SecondaryLink[]
  /** いちばん下に置く補足。今はログイン中の表示にだけ使っている */
  footNote?: ReactNode
  /**
   * 内容に合わせた幅。
   *
   * `reading` は文章を読む画面（既定）。1行が長くなると目が戻れなくなるので、
   * 画面が広くても本文の幅は広げない。
   * `wide` は一覧・並びの画面。横に並べられるものは並べたいので、
   * 広い画面ではその分だけ使う。
   *
   * スマホでは差が出ない（どちらも画面幅いっぱいに収まる）。
   */
  width?: 'reading' | 'wide'
  children?: ReactNode
}

/**
 * 全画面に共通の枠。
 *
 * 並び順を「内容 → 主要操作 → 副次リンク → 補足」に固定している。
 * 画面ごとに順番が違うと、どこを押せばいいのか毎回探すことになるため。
 */
export default function ScreenFrame({
  title,
  description,
  backTo,
  headerAction,
  primaryAction,
  secondaryLinks,
  footNote,
  width = 'reading',
  children,
}: Props) {
  return (
    <div className={width === 'wide' ? 'screen screen-wide' : 'screen'}>
      <header className="app-header">
        <div className="app-header-inner">
          {backTo ? (
            <Link className="back-link" to={backTo}>
              <span aria-hidden>‹</span>
              <span>戻る</span>
            </Link>
          ) : (
            <span className="app-name">輪講</span>
          )}
          {headerAction && (
            <div className="app-header-action">{headerAction}</div>
          )}
        </div>
      </header>

      <main className="screen-body">
        <div className="screen-heading">
          <h1>{title}</h1>
          {description && <p className="screen-description">{description}</p>}
        </div>

        {children}

        {primaryAction && (
          <Link className="primary-link" to={primaryAction.to}>
            {primaryAction.label}
          </Link>
        )}

        {secondaryLinks && secondaryLinks.length > 0 && (
          <ul className="link-list">
            {secondaryLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        )}

        {footNote && <div className="foot-note">{footNote}</div>}
      </main>
    </div>
  )
}
