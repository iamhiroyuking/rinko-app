import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { createBook } from '../repository/books'
import { errorMessage } from '../lib/errorMessage'

export default function AddBookView() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createBook({
        title: title.trim(),
        coverImageUrl: coverImageUrl.trim() || null,
        goal: goal.trim() || null,
      })
      navigate('/')
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame
      title="教材を追加"
      description="輪講で使う教材を本棚に並べます。"
    >
      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">書名</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: パターン認識と機械学習"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="goal">全体を通しての目標（任意）</label>
          <input
            id="goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="例: 10月末までに5章まで読み切る"
          />
        </div>

        <div className="field">
          <label htmlFor="coverImageUrl">表紙画像のURL（任意）</label>
          <input
            id="coverImageUrl"
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        {error && <p className="screen-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '作成中…' : '作成する'}
        </button>
      </form>
    </ScreenFrame>
  )
}
