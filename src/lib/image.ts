/**
 * 添付画像をアップロードする前に小さくする。
 *
 * 板書やノートの写真をそのまま上げると1枚3MB前後になる。Supabaseの
 * 無料枠はストレージ1GBで、しかも利用者ごとではなくアプリ全体で共有する
 * ため、そのままでは340枚ほどで埋まる。長辺1600pxまで落とすと1枚300KB
 * 程度になり、同じ1GBで3,400枚入る。数式は1600pxあれば十分読める。
 */

/** 縮小後の長辺の上限。表紙のように小さく出すものは呼び出し側で下げる */
const MAX_EDGE = 1600

/** JPEGの品質。0.8を下回ると細い線が潰れて数式が読みにくくなる */
const JPEG_QUALITY = 0.8

/**
 * 選べるファイルの上限。縮小前の生の写真を想定した値で、
 * バケット側の上限（5MB）とは別物。
 * こちらを超えたものは、縮小する前に断る。
 */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024

/*
  選べる形式。

  HEIC（iPhoneの標準）を含めている。**Safariはシステムの機能でHEICを
  読めるので、実際に変換できる。** 読めるかどうかはブラウザ次第なので、
  種類だけ見て門前払いにせず、いちど読ませてみて判断する（canDecode）。

  Chromeは読めない。ただしWASMのデコーダを積むと1MB以上増えるので入れない。
  写真アプリから選べばiOS側がJPEGに変換するため、詰まる経路は
  「ファイルアプリからHEICを直接選ぶ」に限られる。
*/
export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]

/**
 * 選ばれたファイルを、送る前に見て断れるか調べる。
 *
 * **選んだ直後に呼ぶためのもの。** 縮小は投稿のときに走るので、
 * これが無いと「本文を全部書いて投稿を押した後で弾かれる」ことになる。
 *
 * 断る理由が無ければ null を返す。ここを通っても、ブラウザが読めない形式は
 * 縮小の段階で落ちる（HEICをChromeで選んだ場合など）。
 */
export function checkImageFile(file: File): string | null {
  // 拡張子から種類を決められないことがある（macOSの .heic など）。
  // 空のときは断らず、読めるかどうかで判断させる
  if (file.type !== '' && !ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name} は画像として扱えません。JPEG・PNG・WebP・HEICのいずれかを選んでください。`
  }

  if (file.size > MAX_SOURCE_BYTES) {
    return `${file.name} が大きすぎます。20MBまでにしてください。`
  }

  return null
}

/**
 * ブラウザがこの画像を読めるか、実際に読ませて確かめる。
 *
 * 種類だけでは分からないため。HEICはSafariなら読めてChromeでは読めない。
 * 選んだ直後に呼び、読めないものはその場で伝える。
 */
export async function canDecode(file: File): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(file)
    bitmap.close()
    return true
  } catch {
    return false
  }
}

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
export async function shrinkImage(
  file: File,
  maxEdge: number = MAX_EDGE,
): Promise<ShrunkImage> {
  const rejection = checkImageFile(file)
  if (rejection) throw new Error(rejection)

  const bitmap = await loadBitmap(file)

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
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
      'この画像はこのブラウザでは開けませんでした。iPhoneのHEICはSafariなら貼れます。' +
        'Chromeを使っている場合は、写真アプリから選び直すとJPEGになります。',
    )
  }
}
