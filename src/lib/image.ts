/**
 * 添付画像をアップロードする前に小さくする。
 *
 * 板書やノートの写真をそのまま上げると1枚3MB前後になる。Supabaseの
 * 無料枠はストレージ1GBで、しかも利用者ごとではなくアプリ全体で共有する
 * ため、そのままでは340枚ほどで埋まる。長辺1600pxまで落とすと1枚300KB
 * 程度になり、同じ1GBで3,400枚入る。数式は1600pxあれば十分読める。
 */

/** 縮小後の長辺の上限 */
const MAX_EDGE = 1600

/** JPEGの品質。0.8を下回ると細い線が潰れて数式が読みにくくなる */
const JPEG_QUALITY = 0.8

/**
 * 選べるファイルの上限。縮小前の生の写真を想定した値で、
 * バケット側の上限（5MB）とは別物。
 * こちらを超えたものは、縮小する前に断る。
 */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type ShrunkImage = {
  blob: Blob
  /** 縮小の結果どの形式になったか。保存先の拡張子とmime_typeに使う */
  mimeType: string
  extension: string
}

/**
 * 画像を読み込んで長辺 MAX_EDGE 以内にする。
 *
 * 元から小さい画像でも作り直している。撮影した写真はJPEGでも
 * 位置情報などのメタデータを抱えていることがあり、描き直すと落ちるため。
 */
export async function shrinkImage(file: File): Promise<ShrunkImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error(
      'JPEG・PNG・WebPの画像だけ添付できます。iPhoneのHEICは写真アプリから選ぶとJPEGになります。',
    )
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('画像が大きすぎます。20MBまでにしてください。')
  }

  const bitmap = await loadBitmap(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('画像を処理できませんでした。')

  // 透明な部分を白で埋めてから描く。
  //
  // 出力は常にJPEGにしている。教科書のページをPNGで保存したもの
  // （スクリーンショットなど）をPNGのまま出すと、縮小しても数MBのままで、
  // 容量を抑えるという目的を果たせないため。JPEGは透過を持てないので、
  // 埋めずに変換すると透明部分が黒くなる。紙の写真やノートが対象なので
  // 白の方が自然に見える。
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob) throw new Error('画像を変換できませんでした。')

  return {
    blob,
    mimeType: 'image/jpeg',
    extension: 'jpg',
  }
}

/**
 * ブラウザに画像を解釈させる。
 *
 * 対応していない形式（Chromeでの HEIC など）はここで失敗する。
 * 何が起きたか分かる文言に置き換えてから投げ直す。
 */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error(
      'この画像はブラウザで開けませんでした。JPEGかPNGで保存し直してください。',
    )
  }
}
