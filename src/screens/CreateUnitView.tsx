import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { listBookMembers, type BookMember } from '../repository/members'
import { createUnit, getUnit, updateUnit } from '../repository/units'
import { errorMessage } from '../lib/errorMessage'
import { toPageNumber, validatePageRange } from '../lib/pageRange'

/**
 * 回の作成と編集。
 *
 * URLに unitId があれば編集、無ければ新規。AddLogView と同じ考え方で、
 * 中身が同じフォームを2つ持たないようにしている。
 *
 * 進んだページ（page_from / page_to / start_note）は編集では扱わない。
 * UnitViewの「進んだページ」パネルが受け持っていて、輪講の前後で
 * 何度も触る項目なので、そちらに置いたままにする。
 */
export default function CreateUnitView() {
  const { bookId, unitId } = useParams()
  const isEditing = Boolean(unitId)
  const navigate = useNavigate()
  const [members, setMembers] = useState<BookMember[]>([])
  const [order, setOrder] = useState('')
  const [title, setTitle] = useState('')
  const [objective, setObjective] = useState('')
  const [presenterId, setPresenterId] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [pageFrom, setPageFrom] = useState('')
  const [pageTo, setPageTo] = useState('')
  const [startNote, setStartNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditing)

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

  useEffect(() => {
    if (!unitId) return
    let cancelled = false

    getUnit(unitId)
      .then((unit) => {
        if (cancelled) return
        if (!unit) {
          setError('この回は見つかりませんでした。')
          setLoading(false)
          return
        }
        setOrder(String(unit.order))
        setTitle(unit.title)
        setObjective(unit.objective ?? '')
        setPresenterId(unit.presenterId ?? '')
        setScheduledDate(unit.scheduledDate ?? '')
        setLoading(false)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(errorMessage(caught))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [unitId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!bookId) return
    setError(null)

    if (unitId) {
      const orderNumber = toPageNumber(order)
      if (orderNumber === null || orderNumber < 1) {
        setError('第N回の番号は1以上の数字にしてください。')
        return
      }

      setBusy(true)
      try {
        await updateUnit(unitId, {
          order: orderNumber,
          title: title.trim(),
          objective: objective.trim() || null,
          presenterId: presenterId || null,
          scheduledDate: scheduledDate || null,
        })
        navigate(`/books/${bookId}/units/${unitId}`)
      } catch (caught: unknown) {
        setError(errorMessage(caught))
      } finally {
        setBusy(false)
      }
      return
    }

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
        startNote: startNote.trim() || null,
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
      title={isEditing ? '回を編集' : '回を作成'}
      description={
        isEditing
          ? '第N回の番号も直せます。同じ番号が並んでも構いません。'
          : '第N回の番号は自動で振られます。後から編集できます。'
      }
      backTo={
        isEditing
          ? `/books/${bookId}/units/${unitId}`
          : `/books/${bookId}/units`
      }
    >
      {loading && <p className="screen-param">読み込み中…</p>}

      <form className="form" onSubmit={handleSubmit} hidden={loading}>
        <div className="field" hidden={!isEditing}>
          <label htmlFor="order">第N回</label>
          <input
            id="order"
            type="number"
            min={1}
            inputMode="numeric"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          />
        </div>

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

        {/* 進んだページはUnitViewのパネルが受け持つ。作成時だけ先に書けるようにしている */}
        <div className="field-row" hidden={isEditing}>
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

        <div className="field" hidden={isEditing}>
          <label htmlFor="startNote">開始箇所のメモ（任意）</label>
          <input
            id="startNote"
            value={startNote}
            onChange={(e) => setStartNote(e.target.value)}
            placeholder="例: p.27の章末2.3から"
          />
        </div>
        <p className="panel-note" hidden={isEditing}>
          今分かる分だけで構いません。開始ページだけ書いて、この回が終わってから終了ページを追記できます。
          章や演習番号で伝えたいときはメモに書いてください。
        </p>
        <p className="panel-note" hidden={!isEditing}>
          進んだページと開始箇所のメモは、回の画面の「進んだページ」から直せます。
        </p>

        {error && <p className="screen-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '保存中…' : isEditing ? '保存する' : '作成する'}
        </button>
      </form>
    </ScreenFrame>
  )
}
