import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  title: string
  description: string
  children?: ReactNode
}

/**
 * 各画面に共通の枠。中身が空の今の段階では、画面名と説明だけを表示する。
 * 実装が進んだら children に本来の内容が入る。
 */
export default function ScreenFrame({ title, description, children }: Props) {
  return (
    <main className="screen">
      <header className="screen-header">
        <h1>{title}</h1>
        <p className="screen-description">{description}</p>
      </header>
      {children}
      <footer className="screen-footer">
        <Link to="/">ホームへ</Link>
      </footer>
    </main>
  )
}
