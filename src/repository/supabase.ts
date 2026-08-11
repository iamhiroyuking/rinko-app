import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    '.env に VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY を設定してください（.env.example を参照）',
  )
}

/**
 * Supabaseとの通信口。
 *
 * このファイルと同じ repository ディレクトリの中からだけ使う。
 * 画面のコードから直接呼ばないこと。データの取り方を変えたくなったときに、
 * 画面を触らずに済むようにしておくため。
 *
 * 型引数の Database は実際のデータベースから生成したもの
 * （`supabase gen types typescript --linked`）。
 * スキーマを変更したら再生成する。
 */
export const supabase = createClient<Database>(url, anonKey)
