import Foundation
import RinkoCore
import Supabase

/*
 Supabaseとの通信口（#151）。

 Web版の `src/repository/supabase.ts` に当たる。**このモジュールの外へ
 `SupabaseClient` を出さない。** 画面は `RinkoCore` のプロトコルだけを見て、
 データの取り方を知らずに済ませる。取り方を変えたくなったときに画面を
 触らなくてよくするため。

 ■ 鍵の置き場所

 anon key は**ブラウザや端末に露出する前提の鍵**で、公開されても問題ない。
 データを守るのは鍵の秘匿ではなく、データベース側の行レベルセキュリティ。
 一方 service_role key は全ての制限を無視できるので、**絶対に置かない**。

 とはいえリポジトリは public なので、値そのものは `Secrets.xcconfig`
 （リポジトリに入れない）から `Info.plist` 経由で読む。
 手順は ios/README.md にある。
 */

public enum SupabaseConfigError: Error, CustomStringConvertible {
  case missing(String)
  case malformedURL(String)

  public var description: String {
    switch self {
    case .missing(let key):
      "\(key) が Info.plist にありません。ios/Secrets.xcconfig を作ってください（Secrets.xcconfig.example を参照）"
    case .malformedURL(let value):
      "SUPABASE_URL の形式が正しくありません: \(value)"
    }
  }
}

public struct SupabaseConfig: Sendable {
  public let url: URL
  public let anonKey: String

  public init(url: URL, anonKey: String) {
    self.url = url
    self.anonKey = anonKey
  }

  /// アプリの `Info.plist` から読む。値は `Secrets.xcconfig` から流し込まれる。
  ///
  /// **起動時に一度だけ呼び、失敗したらその場で落とす。** 鍵が無いまま
  /// 画面を出すと、すべての通信が同じ「読み込めません」になって
  /// 原因が見えなくなる。
  public static func fromBundle(_ bundle: Bundle = .main) throws -> SupabaseConfig {
    guard let rawURL = bundle.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
      !rawURL.isEmpty
    else { throw SupabaseConfigError.missing("SUPABASE_URL") }

    guard let key = bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
      !key.isEmpty
    else { throw SupabaseConfigError.missing("SUPABASE_ANON_KEY") }

    // xcconfig は値の中の `//` をコメントの開始として食べてしまうので、
    // スキームを別のキーに分けて渡している（README参照）。
    // ここでは組み立て済みの文字列を受け取る前提。
    guard let url = URL(string: rawURL), url.host != nil else {
      throw SupabaseConfigError.malformedURL(rawURL)
    }

    return SupabaseConfig(url: url, anonKey: key)
  }
}

/// アプリ全体で1つだけ持つ通信口。
///
/// `SupabaseClient` は内部で認証トークンの保存と自動更新を行う。
/// **作り直すとその状態が分かれる**ので、使い回す。
public final class Connection: Sendable {
  let client: SupabaseClient

  public init(config: SupabaseConfig) {
    self.client = SupabaseClient(
      supabaseURL: config.url,
      supabaseKey: config.anonKey
    )
  }

  /// ログイン中の利用者のid。無ければ nil。
  func currentUserId() async -> String? {
    try? await client.auth.session.user.id.uuidString.lowercased()
  }

  /// ログインが要る操作の入口。**書き込み系は必ずここを通す。**
  ///
  /// Web版の各関数が冒頭で `getUser()` を呼んで `'ログインが必要です'` を
  /// 投げているのと同じ役割。あちらは同じ4行が20箇所に散っているので、
  /// こちらは1箇所にまとめた。
  func requireUserId() async throws -> String {
    guard let id = await currentUserId() else {
      throw RinkoError("ログインが必要です")
    }
    return id
  }
}
