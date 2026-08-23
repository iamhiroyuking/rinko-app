import Foundation
import RinkoCore
import Supabase

/*
 まとめて渡すための入れ物。

 画面はここから取り出して使う。**`SupabaseClient` は外へ出ない**ので、
 データの取り方を変えたくなったときに画面を触らずに済む。

 プレビューでは `PreviewData` 側の偽の実装を同じ形で差し込む。
 */
public struct SupabaseRepositories: Sendable {
  public let auth: SupabaseAuthRepository
  public let books: SupabaseBookRepository
  public let units: SupabaseUnitRepository
  public let logs: SupabaseLogRepository
  public let attachments: SupabaseAttachmentRepository
  public let activity: SupabaseActivityRepository
  public let members: SupabaseMemberRepository

  public init(config: SupabaseConfig) {
    let connection = Connection(config: config)
    self.auth = SupabaseAuthRepository(connection: connection)
    self.books = SupabaseBookRepository(connection: connection)
    self.units = SupabaseUnitRepository(connection: connection)
    self.logs = SupabaseLogRepository(connection: connection)
    self.attachments = SupabaseAttachmentRepository(connection: connection)
    self.activity = SupabaseActivityRepository(connection: connection)
    self.members = SupabaseMemberRepository(connection: connection)
  }

  /// `Info.plist` から鍵を読んで組み立てる。起動時に一度だけ呼ぶ
  public static func fromBundle(_ bundle: Bundle = .main) throws -> SupabaseRepositories {
    SupabaseRepositories(config: try SupabaseConfig.fromBundle(bundle))
  }
}
