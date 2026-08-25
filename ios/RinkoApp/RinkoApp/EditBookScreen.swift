import RinkoCore
import SwiftUI
import UIKit

/// 教材名・目標・表紙の編集。BookSummaryScreen から開く
struct EditBookScreen: View {
  let book: Book
  let repositories: AppRepositories
  let onSaved: () -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var title: String
  @State private var goal: String
  @State private var coverPayload: ImagePayload?
  @State private var coverPreview: UIImage?
  @State private var working = false
  @State private var errorMessage: String?

  init(book: Book, repositories: AppRepositories, onSaved: @escaping () -> Void) {
    self.book = book
    self.repositories = repositories
    self.onSaved = onSaved
    _title = State(initialValue: book.title)
    _goal = State(initialValue: book.goal ?? "")
  }

  private var canSubmit: Bool {
    !working && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
  }

  var body: some View {
    NavigationStack {
      Form {
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
        if let errorMessage {
          Section {
            Text(errorMessage).font(.callout).foregroundStyle(.red)
          }
        }
      }
      .navigationTitle("教材を編集")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("キャンセル") { dismiss() }
        }
        ToolbarItem(placement: .confirmationAction) {
          if working {
            ProgressView()
          } else {
            Button("保存") { Task { await submit() } }.disabled(!canSubmit)
          }
        }
      }
      .task { await loadCurrentCover() }
    }
  }

  /// いまの表紙をプレビューに出す。選び直さなければそのまま
  private func loadCurrentCover() async {
    guard let path = book.coverStoragePath else { return }
    guard let url = try? await repositories.attachments.signedURLs(paths: [path])[path] else { return }
    guard let (data, _) = try? await URLSession.shared.data(from: url) else { return }
    coverPreview = UIImage(data: data)
  }

  private func submit() async {
    working = true
    errorMessage = nil
    defer { working = false }

    do {
      try await repositories.books.update(
        id: book.id,
        title: title.trimmingCharacters(in: .whitespacesAndNewlines),
        goal: goal.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : goal
      )

      // 選び直したときだけ差し替える。古い画像は消さない
      // （記録の添付と違って表紙は1枚だけなので、実害は小さい）
      if let coverPayload {
        let path = try await repositories.attachments.uploadBookCover(bookId: book.id, image: coverPayload)
        try await repositories.books.setCoverPath(id: book.id, path: path)
      }

      onSaved()
      dismiss()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  EditBookScreen(
    book: Book(id: "book-prml", title: "パターン認識と機械学習", goal: nil, coverStoragePath: nil, createdBy: "me"),
    repositories: .preview, onSaved: {})
}
