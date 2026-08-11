import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { getBook, type Book } from '../repository/books'
import { listBookMembers, type BookMember } from '../repository/members'
import { listUnits, UNIT_STATUS_LABEL, type Unit } from '../repository/units'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; book: Book | null; units: Unit[]; members: BookMember[] }
  | { status: 'error'; message: string }

export default function SeminarView() {
  const { bookId } = useParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [book, units, members] = await Promise.all([
        getBook(bookId),
        listUnits(bookId),
        listBookMembers(bookId),
      ])
      return { book, units, members }
    }

    load()
      .then((result) => {
        if (!cancelled) setState({ status: 'ok', ...result })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  const nameOf = (userId: string | null) => {
    if (state.status !== 'ok' || !userId) return '未割当'
    return state.members.find((m) => m.userId === userId)?.displayName ?? '不明'
  }

  return (
    <ScreenFrame
      title={
        state.status === 'ok'
          ? (state.book?.title ?? '回のリスト')
          : '回のリスト'
      }
      description="輪講の回が第N回の順に並びます。"
      backTo={`/books/${bookId}`}
      primaryAction={{
        label: '＋ 回を作成',
        to: `/books/${bookId}/units/new`,
      }}
      secondaryLinks={[{ label: '記録を検索', to: `/books/${bookId}/search` }]}
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && (
        <>
          {state.units.length === 0 ? (
            <p className="empty-state">
              まだ回がありません。「回を作成」から追加してください。
            </p>
          ) : (
            <ul className="unit-list">
              {state.units.map((unit) => (
                <li key={unit.id}>
                  <Link
                    className="unit-row"
                    to={`/books/${bookId}/units/${unit.id}`}
                  >
                    <span className="unit-order">第{unit.order}回</span>
                    <span className="unit-main">
                      <span className="unit-title">{unit.title}</span>
                      <span className="unit-meta">
                        {nameOf(unit.presenterId)} ・{' '}
                        {unit.scheduledDate ?? '日程未定'}
                      </span>
                    </span>
                    <span className={`pill status-${unit.status}`}>
                      {UNIT_STATUS_LABEL[unit.status]}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </ScreenFrame>
  )
}
