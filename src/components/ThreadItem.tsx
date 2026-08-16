import type { ReactNode } from 'react'
import LogCard from './LogCard'
import BodyForm from './BodyForm'
import type { LogEntry, LogThread } from '../repository/logs'

type Props = {
  thread: LogThread
  nameOf: (userId: string | null) => string
  focusLogId: string | null
  attachmentUrls: Map<string, string | null>
  markedLogIds: Set<string>
  onToggleMark: (logId: string) => void
  canEdit: boolean
  ownLogActions: (log: LogEntry, replyCount: number) => ReactNode

  /** 「ここから下はページが未記入」の区切り。ページ順のときだけ渡される */
  showPageDivider: boolean
  withoutPageCount: number

  replyingTo: string | null
  replyBody: string
  replyBusy: boolean
  replyError: string | null
  onOpenReply: (logId: string) => void
  onReplyBodyChange: (value: string) => void
  onSubmitReply: (event: React.FormEvent, parentLogId: string) => void
  onCancelReply: () => void

  pagingLogId: string | null
  pagingStart: string
  pagingEnd: string
  pagingBusy: boolean
  pagingError: string | null
  onPagingStartChange: (value: string) => void
  onPagingEndChange: (value: string) => void
  onSubmitPaging: (event: React.FormEvent, logId: string) => void
  onCancelPaging: () => void

  repliesOpen: boolean
  onToggleThread: (rootLogId: string) => void
}

/**
 * スレッド1件分（親の記録＋返信＋その場の操作）。
 *
 * 親のフッターは「返信フォーム」「ページ入力フォーム」「返信する・編集・削除」の
 * いずれか1つで、同時に複数は出ない。どれを出すかは呼び出し側が持つ
 * replyingTo / pagingLogId で決まる。
 */
export default function ThreadItem({
  thread,
  nameOf,
  focusLogId,
  attachmentUrls,
  markedLogIds,
  onToggleMark,
  canEdit,
  ownLogActions,
  showPageDivider,
  withoutPageCount,
  replyingTo,
  replyBody,
  replyBusy,
  replyError,
  onOpenReply,
  onReplyBodyChange,
  onSubmitReply,
  onCancelReply,
  pagingLogId,
  pagingStart,
  pagingEnd,
  pagingBusy,
  pagingError,
  onPagingStartChange,
  onPagingEndChange,
  onSubmitPaging,
  onCancelPaging,
  repliesOpen,
  onToggleThread,
}: Props) {
  const rootId = thread.root.id

  const footer =
    replyingTo === rootId ? (
      <BodyForm
        label="返信"
        fieldId={`reply-${rootId}`}
        submitLabel="返信する"
        busyLabel="送信中…"
        value={replyBody}
        onChange={onReplyBodyChange}
        onSubmit={(e) => onSubmitReply(e, rootId)}
        busy={replyBusy}
        error={replyError}
        onCancel={onCancelReply}
        autoFocus
      />
    ) : pagingLogId === rootId ? (
      <form
        className="paging-form"
        onSubmit={(e) => onSubmitPaging(e, rootId)}
      >
        <div className="field-row">
          <div className="field">
            <label htmlFor={`ps-${rootId}`}>開始ページ</label>
            <input
              id={`ps-${rootId}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={pagingStart}
              onChange={(e) => onPagingStartChange(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor={`pe-${rootId}`}>終了（任意）</label>
            <input
              id={`pe-${rootId}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={pagingEnd}
              onChange={(e) => onPagingEndChange(e.target.value)}
            />
          </div>
        </div>
        {pagingError && <p className="screen-error">{pagingError}</p>}
        <div className="button-row">
          <button type="button" className="quiet-button" onClick={onCancelPaging}>
            やめる
          </button>
          <button type="submit" className="secondary-button" disabled={pagingBusy}>
            {pagingBusy ? '保存中…' : 'ページを保存'}
          </button>
        </div>
      </form>
    ) : (
      <div className="log-actions">
        {canEdit && (
          <button
            type="button"
            className="quiet-button log-action-button"
            onClick={() => onOpenReply(rootId)}
          >
            返信する
          </button>
        )}
        {ownLogActions(thread.root, thread.replies.length)}
      </div>
    )

  return (
    <li>
      {showPageDivider && (
        <p className="log-group-divider">
          ここから下はページが未記入（{withoutPageCount}件）
        </p>
      )}
      <LogCard
        log={thread.root}
        authorName={nameOf(thread.root.authorId)}
        isFocused={rootId === focusLogId}
        attachmentUrls={attachmentUrls}
        isMarked={markedLogIds.has(rootId)}
        onToggleMark={() => onToggleMark(rootId)}
        footer={footer}
      />

      {thread.replies.length > 0 && (
        <>
          <button
            type="button"
            className="quiet-button reply-toggle-button"
            aria-expanded={repliesOpen}
            aria-controls={`replies-${rootId}`}
            onClick={() => onToggleThread(rootId)}
          >
            {repliesOpen
              ? `返信${thread.replies.length}件を隠す`
              : `返信${thread.replies.length}件を表示`}
          </button>

          {repliesOpen && (
            <ul className="reply-list" id={`replies-${rootId}`}>
              {thread.replies.map((reply) => (
                <li key={reply.id}>
                  <LogCard
                    log={reply}
                    authorName={nameOf(reply.authorId)}
                    isFocused={reply.id === focusLogId}
                    attachmentUrls={attachmentUrls}
                    isMarked={markedLogIds.has(reply.id)}
                    onToggleMark={() => onToggleMark(reply.id)}
                    footer={
                      <div className="log-actions">{ownLogActions(reply, 0)}</div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}
