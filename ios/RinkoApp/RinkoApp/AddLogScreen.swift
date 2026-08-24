import RinkoCore
import SwiftUI

/*
 発言の投稿と編集。Web版の `AddLogView` に当たる。

 **既存のログがあれば編集、無ければ新規。** フォームの中身が同じなので、
 画面を2つに分けず1つで両方を受け持っている（Web版と同じ判断）。
 返信のときは `parentLogId` が入る。

 タグはサジェストを出さず、入力を解いた結果をチップで見せるだけ。
 Web版も同じで、`Tags.parse` が表記を揃える役目を持つ
 （`#a#b` は2つのタグ、前後の空白と重複は落ちる）。

 下書き保存は行わない（要件どおり）。
 */

struct AddLogScreen: View {
  let unitId: String
  let repositories: AppRepositories
  /// 編集のときだけ入る
  var editing: LogEntry?
  /// 返信のときだけ入る
  var parentLogId: String?
  /// 保存できたら呼ぶ。画面を閉じる役目
  let onSaved: () -> Void

  @Environment(\.dismiss) private var dismiss

  @State private var type: LogType = .none
  @State private var title = ""
  @State private var bodyText = ""
  @State private var pageStart = ""
  @State private var pageEnd = ""
  @State private var tagInput = ""
  @State private var working = false
  @State private var errorMessage: String?

  private var isEditing: Bool { editing != nil }
  private var isReply: Bool { parentLogId != nil }

  private var tagNames: [String] { Tags.parse(tagInput) }

  private var pageError: String? {
    PageRange.validate(
      start: PageRange.toPageNumber(pageStart),
      end: PageRange.toPageNumber(pageEnd))
  }

  private var canSubmit: Bool {
    !working && !bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && pageError == nil
  }

  var body: some View {
    NavigationStack {
      Form {
        // 返信は本文だけ。種類やページを持たない設計（#61）
        if !isReply {
          Section("種類") {
            Picker("種類", selection: $type) {
              ForEach(LogType.allCases, id: \.self) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
          }

          Section("ページ") {
            HStack {
              TextField("開始", text: $pageStart).keyboardType(.numberPad)
              Text("〜")
              TextField("終了", text: $pageEnd).keyboardType(.numberPad)
            }
            if let pageError {
              Text(pageError).font(.caption).foregroundStyle(.red)
            }
          }

          TextField("タイトル（任意）", text: $title)
        }

        Section(isReply ? "返信" : "本文") {
          TextEditor(text: $bodyText)
            .frame(minHeight: 120)
        }

        if !isReply {
          Section("ハッシュタグ（任意）") {
            TextField("空白か # で区切る", text: $tagInput)
            if !tagNames.isEmpty {
              HStack {
                ForEach(tagNames, id: \.self) { name in
                  Text("#\(name)")
                    .font(.caption2)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(.green.opacity(0.12), in: Capsule())
                    .foregroundStyle(.green)
                }
              }
            }
          }
        }

        if let errorMessage {
          Section {
            Text(errorMessage).font(.callout).foregroundStyle(.red)
          }
        }
      }
      .navigationTitle(isEditing ? "編集" : (isReply ? "返信" : "発言する"))
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
    type = editing.type
    title = editing.title ?? ""
    bodyText = editing.body
    pageStart = editing.pageStart.map(String.init) ?? ""
    pageEnd = editing.pageEnd.map(String.init) ?? ""
    tagInput = editing.tagNames.joined(separator: " ")
  }

  private func submit() async {
    working = true
    errorMessage = nil
    defer { working = false }

    let input = NewLog(
      unitId: unitId,
      type: isReply ? .none : type,
      title: isReply ? nil : (title.isEmpty ? nil : title),
      body: bodyText,
      pageStart: isReply ? nil : PageRange.toPageNumber(pageStart),
      pageEnd: isReply ? nil : PageRange.toPageNumber(pageEnd),
      tagNames: isReply ? [] : tagNames,
      parentLogId: parentLogId
    )

    do {
      if let editing {
        try await repositories.logs.update(id: editing.id, input)
      } else {
        _ = try await repositories.logs.create(input)
      }
      onSaved()
      dismiss()
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

#Preview {
  AddLogScreen(unitId: "unit-2", repositories: .preview, onSaved: {})
}
