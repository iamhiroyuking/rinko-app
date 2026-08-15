import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import { createBook, setBookCoverPath } from '../repository/books'
import { uploadBookCover } from '../repository/attachments'
import { extractToken, joinBookWithToken } from '../repository/invites'
import { errorMessage } from '../lib/errorMessage'
import { ACCEPTED_TYPES } from '../lib/image'

type Mode = 'create' | 'join'

export default function AddBookView() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('create')
  const [title, setTitle] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [goal, setGoal] = useState('')
  const [invite, setInvite] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** 選んだ表紙を出すための一時的なURL。選び直しと離脱で取り消す */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!coverFile) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(coverFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'create') {
        const bookId = await createBook({
          title: title.trim(),
          coverImageUrl: coverImageUrl.trim() || null,
          goal: goal.trim() || null,
        })

        // 表紙は教材が出来てからでないと置き場所が決まらない。
        // ここで失敗しても教材は残るので、表紙が無いまま先へ進める
        if (coverFile) {
          try {
            const path = await uploadBookCover(bookId, coverFile)
            await setBookCoverPath(bookId, path)
          } catch (caught: unknown) {
            setError(
              `教材は作成しましたが、表紙を保存できませんでした。${errorMessage(caught)}`,
            )
            setBusy(false)
            return
          }
        }

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
              <label htmlFor="coverFile">表紙の画像（任意）</label>
              <input
                id="coverFile"
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
              />
              {previewUrl && (
                <ul className="preview-list">
                  <li className="preview-item">
                    <img
                      className="preview-image"
                      src={previewUrl}
                      alt={coverFile?.name ?? ''}
                    />
                    <span className="preview-name">{coverFile?.name}</span>
                  </li>
                </ul>
              )}
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
              <p className="panel-note">
                画像を選んだ場合はそちらを使います。URLは手元に画像が無いときに。
              </p>
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
