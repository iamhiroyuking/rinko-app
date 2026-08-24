import Foundation
import RinkoCore
import Supabase

/*
 認証（`src/repository/auth.ts` の移植）。

 **トークンの保存と自動更新はSDKに任せる。** `SupabaseClient` が
 キーチェーンに置いて期限前に更新するので、こちらで持ち回らない。
 Web版が `localStorage` に任せているのと同じ考え方。
 */
public struct SupabaseAuthRepository: AuthRepository {
  let connection: Connection

  public init(connection: Connection) {
    self.connection = connection
  }

  /// アカウントを作る。
  ///
  /// **表示名を `data` に載せるのを忘れないこと。** データベース側の
  /// `handle_new_user()` トリガーがこの値を読んで `profiles` の行を作る。
  /// 渡さないと表示名が「メールアドレスの@より前」になる。
  public func signUp(email: String, password: String, displayName: String) async throws {
    do {
      try await connection.client.auth.signUp(
        email: email,
        password: password,
        data: ["display_name": .string(displayName)]
      )
    } catch {
      throw translate(error)
    }
  }

  public func signIn(email: String, password: String) async throws {
    do {
      try await connection.client.auth.signIn(email: email, password: password)
    } catch {
      throw translate(error)
    }
  }

  public func signOut() async throws {
    do {
      try await connection.client.auth.signOut()
    } catch {
      throw translate(error)
    }
  }

  /// 保存されている状態を読む。起動時に一度呼ぶ。
  ///
  /// **ログインしていないのは失敗ではない**ので、投げずに nil を返す。
  public func currentUserId() async throws -> String? {
    await connection.currentUserId()
  }

  /// パスワード再設定のメールを送る。
  ///
  /// 登録されていないアドレスでもエラーにならない。これは仕様で、
  /// 「そのアドレスが登録済みか」を外部に知らせないため。画面側でも
  /// 送れたかどうかに関わらず同じ文言を出すこと。
  ///
  /// 飛び先はアプリのURLスキーム。Web版の `window.location.origin` に当たる。
  public func sendPasswordReset(email: String) async throws {
    do {
      try await connection.client.auth.resetPasswordForEmail(
        email,
        redirectTo: URL(string: "rinko://reset-password")
      )
    } catch {
      throw translate(error)
    }
  }

  public func updatePassword(_ newPassword: String) async throws {
    do {
      try await connection.client.auth.update(user: UserAttributes(password: newPassword))
    } catch {
      throw translate(error)
    }
  }

  /// アカウントを削除する（#145）。
  ///
  /// **引数を取らないのが要点。** idを渡せる形にすると「他人のアカウントを
  /// 消せる関数」になってしまう。誰を消すかはデータベース側が
  /// `auth.uid()` から決める。
  ///
  /// 記録は残り、投稿者は「退会したユーザー」になる。消すのは
  /// **個人への紐付けであって、書かれた中身ではない**（共有相手の画面で
  /// 議論が半分消えないようにするため）。
  ///
  /// 移行 `20260822090000_account_deletion.sql` の適用が要る。
  /// 未適用のまま呼ぶと「関数が見つからない」で失敗する。
  public func deleteMyAccount() async throws {
    _ = try await connection.requireUserId()
    do {
      try await connection.client.rpc("delete_my_account").execute()
    } catch {
      throw translate(error)
    }
    // 消えた本人の状態が端末に残らないよう、続けてログアウトする。
    // 失敗しても消えた事実は変わらないので、ここでは投げない。
    try? await connection.client.auth.signOut()
  }
}
