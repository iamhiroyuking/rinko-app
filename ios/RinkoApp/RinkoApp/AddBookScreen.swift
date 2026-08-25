import RinkoCore
import UIKit
import SwiftUI

/*
 教材を増やす。Web版の `AddBookView` に当たる。

 2つのモードを持つ。**新規作成**（書名・目標・表紙を入力）と、
 **招待リンクで参加**（受け取ったリンクを貼る）。

 表紙は**教材を作ってから**アップロードする。置き場所（パス）が
 `<book_id>/cover/…` で、作る前はidが無く場所が決まらないため
 （記録の画像と同じ理由）。
 */

struct AddBookScreen: View {
  let repositories: AppRepositories
  /// 作成／参加できたら、そのidを渡して呼ぶ
  let onCreated: (String) -> Void

  @Environment(\.dismiss) private var dismiss

  private enum Mode: String, CaseIterable {
    case create, join
    var label: String { self == .create ? "新規作成" : "招待リンクで参加" }
  }

  @State private var mode: Mode = .create
  @State private var title = ""
  @State private var goal = ""
  @State private var inviteInput = ""
  @State private var coverPayload: ImagePayload?
  @State private var coverPreview: UIImage?
  @State private var working = false
  @State private var errorMessage: String?

  private var canSubmit: Bool {
    guard !working else { return false }
    switch mode {
    case .create: return !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    case .join: return !inviteInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
  }

  var body: some View {
    NavigationStack {
      Form {
        Section {
          Picker("", selection: $mode) {
            ForEach(Mode.allCases, id: \.self) { Text($0.label).tag($0) }
          }
          .pickerStyle(.segmented)
          .labelsHidden()
          .listRowInsets(EdgeInsets())
          .listRowBackground(Color.clear)
        }

        if mode == .create {
          Section {
            HStack {
              Spacer()
              CoverPicker(payload: $coverPayload, previewImage: $coverPreview)
              Spacer()
            }
          }

          Section("書名") {
            TextField("書名", text: $title)
          }
          Section("目標（任意）") {
            TextEditor(text: $goal).frame(minHeight: 100)
          }
        } else {
          Section {
            TextField("リンクまたはトークンを貼り付け", text: $inviteInput)
              .textInputAutocapitalization(.never)
              .autocorrectionDisabled()
          } header: {
            Text("招待リンク")
          } footer: {
            Text("URLをそのまま貼っても、トークンだけを貼っても参加できます")
          }
        }

        if let errorMessage {
          Section {
            Text(errorMessage).font(.callout).foregroundStyle(.red)
          }
        }
      }
      .navigationTitle("教材を増やす")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("キャンセル") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          if working {
            ProgressView()
          } else {
            Button(mode == .create ? "作成" : "参加") { Task { await submit() } }
              .disabled(!canSubmit)
          }
        }
      }
    }
  }

  /// 貼り付けられた文字列からトークンを取り出す。
  /// URLをそのまま貼っても、トークンだけを貼っても通るようにする
  private func extractToken(_ input: String) -> String {
    let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
    if let range = trimmed.range(of: #"/join/([A-Za-z0-9]+)"#, options: .regularExpression) {
      return String(trimmed[range].split(separator: "/").last ?? Substring(trimmed))
    }
    return trimmed
  }

  private func submit() async {
    working = true
    errorMessage = nil
    defer { working = false }

    do {
      let id: String
      switch mode {
      case .create:
        id = try await repositories.books.create(
          title: title.trimmingCharacters(in: .whitespacesAndNewlines),
          goal: goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : goal
        )
        if let coverPayload {
          let path = try await repositories.attachments.uploadBookCover(bookId: id, image: coverPayload)
          try await repositories.books.setCoverPath(id: id, path: path)
        }
      case .join:
        id = try await repositories.invites.join(token: extractToken(inviteInput))
      }
      onCreated(id)
      dismiss()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  AddBookScreen(repositories: .preview, onCreated: { _ in })
}
