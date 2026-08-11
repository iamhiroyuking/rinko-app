import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { listShelfBooks, type ShelfBook } from '../repository/books'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; books: ShelfBook[] }
  | { status: 'error'; message: string }

export default function HomeView() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false

    listShelfBooks()
      .then((books) => {
        if (!cancelled) setState({ status: 'ok', books })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : String(error)
        setState({ status: 'error', message })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <ScreenFrame
      title="ホーム"
      description="学習中の教材を本棚として並べる。フィルタで学習予定・学習済みに切り替える。"
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">
          データベースに接続できませんでした: {state.message}
        </p>
      )}

      {state.status === 'ok' && (
        <p className="screen-param">
          データベースに接続できました。本棚の教材: {state.books.length}件
          {state.books.length === 0 && '（未ログインのため0件）'}
        </p>
      )}

      <nav className="screen-nav">
        <Link to="/books/new">教材を追加</Link>
        <Link to="/books/demo">教材を開く（概要へ）</Link>
        <Link to="/trash">ゴミ箱</Link>
        <Link to="/login">ログイン画面</Link>
      </nav>
    </ScreenFrame>
  )
}
