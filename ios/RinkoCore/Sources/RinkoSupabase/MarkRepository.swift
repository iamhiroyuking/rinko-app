import Foundation
import RinkoCore
import Supabase

/*
 個人のしおり（`src/repository/marks.ts` の移植）。

 「後からもう一度振り返りたい」という目印で、共有相手には見えない。
 ただし行レベルセキュリティは「見てよいもの」を決めるだけで「欲しいもの」は
 決めないので、**どの関数でも `user_id` で絞ること。** 忘れると他人の
 しおりが自分のものとして出る（`listShelfBooks` / `getMyShelfEntry` で
 2度踏んだのと同じ形）。
 */
public struct SupabaseMarkRepository: MarkRepository {
  let connection: Connection

  public init(connection: Connection) {
    self.connection = connection
  }

  public func listMine(logIds: [String]) async throws -> Set<String> {
    guard !logIds.isEmpty else { return [] }
    let userId = try await connection.requireUserId()

    do {
      let rows: [LogIdRow] = try await connection.client
        .from("log_marks")
        .select("log_id")
        .eq("user_id", value: userId)
        .in("log_id", values: logIds)
        .execute()
        .value
      return Set(rows.map(\.logId))
    } catch {
      throw translate(error)
    }
  }

  /// その教材で自分がしおりを付けている記録のid。
  ///
  /// **`logs!inner` が要る。** 無いと `logs` 側の条件が効かず、
  /// 他の教材のしおりまで返る。
  public func listMineInBook(bookId: String) async throws -> Set<String> {
    let userId = try await connection.requireUserId()

    do {
      let rows: [LogIdRow] = try await connection.client
        .from("log_marks")
        .select("log_id, logs!inner (units!inner (book_id))")
        .eq("user_id", value: userId)
        .eq("logs.units.book_id", value: bookId)
        .execute()
        .value
      return Set(rows.map(\.logId))
    } catch {
      throw translate(error)
    }
  }

  public func add(logId: String) async throws {
    let userId = try await connection.requireUserId()

    do {
      try await connection.client
        .from("log_marks")
        .insert(["log_id": logId, "user_id": userId])
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func remove(logId: String) async throws {
    let userId = try await connection.requireUserId()

    do {
      try await connection.client
        .from("log_marks")
        .delete()
        .eq("log_id", value: logId)
        .eq("user_id", value: userId)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  private struct LogIdRow: Decodable, Sendable {
    let logId: String
    enum CodingKeys: String, CodingKey { case logId = "log_id" }
  }
}
