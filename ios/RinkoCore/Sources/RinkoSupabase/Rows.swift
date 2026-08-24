import Foundation
import RinkoCore
import Supabase

/*
 データベースの行そのもの。**画面が扱う形とは別に持つ。**

 Web版は `supabase gen types typescript --linked` で生成した
 `database.types.ts` を使っているが、Swiftには同じ生成器が無いので手で書く。
 スキーマを変えたらここも直すこと。

 列の名前は snake_case のまま `CodingKeys` で受ける。Swift側だけを
 camelCase にしておくと、SQLを読みながら対応を追える。
 */

// MARK: - 教材

struct BookRow: Decodable, Sendable {
  let id: String
  let title: String
  let goal: String?
  let coverImageUrl: String?
  let coverStoragePath: String?
  let createdBy: String

  enum CodingKeys: String, CodingKey {
    case id, title, goal
    case coverImageUrl = "cover_image_url"
    case coverStoragePath = "cover_storage_path"
    case createdBy = "created_by"
  }
}

/// 本棚の1行。`memberships` を主にして `books` を結合した形。
///
/// **`memberships` 側から引くのが要点。** `books` から引くと、行レベル
/// セキュリティが「参加者全員の教材」を見せるので、自分の分に絞れない。
struct ShelfRow: Decodable, Sendable {
  let shelfStatus: String
  let displayOrder: Int?
  let books: ShelfBookRow?

  enum CodingKeys: String, CodingKey {
    case shelfStatus = "shelf_status"
    case displayOrder = "display_order"
    case books
  }

  struct ShelfBookRow: Decodable, Sendable {
    let id: String
    let title: String
    let coverStoragePath: String?
    /// 参加者の数を数えるためだけに結合している
    let memberships: [MemberIdRow]?

    enum CodingKeys: String, CodingKey {
      case id, title, memberships
      case coverStoragePath = "cover_storage_path"
    }
  }

  struct MemberIdRow: Decodable, Sendable {
    let userId: String
    enum CodingKeys: String, CodingKey { case userId = "user_id" }
  }
}

struct TrashedBookRow: Decodable, Sendable {
  let deletedAt: String?
  let books: TitleRow?

  enum CodingKeys: String, CodingKey {
    case deletedAt = "deleted_at"
    case books
  }

  struct TitleRow: Decodable, Sendable {
    let id: String
    let title: String
  }
}

// MARK: - 回

struct UnitRow: Decodable, Sendable {
  let id: String
  let order: Int
  let title: String
  let status: String
  let presenterId: String?
  let scheduledDate: String?
  let pageFrom: Int?
  let pageTo: Int?

  enum CodingKeys: String, CodingKey {
    case id, order, title, status
    case presenterId = "presenter_id"
    case scheduledDate = "scheduled_date"
    case pageFrom = "page_from"
    case pageTo = "page_to"
  }

  var asStudyUnit: StudyUnit {
    StudyUnit(
      id: id,
      order: order,
      title: title,
      status: UnitStatus(rawValue: status) ?? .notStarted,
      presenterId: presenterId,
      scheduledDate: scheduledDate,
      pageFrom: pageFrom,
      pageTo: pageTo
    )
  }
}

/// 第N回の番号を決めるためだけに引く
struct OrderRow: Decodable, Sendable {
  let order: Int
}

/// 回から教材を辿るためだけに引く
struct BookIdRow: Decodable, Sendable {
  let bookId: String
  enum CodingKeys: String, CodingKey { case bookId = "book_id" }
}

// MARK: - 記録

struct LogRow: Decodable, Sendable {
  let id: String
  let authorId: String
  let parentLogId: String?
  let type: String
  let title: String?
  let body: String
  let pageStart: Int?
  let pageEnd: Int?
  let createdAt: String
  let resolvedAt: String?
  let logTags: [LogTagRow]?

  enum CodingKeys: String, CodingKey {
    case id, type, title, body
    case authorId = "author_id"
    case parentLogId = "parent_log_id"
    case pageStart = "page_start"
    case pageEnd = "page_end"
    case createdAt = "created_at"
    case resolvedAt = "resolved_at"
    case logTags = "log_tags"
  }

  struct LogTagRow: Decodable, Sendable {
    let tags: NameRow?
    struct NameRow: Decodable, Sendable { let name: String }
  }

  var asLogEntry: LogEntry {
    LogEntry(
      id: id,
      authorId: authorId,
      parentLogId: parentLogId,
      type: LogType(rawValue: type) ?? .none,
      title: title,
      body: body,
      pageStart: pageStart,
      pageEnd: pageEnd,
      createdAt: createdAt,
      resolvedAt: resolvedAt,
      // 結合の結果は無いこともある。タグの付いていない記録が
      // 消えないよう、常に無い場合を考える
      tagNames: (logTags ?? []).compactMap { $0.tags?.name }
    )
  }
}

/// 挿入した行のidだけを受け取る
struct IdRow: Decodable, Sendable {
  let id: String
}

// MARK: - タグ

struct TagRow: Decodable, Sendable {
  let id: String
  let name: String
}

// MARK: - 送る側

/// `Encodable` で送る行。`nil` も明示的に送りたいので `Optional` のまま持つ。
///
/// **PostgREST では「キーを省く」と「null を送る」が違う。** 更新のときに
/// 省くと元の値が残るので、消したい列は必ず null を送ること。
struct NewLogRow: Encodable, Sendable {
  let unitId: String
  let authorId: String
  let type: String
  let title: String?
  let body: String
  let pageStart: Int?
  let pageEnd: Int?
  let parentLogId: String?

  enum CodingKeys: String, CodingKey {
    case type, title, body
    case unitId = "unit_id"
    case authorId = "author_id"
    case pageStart = "page_start"
    case pageEnd = "page_end"
    case parentLogId = "parent_log_id"
  }
}

struct NewUnitRow: Encodable, Sendable {
  let bookId: String
  let order: Int
  let title: String
  let objective: String?
  let presenterId: String?
  let scheduledDate: String?
  let createdBy: String
  let pageFrom: Int?
  let pageTo: Int?
  let startNote: String?

  enum CodingKeys: String, CodingKey {
    case order, title, objective
    case bookId = "book_id"
    case presenterId = "presenter_id"
    case scheduledDate = "scheduled_date"
    case createdBy = "created_by"
    case pageFrom = "page_from"
    case pageTo = "page_to"
    case startNote = "start_note"
  }
}

struct NewTagRow: Encodable, Sendable {
  let bookId: String
  let name: String

  enum CodingKeys: String, CodingKey {
    case name
    case bookId = "book_id"
  }
}

struct NewLogTagRow: Encodable, Sendable {
  let logId: String
  let tagId: String

  enum CodingKeys: String, CodingKey {
    case logId = "log_id"
    case tagId = "tag_id"
  }
}
