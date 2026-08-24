import RinkoCore
import SwiftUI

/*
 回の作成と編集。Web版の `CreateUnitView` に当たる。

 輪講日は自動で埋めない。行事などで不規則になるため手動で入力する。
 担当者の自動ローテーション割り当ても行わない。

 第N回の番号は新規作成では出さない。教材の最大値に1を足す形で
 データベース側が決める（`UnitRepository.create`）。編集のときだけ
 既存の番号が見えるが、番号そのものはここでは変えられない
 （変えたいときは順序の入れ替えではなく個別の編集で手当てする、
 という決定はWeb版から引き継いでいない。番号編集の画面は未実装）。
 */

struct CreateUnitScreen: View {
  let bookId: String
  let members: [BookMember]
  let repositories: AppRepositories
  var editing: StudyUnit?
  let onSaved: () -> Void

  @Environment(\.dismiss) private var dismiss

  @State private var title = ""
  @State private var objective = ""
  @State private var presenterId = ""
  @State private var scheduledDate = ""
  @State private var pageFrom = ""
  @State private var pageTo = ""
  @State private var startNote = ""
  @State private var working = false
  @State private var errorMessage: String?

  private var isEditing: Bool { editing != nil }

  private var pageError: String? {
    PageRange.validate(
      start: PageRange.toPageNumber(pageFrom),
      end: PageRange.toPageNumber(pageTo))
  }

  private var canSubmit: Bool {
    !working && !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && pageError == nil
  }

  var body: some View {
    NavigationStack {
      Form {
        if let editing {
          Section {
            Text("第\(editing.order)回")
              .foregroundStyle(.secondary)
          }
        }

        Section("タイトル") {
          TextField("タイトル", text: $title)
        }

        Section("この回で学ぶこと（任意）") {
          TextEditor(text: $objective).frame(minHeight: 80)
        }

        Section("担当者（任意）") {
          Picker("担当者", selection: $presenterId) {
            Text("指定しない").tag("")
            ForEach(members) { member in
              Text(member.displayName).tag(member.id)
            }
          }
        }

        Section("輪講の日（任意）") {
          TextField("YYYY-MM-DD", text: $scheduledDate)
            .keyboardType(.numbersAndPunctuation)
        }

        Section("進んだページ（任意）") {
          HStack {
            TextField("開始", text: $pageFrom).keyboardType(.numberPad)
            Text("〜")
            TextField("終了", text: $pageTo).keyboardType(.numberPad)
          }
          if let pageError {
            Text(pageError).font(.caption).foregroundStyle(.red)
          }
        }

        Section("開始箇所のメモ（任意）") {
          TextEditor(text: $startNote).frame(minHeight: 60)
        }

        if let errorMessage {
          Section {
            Text(errorMessage).font(.callout).foregroundStyle(.red)
          }
        }
      }
      .navigationTitle(isEditing ? "回を編集" : "回を作成")
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
      .task { load() }
    }
  }

  private func load() {
    guard let editing else { return }
    title = editing.title
    presenterId = editing.presenterId ?? ""
    scheduledDate = editing.scheduledDate ?? ""
    pageFrom = editing.pageFrom.map(String.init) ?? ""
    pageTo = editing.pageTo.map(String.init) ?? ""
  }

  private func submit() async {
    working = true
    errorMessage = nil
    defer { working = false }

    let input = NewUnit(
      bookId: bookId,
      title: title.trimmingCharacters(in: .whitespacesAndNewlines),
      objective: objective.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        ? nil : objective,
      presenterId: presenterId.isEmpty ? nil : presenterId,
      scheduledDate: scheduledDate.isEmpty ? nil : scheduledDate,
      pageFrom: PageRange.toPageNumber(pageFrom),
      pageTo: PageRange.toPageNumber(pageTo),
      startNote: startNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        ? nil : startNote
    )

    do {
      if let editing {
        try await repositories.units.update(id: editing.id, input)
      } else {
        _ = try await repositories.units.create(input)
      }
      onSaved()
      dismiss()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  CreateUnitScreen(bookId: "book-prml", members: PreviewData.members, repositories: .preview, onSaved: {})
}
