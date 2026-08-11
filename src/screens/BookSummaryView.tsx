import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { getBook, type Book } from '../repository/books'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; book: Book | null }
  | { status: 'error'; message: string }

export default function BookSummaryView() {
  const { bookId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState({ status: 'loading' })

    getBook(bookId)
      .then((book) => {
        if (!cancelled) setState({ status: 'ok', book })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  const book = state.status === 'ok' ? state.book : null

  return (
    <ScreenFrame
      title={book?.title ?? '教材の概要'}
      description="参加者・次回の担当者・全体の進捗・共有リンクは今後ここに表示します。"
      backTo="/"
      primaryAction={
        book
          ? { label: '学習を開始する', to: `/books/${bookId}/units` }
          : undefined
      }
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && !book && (
        <p className="empty-state">この教材は見つかりませんでした。</p>
      )}

      {book?.goal && (
        <div className="objective-card">
          <span className="objective-label">全体を通しての目標</span>
          {book.goal}
        </div>
      )}
    </ScreenFrame>
  )
}
