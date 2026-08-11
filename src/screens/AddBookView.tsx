import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { createBook } from '../repository/books'
import { extractToken, joinBookWithToken } from '../repository/invites'
import { errorMessage } from '../lib/errorMessage'

type Mode = 'create' | 'join'

export default function AddBookView() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('create')
  const [title, setTitle] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [goal, setGoal] = useState('')
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'create') {
        await createBook({
          title: title.trim(),
          coverImageUrl: coverImageUrl.trim() || null,
          goal: goal.trim() || null,
        })
        navigate('/')
      } else {
        const bookId = await joinBookWithToken(extractToken(invite))
        navigate(`/books/${bookId}`)
      }
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenFrame
      title={mode === 'create' ? '教材を追加' : '教材に参加'}
      description={
        mode === 'create'
          ? '輪講で使う教材を本棚に並べます。'
          : '受け取った共有リンクを貼り付けてください。'
      }
      backTo="/"
    >
      <div className="tabs">
        <button
          type="button"
          className={mode === 'create' ? 'tab selected' : 'tab'}
          onClick={() => setMode('create')}
        >
          新しく作る
        </button>
        <button
          type="button"
          className={mode === 'join' ? 'tab selected' : 'tab'}
          onClick={() => setMode('join')}
        >
          共有リンクで参加
        </button>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        {mode === 'create' ? (
          <>
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
          </>
        ) : (
          <div className="field">
            <label htmlFor="invite">共有リンク</label>
            <input
              id="invite"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="https://…/join/… を貼り付け"
              required
            />
          </div>
        )}

        {error && <p className="screen-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy
            ? mode === 'create'
              ? '作成中…'
              : '参加中…'
            : mode === 'create'
              ? '作成する'
              : '参加する'}
        </button>
      </form>
    </ScreenFrame>
  )
}
