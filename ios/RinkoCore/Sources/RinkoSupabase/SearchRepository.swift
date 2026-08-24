import Foundation
import RinkoCore
import Supabase

/*
 検索の下ごしらえ（`src/repository/search.ts` の移植）。

 絞り込みそのものは `RinkoCore` の `Search.filter` が純粋関数として持っている
 （テスト済み）。この層は**全件を取ってくるだけ**。

 データベース側で絞り込まない理由は3つ。日本語はPostgreSQLの全文検索だと
 単語に区切れず結局は部分一致になること、タイトル・本文・タグの3か所を
 対象にすると問い合わせが分かれて複雑になること、1つの教材に付く記録は
 多くても数百件で、その程度なら差を体感できないこと。
 */
public struct SupabaseSearchRepository: SearchRepository {
  let connection: Connection

  public init(connection: Connection) {
    self.connection = connection
  }

  /// **ゴミ箱に入れた回の記録を除く。** 行レベルセキュリティは削除済みの
  /// 回も読めるようにしてある（ゴミ箱画面で復元するために必要）ので、
  /// ここで絞らないと捨てた回の記録まで検索に出てしまう。しかもその結果を
  /// 押しても `getUnit` が弾くので「見つかりません」になる。
  public func listSearchable(bookId: String) async throws -> [SearchableLog] {
    do {
      let rows: [SearchableRow] = try await connection.client
        .from("logs")
        .select("""
          id, author_id, title, body, type, resolved_at, created_at, \
          units!inner ( id, "order", title, book_id, deleted_at ), \
          log_tags ( tags ( name ) ), attachments ( id )
          """)
        .eq("units.book_id", value: bookId)
        .is("units.deleted_at", value: nil)
        .execute()
        .value

      return rows.compactMap { row in
        guard let unit = row.units else { return nil }
        return SearchableLog(
          id: row.id,
          unitId: unit.id,
          unitOrder: unit.order,
          unitTitle: unit.title,
          authorId: row.authorId,
          title: row.title,
          body: row.body,
          type: LogType(rawValue: row.type) ?? .none,
          resolvedAt: row.resolvedAt,
          tagNames: (row.logTags ?? []).compactMap { $0.tags?.name },
          createdAt: row.createdAt,
          attachmentCount: row.attachments?.count ?? 0
        )
      }
    } catch {
      throw translate(error)
    }
  }

  private struct SearchableRow: Decodable, Sendable {
    let id: String
    let authorId: String
    let title: String?
    let body: String
    let type: String
    let resolvedAt: String?
    let createdAt: String
    let units: UnitRow?
    let logTags: [LogTagRow]?
    let attachments: [IdOnlyRow]?

    enum CodingKeys: String, CodingKey {
      case id, title, body, type, units
      case authorId = "author_id"
      case resolvedAt = "resolved_at"
      case createdAt = "created_at"
      case logTags = "log_tags"
      case attachments
    }

    struct UnitRow: Decodable, Sendable {
      let id: String
      let order: Int
      let title: String
      enum CodingKeys: String, CodingKey { case id, order, title }
    }

    struct LogTagRow: Decodable, Sendable {
      let tags: NameRow?
      struct NameRow: Decodable, Sendable { let name: String }
    }

    struct IdOnlyRow: Decodable, Sendable { let id: String }
  }
}
