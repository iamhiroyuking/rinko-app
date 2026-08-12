import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import {
  listTrashedBooks,
  permanentlyDeleteBook,
  restoreBook,
  type TrashedBook,
} from '../repository/books'
import {
  listMyTrashedUnits,
  permanentlyDeleteUnit,
  restoreUnit,
  type TrashedUnit,
} from '../repository/units'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; books: TrashedBook[]; units: TrashedUnit[] }
  | { status: 'error'; message: string }

export default function TrashView() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(load, [])

  function load() {
    let cancelled = false
    setState({ status: 'loading' })

    Promise.all([listTrashedBooks(), listMyTrashedUnits()])
      .then(([books, units]) => {
        if (!cancelled) setState({ status: 'ok', books, units })
      })
      .catch((caught: unknown) => {
        if (!cancelled)
          setState({ status: 'error', message: errorMessage(caught) })
      })

    return () => {
      cancelled = true
    }
  }

  async function handleRestoreBook(book: TrashedBook) {
    setError(null)
    setBusyId(book.id)
    try {
      await restoreBook(book.id)
      load()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setBusyId(null)
    }
  }

  async function handlePermanentlyDeleteBook(book: TrashedBook) {
    const confirmed = window.confirm(
      `「${book.title}」を完全に削除しますか？\nこの操作は取り消せません。再び参加するには招待リンクが必要になります。`,
    )
    if (!confirmed) return

    setError(null)
    setBusyId(book.id)
    try {
      await permanentlyDeleteBook(book.id)
      load()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setBusyId(null)
    }
  }

  async function handleRestoreUnit(unit: TrashedUnit) {
    setError(null)
    setBusyId(unit.id)
    try {
      await restoreUnit(unit.id)
      load()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setBusyId(null)
    }
  }

  async function handlePermanentlyDeleteUnit(unit: TrashedUnit) {
    const confirmed = window.confirm(
      `第${unit.order}回「${unit.title}」を完全に削除しますか？\nこの操作は取り消せません。`,
    )
    if (!confirmed) return

    setError(null)
    setBusyId(unit.id)
    try {
      await permanentlyDeleteUnit(unit.id)
      load()
    } catch (caught: unknown) {
      setError(errorMessage(caught))
      setBusyId(null)
    }
  }

  const isEmpty =
    state.status === 'ok' &&
    state.books.length === 0 &&
    state.units.length === 0

  return (
    <ScreenFrame
      title="ゴミ箱"
      description="削除した教材と回。復元と完全削除ができる。"
      backTo="/"
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {error && <p className="screen-error">{error}</p>}

      {isEmpty && <p className="empty-state">ゴミ箱は空です。</p>}

      {state.status === 'ok' && state.books.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">教材</h2>
          <ul className="trash-list">
            {state.books.map((book) => (
              <li key={book.id} className="trash-row">
                <Link className="trash-row-title" to={`/books/${book.id}`}>
                  {book.title}
                </Link>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRestoreBook(book)}
                    disabled={busyId === book.id}
                  >
                    復元する
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handlePermanentlyDeleteBook(book)}
                    disabled={busyId === book.id}
                  >
                    完全に削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {state.status === 'ok' && state.units.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">回</h2>
          <ul className="trash-list">
            {state.units.map((unit) => (
              <li key={unit.id} className="trash-row">
                <span className="trash-row-title">
                  {unit.bookTitle} ・ 第{unit.order}回 {unit.title}
                </span>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleRestoreUnit(unit)}
                    disabled={busyId === unit.id}
                  >
                    復元する
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handlePermanentlyDeleteUnit(unit)}
                    disabled={busyId === unit.id}
                  >
                    完全に削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ScreenFrame>
  )
}
