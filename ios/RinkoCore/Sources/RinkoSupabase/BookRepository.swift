import Foundation
import RinkoCore
import Supabase

/*
 本棚と教材（`src/repository/books.ts` の移植）。

 ■ この層でいちばん間違えやすいこと

 **行レベルセキュリティは「見てよいもの」を決めるだけで、「欲しいもの」は
 決めない。** 参加者名を出すために「自分が参加している教材の参加者全員」を
 読める設定にしてあるので、`user_id` で絞らないと共有相手の参加情報まで
 返ってきて、同じ教材が人数分だけ並ぶ。

 Web版で実際に踏んだ。**1人で試している間は絶対に出ない**ので、
 絞る条件は機械的に書くこと。`listShelf` / `countShelf` /
 `updateShelfStatus` / `trash` / `restore` / `permanentlyDelete` が対象。
 */
public struct SupabaseBookRepository: BookRepository {
  let connection: Connection
  let attachments: SupabaseAttachmentRepository

  public init(connection: Connection) {
    self.connection = connection
    self.attachments = SupabaseAttachmentRepository(connection: connection)
  }

  // MARK: - 読む

  public func listShelf(status: ShelfStatus) async throws -> [ShelfBook] {
    let userId = try await connection.requireUserId()

    do {
      let rows: [ShelfRow] = try await connection.client
        .from("memberships")
        .select(
          "shelf_status, display_order, books (id, title, cover_storage_path, memberships (user_id))"
        )
        .eq("user_id", value: userId)  // ← 忘れると本棚が重複する
        .is("deleted_at", value: nil)
        .eq("shelf_status", value: status.rawValue)
        .order("display_order")
        .execute()
        .value

      return rows.compactMap { row in
        // books は外部キー越しなので、型のうえでは無いことがある
        guard let book = row.books else { return nil }
        return ShelfBook(
          id: book.id,
          title: book.title,
          coverStoragePath: book.coverStoragePath,
          shelfStatus: ShelfStatus(rawValue: row.shelfStatus) ?? status,
          memberCount: book.memberships?.count ?? 1
        )
      }
    } catch {
      throw translate(error)
    }
  }

  /// そのステータスに何冊あるか。
  ///
  /// 本棚は「学習中」を主役にして、学習予定と学習完了は控えめな導線から
  /// 見に行く形にしている。押す前に冊数が分かると空振りしない。
  public func countShelf(status: ShelfStatus) async throws -> Int {
    let userId = try await connection.requireUserId()

    do {
      let response = try await connection.client
        .from("memberships")
        .select("id", head: true, count: .exact)
        .eq("user_id", value: userId)
        .is("deleted_at", value: nil)
        .eq("shelf_status", value: status.rawValue)
        .execute()

      return response.count ?? 0
    } catch {
      throw translate(error)
    }
  }

  /// 教材そのもの。参加していなければ nil が返る（行レベルセキュリティ）
  public func get(id: String) async throws -> Book? {
    do {
      let row: BookRow? = try await connection.client
        .from("books")
        .select("id, title, goal, cover_image_url, cover_storage_path, created_by")
        .eq("id", value: id)
        .execute()
        .value

      guard let row else { return nil }
      return Book(
        id: row.id,
        title: row.title,
        goal: row.goal,
        coverStoragePath: row.coverStoragePath,
        createdBy: row.createdBy
      )
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 書く

  /// 教材を作り、そのidを返す。
  ///
  /// **素直に `insert(...).select("id")` と書くと失敗する。** 教材の閲覧は
  /// 「参加していること」が条件で、作成者を参加者にするのは AFTER INSERT
  /// トリガー。AFTER 行トリガーは文の終わりに動くのに対し RETURNING は
  /// 行を処理する時点で作られるので、まだ参加情報が無い状態で弾かれる。
  ///
  /// そのためデータベース側の `create_book` 関数を通す。理由の詳細は
  /// supabase/migrations/20260811045139_create_book_function.sql にある。
  public func create(title: String, goal: String?) async throws -> String {
    _ = try await connection.requireUserId()

    do {
      let id: String = try await connection.client
        .rpc(
          "create_book",
          params: [
            "book_title": AnyJSON.string(title),
            "book_goal": goal.map(AnyJSON.string) ?? .null,
          ]
        )
        .execute()
        .value
      return id
    } catch {
      throw translate(error)
    }
  }

  /// 題名と目標を書き換える。
  ///
  /// 権限は編集者。教材は共有されているので、変えると参加者全員の本棚に
  /// 反映される（「追加と編集は全員に同期」の原則どおり）。
  public func update(id: String, title: String, goal: String?) async throws {
    do {
      try await connection.client
        .from("books")
        .update(["title": title, "goal": goal])
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// 本棚のステータスを変える。
  ///
  /// **自分の参加情報だけを書き換える。** 自分が読み終えても、まだ読んで
  /// いる人の「学習中」はそのまま残る。教材側に置くと、誰かが完了にした
  /// 瞬間に全員の本棚が完了になってしまう（2026-08-13に決着）。
  public func updateShelfStatus(id: String, status: ShelfStatus) async throws {
    let userId = try await connection.requireUserId()

    do {
      try await connection.client
        .from("memberships")
        .update(["shelf_status": status.rawValue])
        .eq("book_id", value: id)
        .eq("user_id", value: userId)  // ← 忘れると他人のステータスを上書きする
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func setCoverPath(id: String, path: String?) async throws {
    do {
      try await connection.client
        .from("books")
        .update(["cover_storage_path": path])
        .eq("id", value: id)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  // MARK: - 消す

  /// ゴミ箱へ。
  ///
  /// **自分の参加情報に印を付けるだけ。** 教材本体にも他の参加者にも
  /// 触れない。共有している教材を消しても、他のメンバーの本棚には残る。
  public func trash(id: String) async throws {
    let userId = try await connection.requireUserId()

    do {
      try await connection.client
        .from("memberships")
        .update(["deleted_at": ISO8601DateFormatter().string(from: Date())])
        .eq("book_id", value: id)
        .eq("user_id", value: userId)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func restore(id: String) async throws {
    let userId = try await connection.requireUserId()

    do {
      try await connection.client
        .from("memberships")
        .update(["deleted_at": String?.none])
        .eq("book_id", value: id)
        .eq("user_id", value: userId)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// ゴミ箱から完全に削除する。
  ///
  /// 自分の参加情報の行そのものを消す。他に参加者がいなければ
  /// `delete_orphan_book` トリガーが教材と配下をまとめて消す。
  ///
  /// **画像を先に消すこと。** データベースは連鎖するがストレージは連鎖しない。
  /// しかも参加情報が消えたあとはストレージのポリシーも通らなくなり、
  /// **本人にすら消せないファイルが残る**（実際に2件残っていて、
  /// ダッシュボードからしか消せない）。
  public func permanentlyDelete(id: String) async throws {
    let userId = try await connection.requireUserId()

    do {
      // 自分以外に参加者がいなければ、この削除で教材ごと消える
      let others = try await connection.client
        .from("memberships")
        .select("id", head: true, count: .exact)
        .eq("book_id", value: id)
        .neq("user_id", value: userId)
        .execute()
        .count ?? 0

      if others == 0 {
        try await attachments.removeBookImages(bookId: id)
      }

      try await connection.client
        .from("memberships")
        .delete()
        .eq("book_id", value: id)
        .eq("user_id", value: userId)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  public func listTrashed() async throws -> [TrashedBook] {
    let userId = try await connection.requireUserId()

    do {
      let rows: [TrashedBookRow] = try await connection.client
        .from("memberships")
        .select("deleted_at, books (id, title)")
        .eq("user_id", value: userId)
        .not("deleted_at", operator: .is, value: "null")
        .order("deleted_at", ascending: false)
        .execute()
        .value

      return rows.compactMap { row in
        guard let book = row.books, let deletedAt = row.deletedAt else { return nil }
        return TrashedBook(id: book.id, title: book.title, deletedAt: deletedAt)
      }
    } catch {
      throw translate(error)
    }
  }
}
