import type { ReactNode } from 'react'
import {
  formatPageRange,
  LOG_TYPE_LABEL,
  type LogEntry,
} from '../repository/logs'

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

type Props = {
  log: LogEntry
  authorName: string
  /** 検索結果から飛んできた目当てのログなら、枠線で示す */
  isFocused?: boolean
  /** 返信ボタンや返信フォームなど、カードの下に足すもの */
  footer?: ReactNode
}

/**
 * ログ1件の表示。親の記録と返信で同じ見た目を使うため部品にしてある。
 *
 * 見た目の作り込み（吹き出し・左右振り分けなど）はここに閉じているので、
 * M4「デザインを精査する」で手を入れるときもこのファイルだけで済む。
 */
export default function LogCard({
  log,
  authorName,
  isFocused = false,
  footer,
}: Props) {
  const pages = formatPageRange(log.pageStart, log.pageEnd)

  return (
    <div
      id={`log-${log.id}`}
      className={isFocused ? 'log-card focused' : 'log-card'}
    >
      <div className="log-head">
        <span className="log-author">{authorName}</span>
        {log.type !== 'none' && (
          <span className="log-type">{LOG_TYPE_LABEL[log.type]}</span>
        )}
        {pages && <span className="log-page">{pages}</span>}
        <span className="log-time">{formatTimestamp(log.createdAt)}</span>
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
      {footer}
    </div>
  )
}
