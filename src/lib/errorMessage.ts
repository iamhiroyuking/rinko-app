/**
 * 投げられたものから人が読めるメッセージを取り出す。
 *
 * Supabase が返すエラーは `Error` を継承していないただのオブジェクトなので、
 * `caught instanceof Error` だけで判定すると `[object Object]` になってしまう。
 * `message` を持っているかどうかで拾う。
 */
export function errorMessage(caught: unknown): string {
  if (caught instanceof Error) return caught.message

  if (
    typeof caught === 'object' &&
    caught !== null &&
    'message' in caught &&
    typeof (caught as { message: unknown }).message === 'string'
  ) {
    return (caught as { message: string }).message
  }

  return String(caught)
}
