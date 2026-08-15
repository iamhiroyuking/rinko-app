/**
 * 動作確認のための種まき。開発時だけ読み込まれる。
 *
 * 「教材を作る → 回を作る → ログを投稿する → 画像を添付する」は
 * 検証のたびに繰り返す定型で、手で組み立てると毎回10回以上のやりとりに
 * なっていた。ここにまとめて一度で済ませる。
 *
 * 認証はブラウザに既にあるセッションをそのまま使う。Nodeのスクリプトに
 * するとメールとパスワード、あるいはサービスロールキーが要るが、
 * どちらも手元に置きたくないため。
 *
 * **書き込みは既存のリポジトリ関数だけを通す。** 種まき専用の経路を
 * 作ると本番と違う道でデータができ、検証の意味が薄れる。
 *
 * 本番のバンドルには含まれない。読み込んでいるのは main.tsx の
 * import.meta.env.DEV の内側だけで、本番ビルドではその分岐ごと消える。
 */

import {
  createBook,
  permanentlyDeleteBook,
  trashBook,
} from '../repository/books'
import { listShelfBooks } from '../repository/books'
import { createUnit } from '../repository/units'
import { createLog } from '../repository/logs'
import { uploadLogImages } from '../repository/attachments'

/**
 * 種まきで作った教材の目印。
 *
 * 後片付けはこの印が付いた教材だけを消す。印で守っておかないと、
 * 実際の教材まで巻き込んで消しかねない。
 */
const SEED_PREFIX = '[seed]'

export type SeedOptions = {
  /** 教材名。目印は自動で付く */
  title?: string
  /** 作る回の数 */
  units?: number
  /** 回ごとに作るログの数 */
  logsPerUnit?: number
  /** ログ1件目に添付する画像の枚数 */
  images?: number
}

export type SeedResult = {
  bookId: string
  unitIds: string[]
  logIds: string[]
  /** そのまま開けるように組み立てたURL */
  url: string
}

/** 画像を1枚その場で作る。実物のファイルを用意しなくて済む */
async function makeImage(label: string): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = 1400
  canvas.height = 1000

  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像を作れませんでした')

  context.fillStyle = '#e8eee6'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#1b231e'
  context.font = 'bold 90px sans-serif'
  context.fillText(label, 90, 520)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('画像を作れませんでした')

  return new File([blob], `${label}.png`, { type: 'image/png' })
}

/** 教材・回・ログ・画像を一度に作る */
export async function seed(options: SeedOptions = {}): Promise<SeedResult> {
  const { title = '検証', units = 1, logsPerUnit = 3, images = 0 } = options

  const bookId = await createBook({
    title: `${SEED_PREFIX} ${title}`,
    goal: '動作確認のために作られた教材です',
  })

  const unitIds: string[] = []
  const logIds: string[] = []

  for (let unitIndex = 1; unitIndex <= units; unitIndex += 1) {
    const unitId = await createUnit({
      bookId,
      title: `検証の回 ${unitIndex}`,
      objective: '動作確認',
    })
    unitIds.push(unitId)

    for (let logIndex = 1; logIndex <= logsPerUnit; logIndex += 1) {
      const logId = await createLog({
        unitId,
        type: 'none',
        body: `検証用の記録 ${unitIndex}-${logIndex}`,
        tagNames: [`検証タグ${logIndex}`],
      })
      logIds.push(logId)

      const isFirstLog = unitIndex === 1 && logIndex === 1
      if (isFirstLog && images > 0) {
        const files = await Promise.all(
          Array.from({ length: images }, (_, i) => makeImage(`image-${i + 1}`)),
        )
        await uploadLogImages(bookId, logId, files)
      }
    }
  }

  return {
    bookId,
    unitIds,
    logIds,
    url: `${window.location.origin}/books/${bookId}/units/${unitIds[0] ?? ''}`,
  }
}

/**
 * 種まきで作った教材をすべて完全に削除する。
 *
 * 目印の付いた教材だけを対象にする。ゴミ箱を経由するのは本番と同じ
 * 経路を通すため。画像もここで消える（permanentlyDeleteBook が
 * 最後の参加者のときにストレージを片付ける）。
 */
export async function cleanup(): Promise<string[]> {
  const removed: string[] = []

  // 本棚のどのタブに置かれていても拾えるようにする
  const shelves = await Promise.all([
    listShelfBooks('planned'),
    listShelfBooks('reading'),
    listShelfBooks('finished'),
  ])

  for (const book of shelves.flat()) {
    if (!book.title.startsWith(SEED_PREFIX)) continue

    await trashBook(book.id)
    await permanentlyDeleteBook(book.id)
    removed.push(book.title)
  }

  return removed
}

/** コンソールから呼べるようにする。開発時のみ */
export function registerSeedHelpers(): void {
  const helpers = { seed, cleanup }
  Object.assign(window, { rinko: helpers })
  console.info('[dev] window.rinko.seed() / window.rinko.cleanup() が使えます')
}
