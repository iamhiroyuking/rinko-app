import RinkoCore
import SwiftUI

/*
 教材の概要。Web版の `BookSummaryView` に当たる。

 表示するのは書名・参加者・次回の担当者と日付・全体の進捗・目標・共有リンク。
 **教材全体に対する進捗を見せるのはこの画面の役割。** 個々の回のステータスを
 参加者なら誰でも変えられるのとは別に、本棚のステータス（学習中/完了など）は
 ここで手動変更する。回の状態からは自動計算しない。

 教材名の編集・削除もここから行う。
 */

struct BookSummaryScreen: View {
  let bookId: String
  let repositories: AppRepositories

  @State private var book: Book?
  @State private var members: [BookMember] = []
  @State private var units: [StudyUnit] = []
  @State private var shelfEntry: MyShelfEntry?
  @State private var logCount = 0
  @State private var unresolvedCount = 0
  @State private var editorToken: String?
  @State private var viewerToken: String?
  @State private var errorMessage: String?
  @State private var showingEdit = false
  @State private var showingDeleteConfirm = false
  @State private var goToSeminar = false
  @State private var coverURL: URL?

  private var progress: UnitProgress { Progress.count(units) }
  private var nextUnit: StudyUnit? { Progress.findNext(units) }

  var body: some View {
    List {
      if let book {
        Section {
          if let coverURL {
            HStack {
              Spacer()
              AsyncImage(url: coverURL) { image in
                image.resizable().scaledToFit()
              } placeholder: {
                Color.clear
              }
              .frame(height: 140)
              .clipShape(RoundedRectangle(cornerRadius: 8))
              Spacer()
            }
          }
          Text(book.title).font(.title3.weight(.bold))
          if let goal = book.goal, !goal.isEmpty {
            Text(goal).font(.callout).foregroundStyle(.secondary)
          }
        }

        Section("参加者") {
          if members.count > 1 {
            ForEach(members) { member in
              HStack {
                Text(member.displayName)
                Spacer()
                Text(member.role.label).font(.caption).foregroundStyle(.secondary)
              }
            }
          } else {
            Text("まだあなただけです").foregroundStyle(.secondary)
          }
        }

        Section("進み具合") {
          HStack {
            Text("\(progress.done) / \(progress.total) 回 完了")
            Spacer()
            Text("記録 \(logCount)件").font(.caption).foregroundStyle(.secondary)
          }
          ProgressView(value: Double(progress.percent), total: 100)

          if unresolvedCount > 0 {
            Text("未解決の疑問 \(unresolvedCount)件")
              .font(.caption).foregroundStyle(.orange)
          }

          if let nextUnit {
            VStack(alignment: .leading, spacing: 2) {
              Text("次にやること").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
              Text("第\(nextUnit.order)回　\(nextUnit.title)")
              if let date = nextUnit.scheduledDate {
                Text(date).font(.caption).foregroundStyle(.secondary)
              }
            }
            .padding(.top, 2)
          }
        }

        Section("本棚のステータス") {
          Picker("ステータス", selection: shelfBinding) {
            ForEach(ShelfStatus.allCases, id: \.self) { Text($0.label).tag($0) }
          }
          .pickerStyle(.segmented)
        }

        Section("共有リンク") {
          InviteRow(
            label: "書き込める", token: editorToken,
            onIssue: { Task { await issue(.editor) } },
            onRevoke: { Task { await revoke(.editor) } })
          InviteRow(
            label: "見るだけ", token: viewerToken,
            onIssue: { Task { await issue(.viewer) } },
            onRevoke: { Task { await revoke(.viewer) } })
        }

        Section {
          Button {
            goToSeminar = true
          } label: {
            Text("学習を開始する")
              .font(.headline)
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.borderedProminent)
          .listRowInsets(EdgeInsets())
          .listRowBackground(Color.clear)
          .padding(.vertical, 4)
        }

        Section {
          Button("教材を編集する") { showingEdit = true }
          Button("ゴミ箱へ入れる", role: .destructive) { showingDeleteConfirm = true }
        }
      }
    }
    .navigationTitle("教材")
    .navigationBarTitleDisplayMode(.inline)
    .navigationDestination(isPresented: $goToSeminar) {
      UnitListScreen(bookId: bookId, bookTitle: book?.title ?? "", repositories: repositories)
    }
    .refreshable { await load() }
    .task { await load() }
    .sheet(isPresented: $showingEdit) {
      if let book {
        EditBookScreen(book: book, repositories: repositories) {
          Task { await load() }
        }
      }
    }
    .confirmationDialog(
      "この教材をゴミ箱へ入れますか？", isPresented: $showingDeleteConfirm, titleVisibility: .visible
    ) {
      Button("ゴミ箱へ入れる", role: .destructive) { Task { await trash() } }
    } message: {
      Text("あなたの本棚から消えます。共有相手には残ります。")
    }
    .alert("エラー", isPresented: .constant(errorMessage != nil)) {
      Button("閉じる") { errorMessage = nil }
    } message: {
      Text(errorMessage ?? "")
    }
  }

  private var shelfBinding: Binding<ShelfStatus> {
    Binding(
      get: { shelfEntry?.shelfStatus ?? .reading },
      set: { newValue in Task { await updateShelf(newValue) } }
    )
  }

  private func load() async {
    do {
      async let bookTask = repositories.books.get(id: bookId)
      async let membersTask = repositories.members.list(bookId: bookId)
      async let unitsTask = repositories.units.list(bookId: bookId)
      async let logCountTask = repositories.logs.countInBook(bookId: bookId)
      async let unresolvedTask = repositories.logs.countUnresolvedQuestions(bookId: bookId)
      async let editorTask = repositories.invites.token(bookId: bookId, role: .editor)
      async let viewerTask = repositories.invites.token(bookId: bookId, role: .viewer)
      async let shelfTask = repositories.books.getMyShelfEntry(id: bookId)

      book = try await bookTask
      members = try await membersTask
      units = try await unitsTask
      logCount = try await logCountTask
      unresolvedCount = try await unresolvedTask
      editorToken = try await editorTask
      viewerToken = try await viewerTask
      shelfEntry = try await shelfTask

      if let path = book?.coverStoragePath {
        coverURL = try await repositories.attachments.signedURLs(paths: [path])[path]
      } else {
        coverURL = nil
      }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func updateShelf(_ status: ShelfStatus) async {
    do {
      try await repositories.books.updateShelfStatus(id: bookId, status: status)
      shelfEntry = MyShelfEntry(shelfStatus: status, joinedAt: shelfEntry?.joinedAt ?? "")
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func issue(_ role: InviteRole) async {
    do {
      let token = try await repositories.invites.issue(bookId: bookId, role: role)
      if role == .editor { editorToken = token } else { viewerToken = token }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func revoke(_ role: InviteRole) async {
    do {
      try await repositories.invites.revoke(bookId: bookId, role: role)
      if role == .editor { editorToken = nil } else { viewerToken = nil }
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }

  private func trash() async {
    do {
      try await repositories.books.trash(id: bookId)
    } catch {
      errorMessage = (error as? RinkoError)?.message ?? error.localizedDescription
    }
  }
}

private struct InviteRow: View {
  let label: String
  let token: String?
  let onIssue: () -> Void
  let onRevoke: () -> Void

  var body: some View {
    HStack {
      Text(label)
      Spacer()
      if let token {
        ShareLink(item: "https://rinko-app-silk.vercel.app/join/\(token)") {
          Label("共有", systemImage: "square.and.arrow.up")
        }
        .font(.caption)
        Button("無効にする", role: .destructive, action: onRevoke)
          .font(.caption)
      } else {
        Button("発行する", action: onIssue).font(.caption)
      }
    }
  }
}

#Preview {
  NavigationStack {
    BookSummaryScreen(bookId: "book-prml", repositories: .preview)
  }
}
