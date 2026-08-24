import Foundation
import RinkoCore
import Supabase

/*
 招待リンク（`src/repository/invites.ts` の移植）。

 発行のたびに増やすのではなく、権限ごとに1本を使い回す。同じ権限のリンクが
 複数あると、どれを配ったか分からなくなるため。権限が違うものは別のリンクにする。
 */
public struct SupabaseInviteRepository: InviteRepository {
  let connection: Connection

  public init(connection: Connection) {
    self.connection = connection
  }

  public func token(bookId: String, role: InviteRole) async throws -> String? {
    do {
      let rows: [TokenRow] = try await connection.client
        .from("invite_links")
        .select("token")
        .eq("book_id", value: bookId)
        .eq("role", value: role.rawValue)
        .order("created_at")
        .limit(1)
        .execute()
        .value
      return rows.first?.token
    } catch {
      throw translate(error)
    }
  }

  /// 招待リンクを発行する。同じ権限のものが既にあればそれを返す
  public func issue(bookId: String, role: InviteRole) async throws -> String {
    if let existing = try await token(bookId: bookId, role: role) {
      return existing
    }

    let userId = try await connection.requireUserId()

    do {
      let inserted: [TokenRow] = try await connection.client
        .from("invite_links")
        .insert([
          "book_id": bookId,
          "token": UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased(),
          "role": role.rawValue,
          "created_by": userId,
        ])
        .select("token")
        .execute()
        .value

      guard let token = inserted.first?.token else {
        throw RinkoError("招待リンクを発行できませんでした")
      }
      return token
    } catch {
      throw translate(error)
    }
  }

  /// **行そのものを消す。** 無効にした印を付ける形にすると、
  /// 「有効なリンクはどれか」を毎回判定することになり、消し忘れたリンクが
  /// 生き続ける事故に繋がる。既に参加している人はそのまま残る。
  public func revoke(bookId: String, role: InviteRole) async throws {
    do {
      try await connection.client
        .from("invite_links")
        .delete()
        .eq("book_id", value: bookId)
        .eq("role", value: role.rawValue)
        .execute()
    } catch {
      throw translate(error)
    }
  }

  /// 招待リンクで教材に参加し、その教材のidを返す。
  ///
  /// **データベース側の関数を呼ぶ。** 招待された人はまだ参加者ではないため、
  /// 通常の問い合わせでは `invite_links` を読めずトークンを照合できない。
  /// 関数は一度の挿入（on conflict）で済ませてあるので、同じ人が二度
  /// 開いても重複キーで落ちない（React の StrictMode で実際に踏んだ形）。
  public func join(token: String) async throws -> String {
    do {
      let bookId: String = try await connection.client
        .rpc("join_book_with_token", params: ["invite_token": token])
        .execute()
        .value
      return bookId
    } catch {
      throw translate(error)
    }
  }

  private struct TokenRow: Decodable, Sendable { let token: String }
}
