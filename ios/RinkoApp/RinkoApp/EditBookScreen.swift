import RinkoCore
import SwiftUI

/// 教材名と目標の編集。BookSummaryScreen から開く
struct EditBookScreen: View {
  let book: Book
  let repositories: AppRepositories
  let onSaved: () -> Void

  @Environment(\.dismiss) private var dismiss
  @State private var title: String
  @State private var goal: String
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
    }
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
