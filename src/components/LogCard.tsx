import type { ReactNode } from 'react'
import { IconBookmark } from './icons'
import LogBody from './LogBody'
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
  /**
   * 添付の期限付きURL（パス → URL）。
   * バケットが非公開で、URLを保存しておけないので呼ぶ側から渡す。
   */
  attachmentUrls?: Map<string, string | null>
  /** しおりが付いているか。渡さない画面ではしおりの操作を出さない */
  isMarked?: boolean
  onToggleMark?: () => void
  /**
   * 返信のときだけ渡す、返信先（親の記録）の投稿者名。
   *
   * 返信は親の下にインデントして表示しているが、返信だけを読んでいると
   * 誰の発言への返信かを見失いやすい（実際に使っていて出た声）。
   * カード自身に一言添えて、親を目で辿らなくても分かるようにする。
   */
  replyToAuthorName?: string
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
  attachmentUrls,
  isMarked = false,
  onToggleMark,
  replyToAuthorName,
}: Props) {
  const pages = formatPageRange(log.pageStart, log.pageEnd)

  return (
    <div
      id={`log-${log.id}`}
      className={isFocused ? 'log-card focused' : 'log-card'}
    >
      {replyToAuthorName && (
        <p className="log-reply-to">{replyToAuthorName}さんへの返信</p>
      )}
      <div className="log-head">
        <span className="log-author">{authorName}</span>
        {log.type !== 'none' && (
          <span className="log-type">{LOG_TYPE_LABEL[log.type]}</span>
        )}
        {/* 解決したかは疑問にしか無い概念。ただのメモには出さない（#136） */}
        {log.type === 'question' && log.resolvedAt && (
          <span className="log-resolved">解決済み</span>
        )}
        {pages && <span className="log-page">{pages}</span>}
        <span className="log-time">{formatTimestamp(log.createdAt)}</span>
        {/* しおりは自分だけのもの。共有相手の画面には出ない */}
        {onToggleMark && (
          <button
            type="button"
            className={isMarked ? 'mark-button marked' : 'mark-button'}
            aria-pressed={isMarked}
            title={isMarked ? 'しおりを外す' : 'しおりを付ける'}
            onClick={onToggleMark}
          >
            <IconBookmark filled={isMarked} />
            <span className="visually-hidden">
              {isMarked ? 'しおりを外す' : 'しおりを付ける'}
            </span>
          </button>
        )}
      </div>
      {log.title && <p className="log-title">{log.title}</p>}
      <LogBody>{log.body}</LogBody>
      {log.attachments.length > 0 && (
        <div className="attachment-list">
          {log.attachments.map((file) => {
            const url = attachmentUrls?.get(file.storagePath) ?? null
            // URLを作れなかったときは、何が付いていたかだけでも見せる
            if (!url) {
              return (
                <p key={file.id} className="attachment-missing">
                  {file.fileName}（画像を読み込めませんでした）
                </p>
              )
            }
            return (
              // 別タブで開くと、縮小前より大きく見られる
              <a
                key={file.id}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="attachment-link"
              >
                <img
                  className="attachment-image"
                  src={url}
                  alt={file.fileName}
                  loading="lazy"
                />
              </a>
            )
          })}
        </div>
      )}
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
