import RinkoCore
import RinkoSupabase
import SwiftUI

/*
 画面に渡すデータ取得の一式。

 **画面はプロトコルだけを見る。** 中身がSupabaseなのか偽の実装なのかを
 知らずに済むので、プレビューでは偽の方を差し替えるだけでよい。

 個別に4つ渡していたのを1つにまとめた。画面が増えるたびに引数が
 増えていくのを避けるため。
 */
struct AppRepositories {
  let auth: any AuthRepository
  let books: any BookRepository
  let units: any UnitRepository
  let logs: any LogRepository
  let members: any MemberRepository
  let activity: any ActivityRepository

  /// Supabaseに繋いだ本物
  static func live(_ supabase: SupabaseRepositories) -> AppRepositories {
    AppRepositories(
      auth: supabase.auth,
      books: supabase.books,
      units: supabase.units,
      logs: supabase.logs,
      members: supabase.members,
      activity: supabase.activity
    )
  }

  /// プレビューと、繋ぐ前の画面づくりに使う偽の実装
  static let preview = AppRepositories(
    auth: FakeAuthRepository(),
    books: FakeBookRepository(),
    units: FakeUnitRepository(),
    logs: FakeLogRepository(),
    members: FakeMemberRepository(),
    activity: FakeActivityRepository()
  )
}
