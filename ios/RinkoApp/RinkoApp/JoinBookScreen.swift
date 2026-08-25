import RinkoCore
import SwiftUI

/*
 招待リンクを開いたときの画面。Web版の `JoinBookView` に当たる。

 開いた時点で参加処理を行い、済んだらその教材へ送る。ここに来るのは
 ログイン済みの人だけ（`RootScreen` が関門の内側でしか出さない）。
 未ログインの人はログイン画面から入り、ログイン後に自動で処理される
 （`RootScreen.pendingJoinToken` を参照）。

 **ユニバーサルリンク（`https://rinko-app-silk.vercel.app/join/<token>`）は
 まだ端末側の設定（Associated Domains・Apple Developer のTeam ID・
 サーバー側の apple-app-site-association 配置）が要るため未対応。**
 カスタムURLスキーム `rinko://join/<token>` だけを受ける。招待リンクの
 手動貼り付けは `AddBookScreen` の「招待リンクで参加」タブが引き続き
 いちばん確実な入口（URLかトークンをそのまま貼れる）。
 */

struct JoinBookScreen: View {
  let token: String
  let repositories: AppRepositories
  /// 参加できたら、そのidを渡して呼ぶ。閉じる役目も兼ねる
  let onJoined: (String) -> Void
  let onDismiss: () -> Void

  private enum JoinState {
    case joining
    case error(String)
  }

  @State private var state: JoinState = .joining

  var body: some View {
    NavigationStack {
      VStack(spacing: 16) {
        switch state {
        case .joining:
          ProgressView("参加しています…")
        case .error(let message):
          VStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle")
              .font(.largeTitle)
              .foregroundStyle(.orange)
            Text(message).multilineTextAlignment(.center)
            Text("リンクが古いか、間違っている可能性があります。共有した人にもう一度もらってください。")
              .font(.caption)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }
          .padding()
        }
      }
      .navigationTitle("教材に参加")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("閉じる") { onDismiss() }
        }
      }
      .task { await join() }
    }
  }

  private func join() async {
    do {
      let bookId = try await repositories.invites.join(token: token)
      onJoined(bookId)
    } catch {
      state = .error((error as? RinkoError)?.message ?? error.localizedDescription)
    }
  }
}

#Preview {
  JoinBookScreen(token: "preview-token", repositories: .preview, onJoined: { _ in }, onDismiss: {})
}
