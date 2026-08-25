import RinkoCore
import SwiftUI

/*
 ログイン。Web版の `LoginView` に当たる。

 **未ログインでは中身が一切見えない**という決まりなので、ここを通らないと
 他の画面には行けない（`RinkoApp` の関門）。

 サインアップで表示名を受け取るのは、データベース側の `handle_new_user()`
 トリガーがこれを読んで `profiles` の行を作るため。渡さないと表示名が
 「メールアドレスの@より前」になる。

 メール確認は意図的に無効にしてある。Supabase無料枠の標準メール送信は
 迷惑メールに入りやすく、**招待した相手がサインアップできず詰まる**恐れが
 あるため（CLAUDE.md）。そのためサインアップ直後にそのまま入れる。
 */

struct LoginScreen: View {
  let auth: any AuthRepository
  /// ログインできたら呼ぶ。関門を開ける役目
  let onSignedIn: () -> Void

  @State private var mode: Mode = .signIn
  @State private var email = ""
  @State private var password = ""
  @State private var displayName = ""
  @State private var errorMessage: String?
  @State private var working = false

  enum Mode {
    case signIn, signUp
    var label: String { self == .signIn ? "ログイン" : "アカウントを作る" }
  }

  private var canSubmit: Bool {
    guard !working, !email.isEmpty, !password.isEmpty else { return false }
    // 表示名は後から変えられないので、空のまま作らせない
    return mode == .signIn || !displayName.trimmingCharacters(in: .whitespaces).isEmpty
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker("ログインかアカウント作成か", selection: $mode) {
            Text("ログイン").tag(Mode.signIn)
            Text("アカウントを作る").tag(Mode.signUp)
          }
          .pickerStyle(.segmented)
          .listRowInsets(EdgeInsets())
          .listRowBackground(Color.clear)
        }

        Section {
          if mode == .signUp {
            TextField("表示名", text: $displayName)
              .textContentType(.name)
          }

          TextField("メールアドレス", text: $email)
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()

          SecureField("パスワード", text: $password)
            .textContentType(mode == .signIn ? .password : .newPassword)
        } footer: {
          if mode == .signUp {
            Text("パスワードは6文字以上。表示名は記録の投稿者として共有相手に見えます")
          }
        }

        Section {
          Button {
            Task { await submit() }
          } label: {
            HStack {
              Spacer()
              if working {
                ProgressView()
              } else {
                Text(mode.label).fontWeight(.semibold)
              }
              Spacer()
            }
          }
          .disabled(!canSubmit)
        }

        if let errorMessage {
          Section {
            Text(errorMessage)
              .font(.callout)
              .foregroundStyle(.red)
          }
        }
      }
      .navigationTitle("輪講")
    }
  }

  private func submit() async {
    working = true
    errorMessage = nil
    defer { working = false }

    do {
      switch mode {
      case .signIn:
        try await auth.signIn(email: email, password: password)
      case .signUp:
        try await auth.signUp(
          email: email, password: password,
          displayName: displayName.trimmingCharacters(in: .whitespaces))
      }
      onSignedIn()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  LoginScreen(auth: FakeAuthRepository(), onSignedIn: {})
}
