import Foundation
import RinkoCore
import Supabase

/*
 記録とタグ（`src/repository/logs.ts` と `tags.ts` の移植）。

 タグは教材ごとに管理しているので教材のidが要るが、**呼び出し側から
 受け取らず回のidから引く。** 別々に受け取ると「教材Aの回」と「教材B」という
 噛み合わない組み合わせを渡せてしまい、記録は教材Aに付くのにタグだけ
 教材Bに作られる、という壊れ方をする。
 */
public struct SupabaseLogRepository: LogRepository {
  let connection: Connection
  let attachments: SupabaseAttachmentRepository

  public init(connection: Connection) {
    self.connection = connection
    self.attachments = SupabaseAttachmentRepository(connection: connection)
  }

  private static let columns = """
    id, author_id, parent_log_id, type, title, body, \
    page_start, page_end, created_at, resolved_at, log_tags ( tags ( name ) )
    """

  // MARK: - 読む

  /// その回の記録を新しい順に返す。**返信も含めて平らに返す。**
  /// スレッドに組むのは `Threads.build` の役目。
  ///
  /// 親と返信で問い合わせを分けていないのは、親ごとに返信を取りに行くと
  /// 件数分だけ通信が増えるため。
  public func list(unitId: String) async throws -> [LogEntry] {
    do {
      let rows: [LogRow] = try await connection.client
        .from("logs")
        .select(Self.columns)
        .eq("unit_id", value: unitId)
        .order("created_at", ascending: false)
        .execute()
        .value

      return rows.map(\.asLogEntry)
    } catch {
      throw translate(error)
    }
  }

  public func get(id: String) async throws -> LogEntry? {
    do {
      let rows: [LogRow] = try await connection.client
        .from("logs")
        .select(Self.columns)
        .eq("id", value: id)
        .limit(1)
        .execute()
        .value

      return rows.first?.asLogEntry
    } catch {
      throw translate(error)
    }
  }

  /// その教材に残された記録の総数。返信も1件として数える。
  ///
  /// **`units!inner` が要る。** 無いと `units` 側の条件が効かず、
  /// 教材をまたいで数える。ゴミ箱に入れた回の記録は、画面から消えている
  /// 以上ここでも数えない。
  public func countInBook(bookId: String) async throws -> Int {
    do {
      let response = try await connection.client
        .from("logs")
        .select("id, units!inner (book_id, deleted_at)", head: true, count: .exact)
        .eq("units.book_id", value: bookId)
        .is("units.deleted_at", value: nil)
        .execute()

      return response.count ?? 0
    } catch {
      throw translate(error)
    }
  }

  /// 未解決の疑問の数（#136）。教材の一覧で「まだ答えが出ていない」を出すため
  public func countUnresolvedQuestions(bookId: String) async throws -> Int {
    do {
      let response = try await connection.client
        .from("logs")
        .select("id, units!inner (book_id, deleted_at)", head: true, count: .exact)
        .eq("units.book_id", value: bookId)
        .is("units.deleted_at", value: nil)
        .eq("type", value: LogType.question.rawValue)
        .is("resolved_at", value: nil)
        .execute()

      return response.count ?? 0
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 書く

  /// 記録を投稿し、そのidを返す。
  ///
  /// タグの登録と結びつけは記録の作成後に行うため、厳密にはひとつの操作に
  /// まとまっていない。途中で失敗するとタグの付いていない記録が残る。
  /// 今の規模では実害が小さいのでこのままにしている（Web版と同じ判断）。
  public func create(_ input: NewLog) async throws -> String {
    let userId = try await connection.requireUserId()

    do {
      let inserted: [IdRow] = try await connection.client
        .from("logs")
        .insert(
          NewLogRow(
            unitId: input.unitId,
            authorId: userId,
            type: input.type.rawValue,
            title: input.title,
            body: input.body,
            pageStart: input.pageStart,
            pageEnd: input.pageEnd,
            parentLogId: input.parentLogId
          )
        )
        .select("id")
        .execute()
        .value

      guard let id = inserted.first?.id else {
        throw RinkoError("記録を保存できませんでした")
      }

      try await attachTags(input.tagNames, to: id, unitId: input.unitId)
      return id
    } catch {
      throw translate(error)
    }
  }

  /// 記録を書き換える。**タグは付け直す**（一度外してから付ける）
  public func update(id: String, _ input: NewLog) async throws {
    do {
      try await connection.client
        .from("logs")
        .update(
          [
            "type": AnyJSON.string(input.type.rawValue),
            "title": input.title.map(AnyJSON.string) ?? .null,
            "body": AnyJSON.string(input.body),
            "page_start": input.pageStart.map { AnyJSON.integer($0) } ?? .null,
            "page_end": input.pageEnd.map { AnyJSON.integer($0) } ?? .null,
          ]
        )
        .eq("id", value: id)
        .execute()

      try await connection.client
        .from("log_tags")
        .delete()
        .eq("log_id", value: id)
        .execute()

      try await attachTags(input.tagNames, to: id, unitId: input.unitId)
    } catch {
      throw translate(error)
    }
  }

  /// ページ範囲だけを後から埋める（#91）
  public func updatePages(id: String, start: Int?, end: Int?) async throws {
    do {
      try await connection.client
        .from("logs")
        .update(
          [
            "page_start": start.map { AnyJSON.integer($0) } ?? .null,
            "page_end": end.map { AnyJSON.integer($0) } ?? .null,
          ]
        )
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// 疑問を解決済みにする／戻す（#136）。押せるのは投稿者だけ
  public func setResolved(id: String, resolved: Bool) async throws {
    do {
      try await connection.client
        .from("logs")
        .update(
          ["resolved_at": resolved ? ISO8601DateFormatter().string(from: Date()) : nil]
        )
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// 記録を消す。**返信も連鎖して消える。取り消せない。**
  ///
  /// 画像を先に消すこと（ストレージは連鎖しない）。
  public func delete(id: String) async throws {
    do {
      try await attachments.removeLogImages(logId: id)

      try await connection.client
        .from("logs")
        .delete()
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  // MARK: - タグ

  /// タグを用意して記録に結びつける。
  ///
  /// `tags` は `(book_id, name)` に一意制約があるので、同名なら既存の行が
  /// 使われる。これが「同じ教材内で同名のタグは1つにまとまる」の実装。
  private func attachTags(_ names: [String], to logId: String, unitId: String) async throws {
    guard !names.isEmpty else { return }

    let bookRows: [BookIdRow] = try await connection.client
      .from("units")
      .select("book_id")
      .eq("id", value: unitId)
      .limit(1)
      .execute()
      .value

    guard let bookId = bookRows.first?.bookId else { return }

    try await connection.client
      .from("tags")
      .upsert(
        names.map { NewTagRow(bookId: bookId, name: $0) },
        onConflict: "book_id,name",
        ignoreDuplicates: true
      )
      .execute()

    let tags: [TagRow] = try await connection.client
      .from("tags")
      .select("id, name")
      .eq("book_id", value: bookId)
      .in("name", values: names)
      .execute()
      .value

    guard !tags.isEmpty else { return }

    try await connection.client
      .from("log_tags")
      .insert(tags.map { NewLogTagRow(logId: logId, tagId: $0.id) })
      .execute()
  }
}
