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
        NavigationStack {
          ShelfScreen(repositories: repositories, userId: userId)
        }
      }
    }
    .task { await check() }
  }

  private func check() async {
    let userId = try? await repositories.auth.currentUserId()
    state = userId.map { SignInState.signedIn(userId: $0) } ?? .signedOut
  }
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
