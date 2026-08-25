import RinkoCore
import RinkoSupabase
import SwiftUI

/*
 iOS版の入口（#147, #151）。

 **Supabaseに繋がった。** 偽の実装は `PreviewData` に残してあり、
 SwiftUIのプレビューではそちらを使う。

 Web版の `src/App.tsx` に当たる。あちらは未ログインを弾く関門を
 ルーティングに置いていたが、こちらは `body` の分岐で同じことをする。
 **未ログインでは中身が一切見えない**という決まりは変わらない。
 */

@main
struct RinkoApp: App {
  /// 鍵が読めなければ起動時に分かるようにしておく。
  ///
  /// 読めないまま画面を出すと、すべての通信が同じ「読み込めません」に
  /// なって原因が見えなくなる。
  private let setup: Result<AppRepositories, Error> = Result {
    AppRepositories.live(try SupabaseRepositories.fromBundle())
  }

  var body: some Scene {
    WindowGroup {
      switch setup {
      case .success(let repositories):
        RootScreen(repositories: repositories)
      case .failure(let error):
        SetupErrorScreen(message: String(describing: error))
      }
    }
  }
}

/// ログインの関門。
///
/// 起動時に保存されている状態を一度読む。`SupabaseClient` が
/// キーチェーンに置いて期限前に更新するので、**一度入れば再起動しても
/// 入ったまま**になる（Web版が再読み込みをまたいで保たれるのと同じ）。
struct RootScreen: View {
  let repositories: AppRepositories

  @State private var state: SignInState = .checking
  @State private var path = NavigationPath()

  /// ログイン済みのときに開く招待リンクの参加画面。
  ///
  /// 未ログインで開いた場合はここへは入れず `pendingJoinToken` に置く。
  /// ログインが終わってから改めてここへ移す（Web版の「関門の内側に
  /// あるので、未ログインならログイン画面へ送り、ログイン後に戻ってくる」
  /// と同じ考え方）。
  @State private var joinToken: JoinToken?
  @State private var pendingJoinToken: String?

  enum SignInState {
    case checking
    case signedOut
    case signedIn(userId: String)
  }

  var body: some View {
    Group {
      switch state {
      case .checking:
        ProgressView()
      case .signedOut:
        LoginScreen(auth: repositories.auth) {
          Task { await check() }
        }
      case .signedIn(let userId):
        NavigationStack(path: $path) {
          ShelfScreen(repositories: repositories, userId: userId)
            .navigationDestination(for: String.self) { bookId in
              BookSummaryScreen(bookId: bookId, repositories: repositories)
            }
        }
      }
    }
    .task { await check() }
    .onOpenURL { url in
      guard let token = Self.joinToken(from: url) else { return }
      if case .signedIn = state {
        joinToken = JoinToken(value: token)
      } else {
        pendingJoinToken = token
      }
    }
    .sheet(item: $joinToken) { token in
      JoinBookScreen(
        token: token.value, repositories: repositories,
        onJoined: { bookId in
          joinToken = nil
          path.append(bookId)
        },
        onDismiss: { joinToken = nil }
      )
    }
  }

  private func check() async {
    let userId = try? await repositories.auth.currentUserId()
    state = userId.map { SignInState.signedIn(userId: $0) } ?? .signedOut

    if case .signedIn = state, let pending = pendingJoinToken {
      pendingJoinToken = nil
      joinToken = JoinToken(value: pending)
    }
  }

  /// 招待リンクからトークンを取り出す。
  ///
  /// カスタムURLスキーム `rinko://join/<token>` だけを受ける。ユニバーサル
  /// リンク（`https://.../join/<token>`）は端末側の追加設定が要るため
  /// 未対応だが、パスの形は同じにしてあるので繋ぐときはここを直すだけでよい。
  private static func joinToken(from url: URL) -> String? {
    // カスタムURLスキーム（`rinko://join/<token>`）は "join" が
    // ホストとして解釈され、パスには含まれない。ユニバーサルリンク
    // （`https://.../join/<token>`）は "join" がパスの一部になる。
    // 両方の形を受けられるよう、ホストとパスの両方を見る
    if url.host == "join" {
      let parts = url.pathComponents.filter { $0 != "/" }
      return parts.first
    }

    let parts = url.pathComponents.filter { $0 != "/" }
    guard let index = parts.firstIndex(of: "join"), index + 1 < parts.count else {
      return nil
    }
    return parts[index + 1]
  }
}

/// `.sheet(item:)` に渡すための入れ物。トークンの文字列そのものを
/// `Identifiable` にするより、この画面専用の型を挟む方が影響範囲が狭い
private struct JoinToken: Identifiable {
  let value: String
  var id: String { value }
}

/// 鍵が読めなかったときに出す。**握り潰さない。**
///
/// 設定漏れは開発中にしか起きないが、黙って空の本棚を出すと
/// 「データが無い」のか「繋がっていない」のか見分けが付かない。
struct SetupErrorScreen: View {
  let message: String

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "exclamationmark.triangle")
        .font(.largeTitle)
        .foregroundStyle(.orange)
      Text("設定を読み込めませんでした").font(.headline)
      Text(message)
        .font(.caption)
        .foregroundStyle(.secondary)
        .multilineTextAlignment(.center)
    }
    .padding()
  }
}
