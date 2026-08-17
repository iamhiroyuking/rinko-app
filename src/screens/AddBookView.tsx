import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import {
  createBook,
  getBook,
  replaceBookCover,
  setBookCoverPath,
  updateBook,
} from '../repository/books'
import { signPaths, uploadBookCover } from '../repository/attachments'
import { extractToken, joinBookWithToken } from '../repository/invites'
import { errorMessage } from '../lib/errorMessage'
import { ACCEPTED_TYPES, canDecode, checkImageFile } from '../lib/image'

type Mode = 'create' | 'join'

/**
 * 教材の追加・参加・編集。
 *
 * URLに bookId があれば編集。AddLogView / CreateUnitView と同じ考え方で、
 * 中身がほぼ同じフォームを2つ持たないようにしている。
 */
export default function AddBookView() {
  const { bookId } = useParams()
  const isEditing = Boolean(bookId)
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

  /** 編集のとき、今ついている表紙 */
  const [currentCoverPath, setCurrentCoverPath] = useState<string | null>(null)
  const [currentCoverUrl, setCurrentCoverUrl] = useState<string | null>(null)
  /** 表紙を外す指示。差し替えとは別に持つ */
  const [removeCover, setRemoveCover] = useState(false)
  const [loading, setLoading] = useState(isEditing)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false

    getBook(bookId)
      .then(async (book) => {
        if (cancelled) return
        if (!book) {
          setError('この教材は見つかりませんでした。')
          setLoading(false)
          return
        }
        setTitle(book.title)
        setGoal(book.goal ?? '')
        setCoverImageUrl(book.coverImageUrl ?? '')
        setCurrentCoverPath(book.coverStoragePath)

        if (book.coverStoragePath) {
          const urls = await signPaths([book.coverStoragePath])
          if (!cancelled) {
            setCurrentCoverUrl(urls.get(book.coverStoragePath) ?? null)
          }
        }
        if (!cancelled) setLoading(false)
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        setError(errorMessage(caught))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [bookId])

  useEffect(() => {
    if (!coverFile) {
      setPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(coverFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  /**
   * 表紙に選ばれた画像を受け取る。
   *
   * 縮小は保存のときに走るので、ここで読めるかまで確かめておかないと、
   * 書名を入れて保存を押した後で弾かれる（AddLogView と同じ理由）。
   */
  async function pickCover(file: File | null) {
    setCoverFile(file)
    setError(null)
    if (!file) return

    const rejection = checkImageFile(file)
    if (rejection) {
      setError(rejection)
      return
    }

    if (!(await canDecode(file))) {
      setError(
        `${file.name} はこのブラウザでは開けません。` +
          'iPhoneのHEICはSafariなら貼れます。Chromeなら写真アプリから選び直すとJPEGになります。',
      )
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (bookId) {
        await updateBook(bookId, {
          title: title.trim(),
          goal: goal.trim() || null,
        })

        // 表紙は「差し替える」「外す」「そのまま」の3通り。
        // 前の画像を消すのは記録を書き換えたあと（replaceBookCover の中）
        if (coverFile) {
          const path = await uploadBookCover(bookId, coverFile)
          await replaceBookCover(bookId, currentCoverPath, path)
        } else if (removeCover && currentCoverPath) {
          await replaceBookCover(bookId, currentCoverPath, null)
        }

        navigate(`/books/${bookId}`)
        return
      }

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
      title={
        isEditing
          ? '教材を編集'
          : mode === 'create'
            ? '教材を追加'
            : '教材に参加'
      }
      description={
        isEditing
          ? '書名・目標・表紙を直せます。変更は参加者全員に反映されます。'
          : mode === 'create'
            ? '輪講で使う教材を本棚に並べます。'
            : '受け取った共有リンクを貼り付けてください。'
      }
      backTo={isEditing ? `/books/${bookId}` : '/'}
    >
      {loading && <p className="screen-param">読み込み中…</p>}

      {/* 編集では「新しく作る／参加する」の切り替えは要らない */}
      <div className="tabs" hidden={isEditing}>
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

      <form className="form" onSubmit={handleSubmit} hidden={loading}>
        {isEditing || mode === 'create' ? (
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
              {/* 目標は1つとは限らない。1行しか書けないと「、」で
                  区切るしかなくなるので、改行して並べられるようにする */}
              <textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                placeholder={'例: 10月末までに5章まで読み切る\n演習問題を全部解く'}
              />
            </div>

            <div className="field">
              <label htmlFor="coverFile">表紙の画像（任意）</label>
              <input
                id="coverFile"
                type="file"
                accept={ACCEPTED_TYPES.join(',')}
                onChange={(e) => pickCover(e.target.files?.[0] ?? null)}
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

              {/* 今ついている表紙。差し替えないなら触らない */}
              {isEditing && currentCoverPath && !coverFile && (
                <>
                  <ul className="preview-list">
                    <li className="preview-item">
                      {currentCoverUrl ? (
                        <img
                          className="preview-image"
                          src={currentCoverUrl}
                          alt="今の表紙"
                        />
                      ) : (
                        <span className="preview-name">今の表紙</span>
                      )}
                      <span className="preview-name">
                        {removeCover ? '外します' : '今の表紙'}
                      </span>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="quiet-button log-action-button"
                    onClick={() => setRemoveCover((on) => !on)}
                  >
                    {removeCover ? '外すのをやめる' : '表紙を外す'}
                  </button>
                </>
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
          {isEditing
            ? busy
              ? '保存中…'
              : '保存する'
            : busy
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
