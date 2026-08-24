import Foundation
import RinkoCore
import Supabase

/*
 前回見てからの新着と、次にやること（`src/repository/activity.ts` の移植）。

 共有しているのに「誰かが書いた」ことがどこにも出ないと、用事があるときしか
 開かなくなる。輪講は週1回なので、1回忘れると2週空く。

 見た時刻は `memberships.last_seen_at` に入れる。**個人の状態**なので
 教材ではなく参加情報の側にある（本棚のステータスやしおりと同じ考え方）。
 */
public struct SupabaseActivityRepository: ActivityRepository {
  let connection: Connection

  public init(connection: Connection) {
    self.connection = connection
  }

  // MARK: - 新着

  /// 教材ごとの新着の数。
  ///
  /// **問い合わせは1回で済ませる。** 教材ごとに閾値が違うので素朴に書くと
  /// 教材の数だけ問い合わせが飛ぶ。いちばん古い閾値以降の記録をまとめて取り、
  /// 教材ごとの比較は取得後に行う。
  ///
  /// **自分が書いたものは数えない。** 自分の書き込みで自分に印が付いても
  /// 意味がない。
  public func countNewLogs() async throws -> [String: Int] {
    let userId = try await connection.requireUserId()

    do {
      let seenAt = try await listSeenAt(userId: userId)
      guard let oldest = seenAt.values.compactMap({ $0 }).min() else { return [:] }

      let rows: [NewLogRow] = try await connection.client
        .from("logs")
        .select("created_at, units!inner (book_id, deleted_at)")
        .gt("created_at", value: oldest)
        .neq("author_id", value: userId)
        .is("units.deleted_at", value: nil)
        .execute()
        .value

      var counts: [String: Int] = [:]
      for row in rows {
        guard let bookId = row.units?.bookId else { continue }
        // 参加していない教材の記録は行レベルセキュリティが弾くので普通は来ない
        guard let since = seenAt[bookId] ?? nil, row.createdAt > since else { continue }
        counts[bookId, default: 0] += 1
      }
      return counts
    } catch {
      throw translate(error)
    }
  }

  /// その教材の中で、回ごとに増えた記録の数。
  ///
  /// **時刻を更新する前に呼ぶこと。** 先に見たことにしてしまうと、
  /// 何が新しかったのかを出せないまま印が消える。
  public func countNewLogsByUnit(bookId: String) async throws -> [String: Int] {
    let userId = try await connection.requireUserId()

    do {
      guard let since = try await seenAt(bookId: bookId, userId: userId) else { return [:] }

      let rows: [UnitIdRow] = try await connection.client
        .from("logs")
        .select("unit_id, units!inner (book_id, deleted_at)")
        .eq("units.book_id", value: bookId)
        .is("units.deleted_at", value: nil)
        .gt("created_at", value: since)
        .neq("author_id", value: userId)
        .execute()
        .value

      var counts: [String: Int] = [:]
      for row in rows { counts[row.unitId, default: 0] += 1 }
      return counts
    } catch {
      throw translate(error)
    }
  }

  /// 見たことにする。
  ///
  /// **回の一覧を開いたときだけ呼ぶ。** 概要の画面を開いただけで消すと、
  /// 記録を見ていないのに新着が黙って消える。
  public func markSeen(bookId: String) async throws {
    let userId = try await connection.requireUserId()

    do {
      try await connection.client
        .from("memberships")
        .update(["last_seen_at": ISO8601DateFormatter().string(from: Date())])
        .eq("user_id", value: userId)
        .eq("book_id", value: bookId)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 次にやること

  /// 教材ごとの「次にやる回」を、本棚をまたいで集める（#135）。
  ///
  /// **「学習中」の教材だけ**を対象にする。今やっていない教材の予定は雑音。
  /// 完了した回は出さない。
  ///
  /// 並べ替えは `RinkoCore` の `Upcoming.sort` に任せる（テスト済み）。
  public func listUpcoming() async throws -> [UpcomingUnit] {
    let userId = try await connection.requireUserId()

    do {
      let memberships: [BookIdRow] = try await connection.client
        .from("memberships")
        .select("book_id")
        .eq("user_id", value: userId)
        .is("deleted_at", value: nil)
        .eq("shelf_status", value: ShelfStatus.reading.rawValue)
        .execute()
        .value

      let bookIds = memberships.map(\.bookId)
      guard !bookIds.isEmpty else { return [] }

      let rows: [UpcomingRow] = try await connection.client
        .from("units")
        .select("id, \"order\", title, scheduled_date, presenter_id, book_id, books (title)")
        .in("book_id", values: bookIds)
        .is("deleted_at", value: nil)
        .neq("status", value: UnitStatus.done.rawValue)
        .order("order")
        .execute()
        .value

      // 担当者の名前は別に引く。回ごとに profiles を結合すると
      // 同じ人を何度も返すことになる
      let presenterIds = Set(rows.compactMap(\.presenterId))
      var names: [String: String] = [:]
      if !presenterIds.isEmpty {
        let profiles: [ProfileRow] = try await connection.client
          .from("profiles")
          .select("id, display_name")
          .in("id", values: Array(presenterIds))
          .execute()
          .value
        for profile in profiles { names[profile.id] = profile.displayName }
      }

      // 教材ごとに先頭の1件だけ。order 順に並べてあるので最初に来たものが次
      var firstPerBook: [String: UpcomingUnit] = [:]
      for row in rows {
        guard firstPerBook[row.bookId] == nil, let book = row.books else { continue }
        firstPerBook[row.bookId] = UpcomingUnit(
          bookId: row.bookId,
          bookTitle: book.title,
          unitId: row.id,
          order: row.order,
          title: row.title,
          scheduledDate: row.scheduledDate,
          presenterName: row.presenterId.map { names[$0] ?? "不明" },
          isMine: row.presenterId == userId
        )
      }

      return Upcoming.sort(Array(firstPerBook.values))
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 中で使う

  /// 自分が参加している教材の、前回見た時刻をまとめて取る
  private func listSeenAt(userId: String) async throws -> [String: String?] {
    let rows: [SeenAtRow] = try await connection.client
      .from("memberships")
      .select("book_id, last_seen_at")
      .eq("user_id", value: userId)
      .is("deleted_at", value: nil)
      .execute()
      .value

    return Dictionary(uniqueKeysWithValues: rows.map { ($0.bookId, $0.lastSeenAt) })
  }

  private func seenAt(bookId: String, userId: String) async throws -> String? {
    let rows: [SeenAtRow] = try await connection.client
      .from("memberships")
      .select("book_id, last_seen_at")
      .eq("user_id", value: userId)
      .eq("book_id", value: bookId)
      .is("deleted_at", value: nil)
      .limit(1)
      .execute()
      .value

    return rows.first?.lastSeenAt
  }

  private struct SeenAtRow: Decodable, Sendable {
    let bookId: String
    let lastSeenAt: String?

    enum CodingKeys: String, CodingKey {
      case bookId = "book_id"
      case lastSeenAt = "last_seen_at"
    }
  }

  private struct NewLogRow: Decodable, Sendable {
    let createdAt: String
    let units: UnitBookRow?

    enum CodingKeys: String, CodingKey {
      case createdAt = "created_at"
      case units
    }

    struct UnitBookRow: Decodable, Sendable {
      let bookId: String
      enum CodingKeys: String, CodingKey { case bookId = "book_id" }
    }
  }

  private struct UnitIdRow: Decodable, Sendable {
    let unitId: String
    enum CodingKeys: String, CodingKey { case unitId = "unit_id" }
  }

  private struct UpcomingRow: Decodable, Sendable {
    let id: String
    let order: Int
    let title: String
    let scheduledDate: String?
    let presenterId: String?
    let bookId: String
    let books: BookTitleRow?

    enum CodingKeys: String, CodingKey {
      case id, order, title, books
      case scheduledDate = "scheduled_date"
      case presenterId = "presenter_id"
      case bookId = "book_id"
    }

    struct BookTitleRow: Decodable, Sendable { let title: String }
  }

  private struct ProfileRow: Decodable, Sendable {
    let id: String
    let displayName: String
    enum CodingKeys: String, CodingKey {
      case id
      case displayName = "display_name"
    }
  }
}

/*
 参加者（`src/repository/members.ts` の移植）。

 担当者を選ぶときの選択肢になる。ゴミ箱に入れた人は含めない。
 */
public struct SupabaseMemberRepository: MemberRepository {
  let connection: Connection

  public init(connection: Connection) {
    self.connection = connection
  }

  public func list(bookId: String) async throws -> [BookMember] {
    do {
      let rows: [MemberRow] = try await connection.client
        .from("memberships")
        .select("user_id, role, profiles (display_name)")
        .eq("book_id", value: bookId)
        .is("deleted_at", value: nil)
        .order("joined_at")
        .execute()
        .value

      return rows.compactMap { row in
        guard let profile = row.profiles else { return nil }
        return BookMember(
          id: row.userId,
          displayName: profile.displayName,
          role: InviteRole(rawValue: row.role) ?? .viewer
        )
      }
    } catch {
      throw translate(error)
    }
  }

  private struct MemberRow: Decodable, Sendable {
    let userId: String
    let role: String
    let profiles: NameRow?

    enum CodingKeys: String, CodingKey {
      case role, profiles
      case userId = "user_id"
    }

    struct NameRow: Decodable, Sendable {
      let displayName: String
      enum CodingKeys: String, CodingKey { case displayName = "display_name" }
    }
  }
}
