import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { listBookMembers, type BookMember } from '../repository/members'
import { createUnit } from '../repository/units'
import { errorMessage } from '../lib/errorMessage'
import { toPageNumber, validatePageRange } from '../lib/pageRange'

export default function CreateUnitView() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [members, setMembers] = useState<BookMember[]>([])
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [presenterId, setPresenterId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [pageFrom, setPageFrom] = useState('')
  const [pageTo, setPageTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    listBookMembers(bookId)
      .then((list) => {
        if (cancelled) return
        setMembers(list)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorMessage(caught))
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!bookId) return
    setError(null)

    const from = toPageNumber(pageFrom)
    const to = toPageNumber(pageTo)
    const validationError = validatePageRange(from, to)
    if (validationError) {
      setError(validationError)
      return
    }

    setBusy(true)
    try {
      const unitId = await createUnit({
        bookId,
        title: title.trim(),
        objective: objective.trim() || null,
        presenterId: presenterId || null,
        scheduledDate: scheduledDate || null,
        pageFrom: from,
        pageTo: to,
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
      title="回を作成"
      description="第N回の番号は自動で振られます。後から編集できます。"
      backTo={`/books/${bookId}/units`}
    >
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">タイトル</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 線形識別モデル"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="objective">この回で学ぶこと（任意）</label>
          <input
            id="objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="一言で"
          />
        </div>

        <div className="field">
          <label htmlFor="presenter">担当者（任意）</label>
          <select
            id="presenter"
            value={presenterId}
            onChange={(e) => setPresenterId(e.target.value)}
          >
            <option value="">未割当</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="scheduledDate">輪講の日（任意）</label>
          <input
            id="scheduledDate"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="pageFrom">進んだページ・開始（任意）</label>
            <input
              id="pageFrom"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="〜から"
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="pageTo">進んだページ・終了（任意）</label>
            <input
              id="pageTo"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="〜まで"
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value)}
            />
          </div>
        </div>
        <p className="panel-note">
          今分かる分だけで構いません。開始ページだけ書いて、この回が終わってから終了ページを追記できます。
        </p>

        {error && <p className="screen-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '作成中…' : '作成する'}
        </button>
      </form>
    </ScreenFrame>
  )
}
