import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import {
  createLog,
  LOG_TYPES,
  LOG_TYPE_LABEL,
  type LogType,
} from '../repository/logs'
import { parseTagNames } from '../repository/tags'
import { errorMessage } from '../lib/errorMessage'
import { toPageNumber, validatePageRange } from '../lib/pageRange'

export default function AddLogView() {
  const { bookId, unitId } = useParams()
  const navigate = useNavigate()
  const [type, setType] = useState<LogType>('none')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pageStart, setPageStart] = useState('')
  const [pageEnd, setPageEnd] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tagNames = parseTagNames(tagInput)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!unitId || !bookId) return
    setError(null)

    const start = toPageNumber(pageStart)
    const end = toPageNumber(pageEnd)
    const validationError = validatePageRange(start, end)
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    try {
      await createLog({
        unitId,
        type,
        title: title.trim() || null,
        body: body.trim(),
        pageStart: start,
        pageEnd: end,
        tagNames,
      })
      navigate(`/books/${bookId}/units/${unitId}`)
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame
      title="発言を追加"
      description="輪講中に気づいたこと、予習で理解したこと、疑問などを残します。"
      backTo={`/books/${bookId}/units/${unitId}`}
    >
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="type">種別</label>
          <select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as LogType)}
          >
            {LOG_TYPES.map((value) => (
              <option key={value} value={value}>
                {LOG_TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="title">タイトル（任意）</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 過学習の直感"
          />
        </div>

        <div className="field">
          <label htmlFor="body">内容</label>
          <textarea
            id="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            required
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="pageStart">開始ページ（任意）</label>
            <input
              id="pageStart"
              type="number"
              min={0}
              inputMode="numeric"
              value={pageStart}
              onChange={(e) => setPageStart(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pageEnd">終了ページ（任意）</label>
            <input
              id="pageEnd"
              type="number"
              min={0}
              inputMode="numeric"
              value={pageEnd}
              onChange={(e) => setPageEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="tags">ハッシュタグ（任意）</label>
          <input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="空白かカンマで区切る（例: 正則化 過学習）"
          />
          {tagNames.length > 0 && (
            <div className="tag-row">
              {tagNames.map((name) => (
                <span key={name} className="tag-chip">
                  #{name}
                </span>
              ))}
            </div>
          )}
        </div>

        {error && <p className="screen-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '投稿中…' : '投稿する'}
        </button>
      </form>
    </ScreenFrame>
  )
}
