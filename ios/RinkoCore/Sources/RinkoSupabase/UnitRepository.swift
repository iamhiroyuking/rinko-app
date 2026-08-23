import Foundation
import RinkoCore
import Supabase

/*
 回（`src/repository/units.ts` の移植）。

 **削除・復元できるのは作成者だけ。** データベース側の
 `protect_unit_deletion()` トリガーが拒むので、画面はボタンを隠すだけでよい。
 拒否側は別アカウントで確認済み（`400 / 回を削除・復元できるのは作成者だけです`）。
 */
public struct SupabaseUnitRepository: UnitRepository {
  let connection: Connection
  let attachments: SupabaseAttachmentRepository

  public init(connection: Connection) {
    self.connection = connection
    self.attachments = SupabaseAttachmentRepository(connection: connection)
  }

  private static let columns =
    "id, \"order\", title, status, presenter_id, scheduled_date, page_from, page_to"

  // MARK: - 読む

  public func list(bookId: String) async throws -> [StudyUnit] {
    do {
      let rows: [UnitRow] = try await connection.client
        .from("units")
        .select(Self.columns)
        .eq("book_id", value: bookId)
        .is("deleted_at", value: nil)
        .order("order")
        .execute()
        .value

      return rows.map(\.asStudyUnit)
    } catch {
      throw translate(error)
    }
  }

  public func get(id: String) async throws -> StudyUnit? {
    do {
      let rows: [UnitRow] = try await connection.client
        .from("units")
        .select(Self.columns)
        .eq("id", value: id)
        .is("deleted_at", value: nil)
        .limit(1)
        .execute()
        .value

      return rows.first?.asStudyUnit
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 書く

  /// 回を作り、そのidを返す。
  ///
  /// 第N回の番号は、その教材の最大値に1を足して決める。2人が同時に作ると
  /// 同じ番号になりうるが、番号は後から手で編集でき一意制約も無いので許容する。
  ///
  /// **ゴミ箱に入れた回も数に含める**（`deleted_at` で絞らない）。除くと、
  /// 捨てた第3回がある状態で新しく作ったとき番号が3で重複し、その回を
  /// 復元した瞬間に同じ番号が2つ並ぶ。含めると一覧が「第1回・第2回・第4回」と
  /// 飛ぶが、番号は手で直せるので、重複を作るより飛ばす方を選んでいる。
  ///
  /// 教材と違って `insert(...).select()` がそのまま使える。回の閲覧条件は
  /// 「その教材に参加していること」で、作る人はすでに参加者だから。
  public func create(_ input: NewUnit) async throws -> String {
    let userId = try await connection.requireUserId()

    do {
      let last: [OrderRow] = try await connection.client
        .from("units")
        .select("\"order\"")
        .eq("book_id", value: input.bookId)
        .order("order", ascending: false)
        .limit(1)
        .execute()
        .value

      let nextOrder = (last.first?.order ?? 0) + 1

      let inserted: [IdRow] = try await connection.client
        .from("units")
        .insert(
          NewUnitRow(
            bookId: input.bookId,
            order: nextOrder,
            title: input.title,
            objective: input.objective,
            presenterId: input.presenterId,
            scheduledDate: input.scheduledDate,
            createdBy: userId,
            pageFrom: input.pageFrom,
            pageTo: input.pageTo,
            startNote: input.startNote
          )
        )
        .select("id")
        .execute()
        .value

      guard let id = inserted.first?.id else {
        throw RinkoError("回を作成できませんでした")
      }
      return id
    } catch {
      throw translate(error)
    }
  }

  public func update(id: String, _ input: NewUnit) async throws {
    do {
      try await connection.client
        .from("units")
        .update(
          [
            "title": AnyJSON.string(input.title),
            "objective": input.objective.map(AnyJSON.string) ?? .null,
            "presenter_id": input.presenterId.map(AnyJSON.string) ?? .null,
            "scheduled_date": input.scheduledDate.map(AnyJSON.string) ?? .null,
            "page_from": input.pageFrom.map { AnyJSON.integer($0) } ?? .null,
            "page_to": input.pageTo.map { AnyJSON.integer($0) } ?? .null,
            "start_note": input.startNote.map(AnyJSON.string) ?? .null,
          ]
        )
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// ページ範囲と開始箇所のメモだけを直す。
  ///
  /// 回の編集とは別の入口。**後から埋める**ことが多いので、題名や担当を
  /// 触らずに済む形にしてある（#91）。
  public func updatePages(id: String, from: Int?, to: Int?, startNote: String?) async throws {
    do {
      try await connection.client
        .from("units")
        .update(
          [
            "page_from": from.map { AnyJSON.integer($0) } ?? .null,
            "page_to": to.map { AnyJSON.integer($0) } ?? .null,
            "start_note": startNote.map(AnyJSON.string) ?? .null,
          ]
        )
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func updateStatus(id: String, status: UnitStatus) async throws {
    do {
      try await connection.client
        .from("units")
        .update(["status": status.rawValue])
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 消す

  /// ゴミ箱へ。**全員の画面から消える**が、復元できるのは作成者だけ。
  public func trash(id: String) async throws {
    do {
      try await connection.client
        .from("units")
        .update(["deleted_at": ISO8601DateFormatter().string(from: Date())])
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func restore(id: String) async throws {
    do {
      try await connection.client
        .from("units")
        .update(["deleted_at": String?.none])
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// 完全に削除する。配下の記録も連鎖で消える。
  ///
  /// **画像を先に消すこと。** ストレージは連鎖しない。
  public func permanentlyDelete(id: String) async throws {
    do {
      try await attachments.removeUnitImages(unitId: id)

      try await connection.client
        .from("units")
        .delete()
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func listMyTrashed() async throws -> [TrashedUnit] {
    let userId = try await connection.requireUserId()

    do {
      let rows: [TrashedUnitRow] = try await connection.client
        .from("units")
        .select("id, book_id, \"order\", title, deleted_at, books (title)")
        .eq("created_by", value: userId)
        .not("deleted_at", operator: .is, value: "null")
        .order("deleted_at", ascending: false)
        .execute()
        .value

      return rows.compactMap { row in
        guard let deletedAt = row.deletedAt else { return nil }
        return TrashedUnit(
          id: row.id,
          bookId: row.bookId,
          bookTitle: row.books?.title ?? "",
          order: row.order,
          title: row.title,
          deletedAt: deletedAt
        )
      }
    } catch {
      throw translate(error)
    }
  }

  private struct TrashedUnitRow: Decodable, Sendable {
    let id: String
    let bookId: String
    let order: Int
    let title: String
    let deletedAt: String?
    let books: BookTitleRow?

    enum CodingKeys: String, CodingKey {
      case id, order, title, books
      case bookId = "book_id"
      case deletedAt = "deleted_at"
    }

    struct BookTitleRow: Decodable, Sendable { let title: String }
  }
}
