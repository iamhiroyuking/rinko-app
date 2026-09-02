import { supabase } from './supabase'
import { shrinkImage } from '../lib/image'

const BUCKET = 'log-images'

/** 表紙の長辺の上限。本棚では小さく出るので、ログの画像ほど要らない */
const COVER_MAX_EDGE = 800

/**
 * 期限付きURLの有効時間（秒）。
 *
 * 非公開バケットなので、読むたびに発行し直す必要がある。長すぎると
 * URLが漏れたときに読める時間が延び、短すぎると画面を開いたまま
 * にしている間に画像が切れる。輪講中に開きっぱなしにすることを考えて
 * 2時間にしてある。切れても再読み込みで直る。
 */
const SIGNED_URL_SECONDS = 2 * 60 * 60

export type Attachment = {
  id: string
  storagePath: string
  fileName: string
  mimeType: string | null
}

/** 表示に使う、期限付きURLを添えた添付 */
export type SignedAttachment = Attachment & {
  /** 発行できなかったときは null。画像の代わりにファイル名を出す */
  url: string | null
}

/**
 * 画像を縮小して保存し、attachments に記録する。
 *
 * 保存先は <book_id>/<log_id>/<uuid>.<ext>。先頭が教材idなのは、
 * ストレージのポリシーがパスから参加者かどうかを判定するため
 * （supabase/migrations/20260814120000_log_image_storage.sql）。
 *
 * 1枚でも失敗したらそこで止めて投げる。ログ本体は既に保存されているので、
 * 「本文は残ったが画像が付かなかった」状態になりうる。
 *
 * そのため、何枚目まで終わったかを `onUploaded` で呼び出し側に伝える。
 * 送り直すときに、済んだ分をもう一度送って画像が重複するのを防ぐため。
 * 進み具合の表示にも使っている。
 */
export async function uploadLogImages(
  bookId: string,
  logId: string,
  files: File[],
  onUploaded?: (count: number) => void,
): Promise<void> {
  let done = 0
  for (const file of files) {
    const shrunk = await shrinkImage(file)
    const path = `${bookId}/${logId}/${crypto.randomUUID()}.${shrunk.extension}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, shrunk.blob, { contentType: shrunk.mimeType })

    if (uploadError) throw uploadError

    const { error } = await supabase.from('attachments').insert({
      log_id: logId,
      storage_path: path,
      file_name: file.name,
      mime_type: shrunk.mimeType,
    })

    // 記録に失敗したら、辿れないファイルを残さないよう消しておく
    if (error) {
      await supabase.storage.from(BUCKET).remove([path])
      throw error
    }

    done += 1
    onUploaded?.(done)
  }
}

/**
 * 添付を1件だけ消す。編集画面で「この画像を消す」を押したときに使う。
 *
 * ストレージから先に消す。記録の行を先に消すと、ストレージだけが
 * 残って辿れなくなるファイルができるため（他の後片付け関数と同じ順序）。
 */
export async function removeAttachment(attachment: Attachment): Promise<void> {
  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([attachment.storagePath])
  if (removeError) throw removeError

  const { error } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachment.id)
  if (error) throw error
}

/**
 * そのログと、その返信に付いている画像を消す。ログを削除する前に呼ぶ。
 *
 * 返信の分も一緒に消すのは、ログを消すと返信も連鎖して消えるため
 * （logs.parent_log_id の on delete cascade）。
 */
export async function removeLogImages(logId: string): Promise<void> {
  const { data: replies, error: repliesError } = await supabase
    .from('logs')
    .select('id')
    .eq('parent_log_id', logId)

  if (repliesError) throw repliesError

  const logIds = [logId, ...(replies ?? []).map((row) => row.id)]

  const { data, error } = await supabase
    .from('attachments')
    .select('storage_path')
    .in('log_id', logIds)

  if (error) throw error

  const paths = (data ?? []).map((row) => row.storage_path)
  if (paths.length === 0) return

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)
  if (removeError) throw removeError
}

/**
 * その回に付いている画像を消す。回を完全に削除する前に呼ぶ。
 *
 * データベース側は外部キーの連鎖で消えるが、ストレージは連鎖しない。
 * 先に消しておかないと、どこからも辿れないファイルが容量だけ
 * 食い続ける。しかも参加情報が消えたあとはポリシーが通らなくなり、
 * 本人にも消せなくなる。
 */
export async function removeUnitImages(unitId: string): Promise<void> {
  const { data, error } = await supabase
    .from('attachments')
    .select('storage_path, logs!inner (unit_id)')
    .eq('logs.unit_id', unitId)

  if (error) throw error

  const paths = (data ?? []).map((row) => row.storage_path)
  if (paths.length === 0) return

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)
  if (removeError) throw removeError
}

/** 指定したパスをストレージから消す。表紙の差し替えなどで使う */
export async function removeStoragePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/**
 * その教材の画像をまとめて消す。
 *
 * 呼ぶのは「最後の参加者が抜けるとき」だけ。教材が実際に消えるのは
 * 参加者がゼロになったときで（delete_orphan_book）、誰か残っていれば
 * その人の画面にはまだ画像が要る。
 */
export async function removeBookImages(bookId: string): Promise<void> {
  const paths = await listBookImagePaths(bookId)
  if (paths.length === 0) return

  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/** <book_id>/<log_id>/<file> の2段になっているので、順にたどる */
async function listBookImagePaths(bookId: string): Promise<string[]> {
  const { data: folders, error } = await supabase.storage
    .from(BUCKET)
    .list(bookId)

  if (error) throw error

  const paths: string[] = []
  for (const folder of folders ?? []) {
    const { data: files, error: filesError } = await supabase.storage
      .from(BUCKET)
      .list(`${bookId}/${folder.name}`)

    if (filesError) throw filesError
    for (const file of files ?? []) {
      paths.push(`${bookId}/${folder.name}/${file.name}`)
    }
  }
  return paths
}

/**
 * 添付に期限付きURLを付けて返す。
 *
 * 1件ずつ発行すると枚数だけ往復するので、まとめて発行している。
 */
export async function signAttachments(
  attachments: Attachment[],
): Promise<SignedAttachment[]> {
  if (attachments.length === 0) return []

  const urlByPath = await signPaths(attachments.map((a) => a.storagePath))

  return attachments.map((a) => ({
    ...a,
    url: urlByPath.get(a.storagePath) ?? null,
  }))
}

/**
 * バケット内のパスに期限付きURLを付ける。
 *
 * 添付でも表紙でも同じ発行の仕方なので、ここにまとめてある。
 * 作れなかったものは null にして返す。画像が出ないだけで画面は動かしたい。
 */
export async function signPaths(
  paths: string[],
): Promise<Map<string, string | null>> {
  if (paths.length === 0) return new Map()

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_SECONDS)

  if (error) return new Map(paths.map((path) => [path, null]))

  // path が null で返る行は結び付け先が分からないので捨てる
  return new Map(
    (data ?? []).flatMap((row) =>
      row.path ? [[row.path, row.signedUrl ?? null] as const] : [],
    ),
  )
}

/**
 * 教材の表紙を保存し、そのパスを返す。
 *
 * ログの画像と同じバケットに <book_id>/cover/<uuid>.jpg として置く。
 * パスの先頭が教材idなのでポリシーがそのまま効き、教材を完全削除した
 * ときの後片付け（removeBookImages）にも自動で含まれる。
 *
 * 表紙は本棚に小さく並ぶだけなので、ログの画像より小さく縮める。
 */
export async function uploadBookCover(
  bookId: string,
  file: File,
): Promise<string> {
  const shrunk = await shrinkImage(file, COVER_MAX_EDGE)
  const path = `${bookId}/cover/${crypto.randomUUID()}.${shrunk.extension}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, shrunk.blob, { contentType: shrunk.mimeType })

  if (error) throw error
  return path
}
