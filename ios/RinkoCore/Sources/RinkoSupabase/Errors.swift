import Foundation
import RinkoCore
import Supabase

/*
 失敗の翻訳（`src/lib/errorMessage.ts` に当たる）。

 **Supabaseの生の文言は英語で出る。** そのまま画面へ流すと
 `invalid login credentials` のような文字列が日本語のUIに混ざるので、
 データ取得層を出る前にここで包む。

 Web版との違いが1つある。あちらは「メッセージを取り出す」だけで
 中身は英語のまま出していたが、こちらは**よく出るものだけ日本語にする**。
 iOSはブラウザと違って利用者が原文を検索しにくいため。

 当てはまらないものは原文を残す。**握り潰さないこと。** 想定外の失敗を
 「エラーが発生しました」に丸めると、何が起きたか分からなくなる。
 */

func translate(_ error: Error) -> RinkoError {
  // 既に翻訳済みならそのまま通す。二重に包むと文言が入れ子になる
  if let rinko = error as? RinkoError { return rinko }

  let raw = message(of: error)

  if let known = knownMessage(for: raw) { return RinkoError(known) }

  return RinkoError(raw)
}

/// 投げられたものから人が読める文字列を取り出す
private func message(of error: Error) -> String {
  switch error {
  case let authError as AuthError:
    return authError.message
  case let apiError as PostgrestError:
    return apiError.message
  case let urlError as URLError:
    // 圏外・機内モードはアプリの不具合ではないので、そう見えるようにする
    switch urlError.code {
    case .notConnectedToInternet, .networkConnectionLost:
      return "インターネットに接続できません"
    case .timedOut:
      return "通信がタイムアウトしました。もう一度お試しください"
    default:
      return urlError.localizedDescription
    }
  default:
    return error.localizedDescription
  }
}

/// よく出るものだけ日本語にする。
///
/// 前方一致ではなく部分一致で見ているのは、Supabaseが文言の前後に
/// 文脈を足すことがあるため。
private func knownMessage(for raw: String) -> String? {
  let lower = raw.lowercased()

  // 認証
  if lower.contains("invalid login credentials") {
    return "メールアドレスかパスワードが違います"
  }
  if lower.contains("user already registered") || lower.contains("already been registered") {
    return "このメールアドレスは既に登録されています"
  }
  if lower.contains("password should be at least") {
    return "パスワードは6文字以上にしてください"
  }
  if lower.contains("unable to validate email address") || lower.contains("invalid email") {
    return "メールアドレスの形式が正しくありません"
  }
  if lower.contains("email not confirmed") {
    return "メールアドレスの確認が済んでいません"
  }

  // 権限。行レベルセキュリティに弾かれた形
  if lower.contains("row-level security") || lower.contains("violates row-level") {
    return "この操作を行う権限がありません"
  }
  if lower.contains("jwt expired") || lower.contains("invalid claim") {
    return "ログインの有効期限が切れました。もう一度ログインしてください"
  }

  // データベース側のトリガーが投げるものは、既に日本語で来る
  // （例: 「回を削除・復元できるのは作成者だけです」）。触らない

  return nil
}
