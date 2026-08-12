/** 空欄なら null、数字なら数値にする。数字でなければ null 扱い */
export function toPageNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

/**
 * 開始・終了ページの組み合わせが正しいか確かめる。
 * 片方だけの入力、両方とも空は許可する。開始が終了より大きい場合だけ拒否する。
 */
export function validatePageRange(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart !== null && pageEnd !== null && pageStart > pageEnd) {
    return '開始ページは終了ページ以下にしてください。'
  }
  return null
}

/**
 * 回（Unit）が進んだページ範囲を表示用の文字列にする。
 *
 * ログの範囲（「この発言はp.47-60について」）とは意味が違うので分けている。
 * こちらは「次回はp.71から始まる予定」のように、回が始まる前から片方だけ
 * 埋められる開いた範囲を表す。だから開始だけのときは「〜」を付けて
 * 続きがあることを示す。
 *
 * 開始のみ: 「p.71〜」
 * 終了のみ: 「〜p.90」
 * 両方: 「p.71〜p.90」
 * どちらも無い: null（呼び出し側で何も表示しない）
 */
export function formatUnitPageRange(
  pageStart: number | null,
  pageEnd: number | null,
): string | null {
  if (pageStart === null && pageEnd === null) return null
  if (pageStart !== null && pageEnd !== null) {
    if (pageStart === pageEnd) return `p.${pageStart}`
    return `p.${pageStart}〜p.${pageEnd}`
  }
  if (pageStart !== null) return `p.${pageStart}〜`
  return `〜p.${pageEnd}`
}
