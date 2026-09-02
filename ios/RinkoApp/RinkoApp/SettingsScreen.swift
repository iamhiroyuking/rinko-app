import RinkoCore
import SwiftUI

/*
 設定。ログアウトとアカウント削除だけを持つ、いちばん小さい画面。

 **アカウント削除の導線はApp Storeの必須要件。** ガイドライン 5.1.1(v)
 が、アカウントを作れるアプリに「アプリ内から見つけやすい場所」での
 削除手段を義務付けている。本棚のツールバーから2タップで来られる
 場所に置いてあるのはそのため。

 記録は消えず、投稿者が「退会したユーザー」になる
 （`AuthRepository.deleteMyAccount` のコメント参照）。共有相手の
 スレッドが壊れないようにするための、削除ではなく個人情報の除去。
 */

struct SettingsScreen: View {
  let repositories: AppRepositories
  /// ログアウト・アカウント削除のどちらでも呼ぶ。関門を閉じる役目
  let onSignedOut: () -> Void

  @Environment(\.dismiss) private var dismiss

  @State private var working = false
  @State private var errorMessage: String?
  @State private var showingDeleteConfirm = false
  /// 誤タップで即削除されないよう、確認ダイアログの中でもう一段階挟む
  @State private var showingDeleteFinalConfirm = false

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Button("ログアウト") {
            Task { await signOut() }
          }
          .disabled(working)
        }

        Section {
          Button("アカウントを削除する", role: .destructive) {
            showingDeleteConfirm = true
          }
          .disabled(working)
        } footer: {
          Text(
            "投稿した記録は残り、投稿者は「退会したユーザー」と表示されます。共有相手の会話が壊れないようにするためです。取り消せません。"
          )
        }

        if let errorMessage {
          Section {
            Text(errorMessage).font(.callout).foregroundStyle(.red)
          }
        }
      }
      .navigationTitle("設定")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("閉じる") { dismiss() }
        }
      }
      .confirmationDialog(
        "アカウントを削除しますか？", isPresented: $showingDeleteConfirm,
        titleVisibility: .visible
      ) {
        Button("次へ", role: .destructive) { showingDeleteFinalConfirm = true }
      } message: {
        Text("投稿した記録は残り、あなたの表示名だけが「退会したユーザー」に変わります。元に戻せません。")
      }
      .confirmationDialog(
        "本当に削除しますか？", isPresented: $showingDeleteFinalConfirm,
        titleVisibility: .visible
      ) {
        Button("削除する", role: .destructive) {
          Task { await deleteAccount() }
        }
      } message: {
        Text("これが最後の確認です。取り消せません。")
      }
    }
  }

  private func signOut() async {
    working = true
    errorMessage = nil
    defer { working = false }

    do {
      try await repositories.auth.signOut()
      onSignedOut()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func deleteAccount() async {
    working = true
    errorMessage = nil
    defer { working = false }

    do {
      try await repositories.auth.deleteMyAccount()
      onSignedOut()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  SettingsScreen(repositories: .preview, onSignedOut: {})
}
