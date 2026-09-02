import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { IconTrash } from '../components/icons'
import { useSession } from '../auth/SessionContext'
import { getBook, type Book } from '../repository/books'
import { listBookMembers, type BookMember } from '../repository/members'
import {
  countProgress,
  listUnits,
  sortUnits,
  trashUnit,
  UNIT_SORT_LABEL,
  UNIT_SORT_ORDERS,
  UNIT_STATUS_LABEL,
  type Unit,
  type UnitSortOrder,
} from '../repository/units'
import { errorMessage } from '../lib/errorMessage'
import { countNewLogsByUnit, touchSeenAt } from '../repository/activity'
import { formatUnitPageRange } from '../lib/pageRange'

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; book: Book | null; units: Unit[]; members: BookMember[] }
  | { status: 'error'; message: string }

function ProgressBar({ units }: { units: Unit[] }) {
  const progress = countProgress(units)

  return (
    <div className="progress">
      <div className="progress-head">
        <span className="progress-label">進み具合</span>
        <span className="progress-count">
          {progress.done} / {progress.total} 回 完了
        </span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="完了した回の割合"
      >
        <div
          className="progress-fill"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  )
}

export default function SeminarView() {
  const { bookId } = useParams()
  const { session } = useSession()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  /**
   * 並び順（実際に使っていて出た指摘。第N回の番号でしか並べられなかった）。
   * ページ順の切り替え（UnitView）と同じく、個人の見え方なので保存しない。
   */
  const [sortOrder, setSortOrder] = useState<UnitSortOrder>('order')

  /** 回id → 前回見てから増えた記録の数（#134） */
  const [newByUnit, setNewByUnit] = useState<Map<string, number>>(
    () => new Map(),
  )

  /*
    新着を数えてから「見た」ことにする。順番が逆だと、何が新しかったのかを
    出せないまま印が消える。**この画面でだけ時刻を更新する**（概要を開いた
    だけで消すと、記録を見ていないのに新着が黙って消える）。
  */
  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    countNewLogsByUnit(bookId)
      .then((counts) => {
        if (cancelled) return
        setNewByUnit(counts)
        return touchSeenAt(bookId)
      })
      .catch(() => {
        // 印が出ないだけ。回の一覧は読める
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

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

  /**
   * 自分の権限。閲覧者には書き込みの導線を出さない。
   *
   * 参加者一覧をすでに取っているので、そこから引く。
   * データベース側も編集者でなければ弾くので、これは見せ方の話。
   */
  const myRole =
    state.status === 'ok'
      ? state.members.find((m) => m.userId === session?.user.id)?.role
      : undefined
  const canEdit = myRole !== 'viewer'

  async function handleDelete(unit: Unit) {
    const confirmed = window.confirm(
      `第${unit.order}回「${unit.title}」をゴミ箱に入れますか？\nゴミ箱から復元できます。`,
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeletingId(unit.id)
    try {
      await trashUnit(unit.id)
      setState((prev) =>
        prev.status === 'ok'
          ? { ...prev, units: prev.units.filter((u) => u.id !== unit.id) }
          : prev,
      )
    } catch (caught: unknown) {
      setDeleteError(errorMessage(caught))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <ScreenFrame
      title={
        state.status === 'ok'
          ? (state.book?.title ?? '回のリスト')
          : '回のリスト'
      }
      description="輪講の回が第N回の順に並びます。"
      width="wide"
      backTo={`/books/${bookId}`}
      primaryAction={
        canEdit
          ? {
              label: '＋ 回を作成',
              to: `/books/${bookId}/units/new`,
            }
          : undefined
      }
      secondaryLinks={[{ label: '記録を検索', to: `/books/${bookId}/search` }]}
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {deleteError && <p className="screen-error">{deleteError}</p>}

      {state.status === 'ok' && state.units.length > 0 && (
        <ProgressBar units={state.units} />
      )}

      {state.status === 'ok' && (
        <>
          {state.units.length === 0 ? (
            <p className="empty-state">
              {canEdit
                ? 'まだ回がありません。「回を作成」から追加してください。'
                : 'まだ回がありません。'}
            </p>
          ) : (
            <>
              <div className="field sort-field">
                <label htmlFor="unit-sort">並び順</label>
                <select
                  id="unit-sort"
                  value={sortOrder}
                  onChange={(e) =>
                    setSortOrder(e.target.value as UnitSortOrder)
                  }
                >
                  {UNIT_SORT_ORDERS.map((value) => (
                    <option key={value} value={value}>
                      {UNIT_SORT_LABEL[value]}
                    </option>
                  ))}
                </select>
              </div>
              <ul className="unit-list">
                {sortUnits(state.units, sortOrder).map((unit) => {
                  const canDelete =
                    canEdit && unit.createdBy === session?.user.id
                  const pageText = formatUnitPageRange(
                    unit.pageFrom,
                    unit.pageTo,
                  )
                  return (
                    <li key={unit.id} className="unit-row-container">
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
                            {pageText && (
                              <>
                                {' '}
                                ・{' '}
                                <span className="unit-pages">{pageText}</span>
                              </>
                            )}
                            {/* 自由記述は日本語の文なので、数値の範囲と違って等幅にしない */}
                            {unit.startNote && <> ・ {unit.startNote}</>}
                          </span>
                        </span>
                        {/* 前回見てから増えた分（#134）。0のときは出さない */}
                        {(newByUnit.get(unit.id) ?? 0) > 0 && (
                          <span className="new-badge">
                            新着 {newByUnit.get(unit.id)}
                          </span>
                        )}
                        <span className={`pill status-${unit.status}`}>
                          {UNIT_STATUS_LABEL[unit.status]}
                        </span>
                      </Link>
                      {canDelete && (
                        <button
                          type="button"
                          className="row-delete-button"
                          aria-label={`第${unit.order}回を削除`}
                          onClick={() => handleDelete(unit)}
                          disabled={deletingId === unit.id}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </ScreenFrame>
  )
}
