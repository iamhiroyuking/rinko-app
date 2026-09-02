import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ScreenFrame from '../components/ScreenFrame'
import MarkdownField from '../components/MarkdownField'
import {
  createLog,
  getLog,
  updateLog,
  LOG_TYPES,
  LOG_TYPE_LABEL,
  type LogType,
} from '../repository/logs'
import { parseTagNames } from '../repository/tags'
import {
  removeAttachment,
  signAttachments,
  uploadLogImages,
  type SignedAttachment,
} from '../repository/attachments'
import { errorMessage } from '../lib/errorMessage'
import { toPageNumber, validatePageRange } from '../lib/pageRange'
import { ACCEPTED_TYPES, canDecode, checkImageFile } from '../lib/image'

/**
 * 発言の投稿と編集。
 *
 * URLに logId があれば編集、無ければ新規。フォームの中身が同じなので、
 * 画面を2つに分けず1つで両方を受け持っている。
 */
export default function AddLogView() {
  const { bookId, unitId, logId } = useParams()
  const isEditing = Boolean(logId)
  const navigate = useNavigate()
  const [type, setType] = useState<LogType>('none')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [pageStart, setPageStart] = useState('')
  const [pageEnd, setPageEnd] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  /** 投稿と画像の送信は分けて知らせる。画像は時間がかかるため */
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 編集のとき、今の値を読み込むまでフォームを触らせない */
  const [loading, setLoading] = useState(isEditing)

  /**
   * 本文の投稿は済んだが画像で失敗したとき、そのログのid。
   *
   * これが入っている間は投稿ボタンを出さない。同じ内容をもう一度
   * 送れてしまうと、本文だけのログが二重にできるため。
   */
  const [postedLogId, setPostedLogId] = useState<string | null>(null)
  /** 何枚目まで送れたか。送り直すときに、済んだ分を飛ばす */
  const [uploadedCount, setUploadedCount] = useState(0)

  /**
   * 選んだ画像を出すための一時的なURL。
   *
   * ファイル名だけだと、違う写真を選んでも投稿するまで気づけない。
   * 使い終わったら手放す必要があるので、選び直しと画面を離れるときに
   * 取り消している。
   */
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  /**
   * 編集のとき、すでに付いている添付。
   *
   * ここから消したものは即座にストレージから消える（取り消せない）。
   * 新しく選んだ画像（`images`）とは別に持つ。混ぜると「保存前の一覧」
   * と「もう消えた一覧」の区別がつかなくなるため。
   */
  const [existingAttachments, setExistingAttachments] = useState<
    SignedAttachment[]
  >([])
  const [removingAttachmentId, setRemovingAttachmentId] = useState<
    string | null
  >(null)

  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file))
    setPreviewUrls(urls)

    return () => {
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [images])

  const tagNames = parseTagNames(tagInput)

  useEffect(() => {
    if (!logId) return
    let cancelled = false

    getLog(logId)
      .then(async (log) => {
        if (cancelled) return
        if (!log) {
          setError('この記録は見つかりませんでした。')
          setLoading(false)
          return
        }
        setType(log.type)
        setTitle(log.title ?? '')
        setBody(log.body)
        setPageStart(log.pageStart !== null ? String(log.pageStart) : '')
        setPageEnd(log.pageEnd !== null ? String(log.pageEnd) : '')
        setTagInput(log.tagNames.join(' '))

        const signed = await signAttachments(log.attachments)
        if (cancelled) return
        setExistingAttachments(signed)
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
  }, [logId])

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
      if (logId) {
        await updateLog(logId, {
          type,
          title: title.trim() || null,
          body: body.trim(),
          pageStart: start,
          pageEnd: end,
          tagNames,
        })

        // 新しく選んだ分だけ足す。既存の添付は removeExisting で
        // その場で消しているので、ここでは触らない
        if (bookId && images.length > 0) {
          setPostedLogId(logId)
          setUploading(true)
          await uploadLogImages(bookId, logId, images, setUploadedCount)
        }

        navigate(`/books/${bookId}/units/${unitId}?log=${logId}`)
        return
      }

      const created = await createLog({
        unitId,
        type,
        title: title.trim() || null,
        body: body.trim(),
        pageStart: start,
        pageEnd: end,
        tagNames,
      })
      setPostedLogId(created)

      // 画像はログが出来てからでないと置き場所（パス）が決まらない
      if (images.length > 0) {
        setUploading(true)
        await uploadLogImages(bookId, created, images, setUploadedCount)
      }

      navigate(`/books/${bookId}/units/${unitId}`)
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
      setUploading(false)
    }
  }

  /**
   * 選ばれた画像を受け取る。
   *
   * **ここで読めるかどうかまで確かめる。** 縮小は投稿のときに走るので、
   * 調べずに受け取ると「本文を全部書いて投稿を押した後で弾かれる」ことになる。
   * HEICをChromeで選んだときがこれに当たる。
   */
  async function pickImages(files: File[]) {
    setImages(files)
    setError(null)
    if (files.length === 0) return

    for (const file of files) {
      const rejection = checkImageFile(file)
      if (rejection) {
        setError(rejection)
        return
      }
    }

    const undecodable: string[] = []
    for (const file of files) {
      if (!(await canDecode(file))) undecodable.push(file.name)
    }
    if (undecodable.length > 0) {
      setError(
        `${undecodable.join('、')} はこのブラウザでは開けません。` +
          'iPhoneのHEICはSafariなら貼れます。Chromeなら写真アプリから選び直すとJPEGになります。',
      )
    }
  }

  /**
   * すでに付いている添付を1件消す。取り消せないので確認する
   * （教材・回の削除と同じ、素の window.confirm。#63時点で残っている
   * 借りで、配色に合わないが頻度が低いため実害は小さいと判断している）。
   */
  async function removeExisting(attachment: SignedAttachment) {
    if (!window.confirm('この画像を削除しますか？元に戻せません。')) return

    setRemovingAttachmentId(attachment.id)
    setError(null)
    try {
      await removeAttachment(attachment)
      setExistingAttachments((prev) =>
        prev.filter((a) => a.id !== attachment.id),
      )
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setRemovingAttachmentId(null)
    }
  }

  /** 保存前の選択から1枚外す。まだ送っていないのでファイルを外すだけでよい */
  function removeSelected(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  /**
   * 失敗した画像だけ送り直す。
   *
   * 本文はもう投稿されているので作り直さない。済んだ枚数から先だけ送る。
   */
  async function retryImages() {
    if (!bookId || !unitId || !postedLogId) return

    setError(null)
    setBusy(true)
    setUploading(true)
    try {
      const remaining = images.slice(uploadedCount)
      await uploadLogImages(bookId, postedLogId, remaining, (count) =>
        setUploadedCount(uploadedCount + count),
      )
      navigate(
        isEditing
          ? `/books/${bookId}/units/${unitId}?log=${postedLogId}`
          : `/books/${bookId}/units/${unitId}`,
      )
    } catch (caught: unknown) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
      setUploading(false)
    }
  }

  return (
    <ScreenFrame
      title={isEditing ? '発言を編集' : '発言を追加'}
      description={
        isEditing
          ? '書いた内容を直せます。'
          : '輪講中に気づいたこと、予習で理解したこと、疑問などを残します。'
      }
      backTo={`/books/${bookId}/units/${unitId}`}
    >
      {loading && <p className="screen-param">読み込み中…</p>}

      <form className="form" onSubmit={handleSubmit} hidden={loading}>
        <div className="field">
          {/* 他の項目（タイトル・内容・ページ）と同じ名詞で揃える。
              ここだけ疑問文だとフォームの調子が崩れる（#109 で
              「種別」を外したときに question 形にしたのを戻した）。
              「種別」は役所的なので使わない。 */}
          <label htmlFor="type">記録の種類</label>
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
          {/* 記法の案内（#113）は、押せば挿し込めるボタンと
              プレビュー（#128）に置き換えた */}
          <MarkdownField id="body" value={body} onChange={setBody} required />
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

        <div className="field">
          {isEditing && existingAttachments.length > 0 && (
            <>
              <label>付いている画像</label>
              <ul className="preview-list">
                {existingAttachments.map((attachment) => (
                  <li key={attachment.id} className="preview-item">
                    {attachment.url ? (
                      <img
                        className="preview-image"
                        src={attachment.url}
                        alt={attachment.fileName}
                      />
                    ) : (
                      <span className="preview-name">
                        {attachment.fileName}
                      </span>
                    )}
                    <button
                      type="button"
                      className="quiet-button subtle"
                      onClick={() => removeExisting(attachment)}
                      disabled={removingAttachmentId === attachment.id}
                    >
                      {removingAttachmentId === attachment.id
                        ? '削除中…'
                        : 'この画像を削除'}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <label htmlFor="images">
            {isEditing ? '画像を追加（任意）' : '画像（任意）'}
          </label>
          <input
            id="images"
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={(e) => pickImages(Array.from(e.target.files ?? []))}
          />
          <p className="panel-note">
            板書やノートの写真を貼れます。長辺1600pxまで縮小してから送るので、そのままの写真を選んで構いません。
          </p>
          {images.length > 0 && (
            <ul className="preview-list">
              {images.map((file, index) => (
                <li key={file.name} className="preview-item">
                  <img
                    className="preview-image"
                    src={previewUrls[index]}
                    alt={file.name}
                  />
                  <span className="preview-name">{file.name}</span>
                  <button
                    type="button"
                    className="quiet-button subtle"
                    onClick={() => removeSelected(index)}
                  >
                    選択から外す
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="screen-error">{error}</p>}

        {/* 本文は投稿できて画像だけ失敗した状態。
            もう一度「投稿する」を押せると本文が二重になるので、
            送信ボタンは出さず、画像の送り直しだけを出す */}
        {postedLogId ? (
          <section className="panel">
            <h2 className="panel-title">
              {isEditing ? '内容は保存できています' : '本文は投稿できています'}
            </h2>
            <p className="panel-note">
              画像{images.length}枚のうち{uploadedCount}
              枚まで送れました。残りを送り直すか、そのまま進めます。
            </p>
            <div className="button-row">
              <button
                type="button"
                className="quiet-button subtle"
                onClick={() =>
                  navigate(
                    isEditing
                      ? `/books/${bookId}/units/${unitId}?log=${postedLogId}`
                      : `/books/${bookId}/units/${unitId}`,
                  )
                }
              >
                このまま進む
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={retryImages}
                disabled={busy}
              >
                {uploading ? '送信中…' : '残りの画像を送り直す'}
              </button>
            </div>
          </section>
        ) : (
          <button type="submit" className="primary-button" disabled={busy}>
            {uploading
              ? `画像を送信中… ${uploadedCount}/${images.length}`
              : busy
                ? '保存中…'
                : isEditing
                  ? '保存する'
                  : '投稿する'}
          </button>
        )}
      </form>
    </ScreenFrame>
  )
}
