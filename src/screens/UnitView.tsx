import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { listBookMembers, type BookMember } from '../repository/members'
import { getUnit, UNIT_STATUS_LABEL, type Unit } from '../repository/units'
import {
  formatPageRange,
  listLogs,
  LOG_TYPE_LABEL,
  type LogEntry,
} from '../repository/logs'
import { errorMessage } from '../lib/errorMessage'

type LoadState =
  | { status: 'loading' }
  | {
      status: 'ok'
      unit: Unit | null
      members: BookMember[]
      logs: LogEntry[]
    }
  | { status: 'error'; message: string }

/** 2026-08-11T03:51:34.267275+00:00 → 08/11 12:51 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

export default function UnitView() {
  const { bookId, unitId } = useParams()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  /** 検索結果から飛んできたときに指定される、目当てのログ */
  const focusLogId = searchParams.get('log')

  useEffect(() => {
    if (!bookId || !unitId) return
    let cancelled = false
    setState({ status: 'loading' })

    const load = async () => {
      const [unit, members, logs] = await Promise.all([
        getUnit(unitId),
        listBookMembers(bookId),
        listLogs(unitId),
      ])
      return { unit, members, logs }
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
  }, [bookId, unitId])

  // 目当てのログまで運ぶ。描画が終わってからでないと要素が無いので、
  // ログの取得が済んだあとに実行する
  useEffect(() => {
    if (state.status !== 'ok' || !focusLogId) return
    const element = document.getElementById(`log-${focusLogId}`)
    if (!element) return
    element.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [state.status, focusLogId])

  const unit = state.status === 'ok' ? state.unit : null
  const members = state.status === 'ok' ? state.members : []

  const nameOf = (userId: string | null) => {
    if (!userId) return '未割当'
    return members.find((m) => m.userId === userId)?.displayName ?? '不明'
  }

  return (
    <ScreenFrame
      title={unit ? `第${unit.order}回　${unit.title}` : '回ごとの記録'}
      description="新しい記録が上に並びます。"
      backTo={`/books/${bookId}/units`}
      primaryAction={
        unit
          ? {
              label: '🗨 発言する',
              to: `/books/${bookId}/units/${unitId}/logs/new`,
            }
          : undefined
      }
    >
      {state.status === 'loading' && (
        <p className="screen-param">読み込み中…</p>
      )}

      {state.status === 'error' && (
        <p className="screen-error">{state.message}</p>
      )}

      {state.status === 'ok' && !unit && (
        <p className="empty-state">この回は見つかりませんでした。</p>
      )}

      {unit && state.status === 'ok' && (
        <>
          {unit.objective && (
            <div className="objective-card">
              <span className="objective-label">この回で学ぶこと</span>
              {unit.objective}
            </div>
          )}

          <p className="screen-param">
            担当: {nameOf(unit.presenterId)} ・{' '}
            {unit.scheduledDate ?? '日程未定'} ・{' '}
            {UNIT_STATUS_LABEL[unit.status]}
          </p>

          {state.logs.length === 0 ? (
            <p className="empty-state">
              まだ記録がありません。「発言する」から残してください。
            </p>
          ) : (
            <ul className="log-list">
              {state.logs.map((log) => {
                const pages = formatPageRange(log.pageStart, log.pageEnd)
                return (
                  <li
                    key={log.id}
                    id={`log-${log.id}`}
                    className={
                      log.id === focusLogId ? 'log-card focused' : 'log-card'
                    }
                  >
                    <div className="log-head">
                      <span className="log-author">{nameOf(log.authorId)}</span>
                      {log.type !== 'none' && (
                        <span className="log-type">
                          {LOG_TYPE_LABEL[log.type]}
                        </span>
                      )}
                      {pages && <span className="log-page">{pages}</span>}
                      <span className="log-time">
                        {formatTimestamp(log.createdAt)}
                      </span>
                    </div>
                    {log.title && <p className="log-title">{log.title}</p>}
                    <p className="log-body">{log.body}</p>
                    {log.tagNames.length > 0 && (
                      <div className="tag-row">
                        {log.tagNames.map((name) => (
                          <span key={name} className="tag-chip">
                            #{name}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </ScreenFrame>
  )
}
