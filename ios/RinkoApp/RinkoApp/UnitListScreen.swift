import RinkoCore
import SwiftUI

/// 回の一覧。Web版の `SeminarView` に当たる
struct UnitListScreen: View {
  let bookId: String
  let bookTitle: String
  let units: any UnitRepository
  let members: any MemberRepository

  @State private var list: [StudyUnit] = []
  @State private var memberList: [BookMember] = []

  private var progress: UnitProgress { Progress.count(list) }

  var body: some View {
    List {
      if !list.isEmpty {
        Section {
          VStack(alignment: .leading, spacing: 6) {
            HStack {
              Text("進み具合").font(.caption.weight(.semibold))
              Spacer()
              Text("\(progress.done) / \(progress.total) 回 完了")
                .font(.caption).foregroundStyle(.secondary)
            }
            ProgressView(value: Double(progress.percent), total: 100)
          }
          .padding(.vertical, 4)
        }
      }

      Section {
        ForEach(list) { unit in
          NavigationLink {
            UnitScreen(
              unitId: unit.id, logs: FakeLogRepository(),
              units: units, members: members)
          } label: {
            UnitRow(unit: unit, presenterName: name(of: unit.presenterId))
          }
        }
      }
    }
    .navigationTitle(bookTitle)
    .navigationBarTitleDisplayMode(.inline)
    .task {
      list = (try? await units.list(bookId: bookId)) ?? []
      memberList = (try? await members.list(bookId: bookId)) ?? []
    }
  }

  private func name(of userId: String?) -> String? {
    guard let userId else { return nil }
    return memberList.first { $0.id == userId }?.displayName
  }
}

private struct UnitRow: View {
  let unit: StudyUnit
  let presenterName: String?

  var body: some View {
    HStack(spacing: 10) {
      Text("第\(unit.order)回")
        .font(.caption.monospaced())
        .foregroundStyle(.secondary)
        .frame(width: 48, alignment: .leading)

      VStack(alignment: .leading, spacing: 2) {
        Text(unit.title).font(.callout.weight(.semibold))

        HStack(spacing: 4) {
          if let presenterName { Text(presenterName) }
          if let date = unit.scheduledDate { Text("・ \(date)") }
          if let pages = PageRange.formatUnit(start: unit.pageFrom, end: unit.pageTo) {
            Text("・ \(pages)").monospaced()
          }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
      }

      Spacer()
      StatusPill(status: unit.status)
    }
    .padding(.vertical, 2)
  }
}

struct StatusPill: View {
  let status: UnitStatus

  private var tint: Color {
    switch status {
    case .notStarted: .secondary
    case .inProgress: .orange
    case .done: .green
    }
  }

  var body: some View {
    Text(status.label)
      .font(.caption2.weight(.bold))
      .padding(.horizontal, 8)
      .padding(.vertical, 3)
      .background(tint.opacity(0.15), in: Capsule())
      .foregroundStyle(tint)
  }
}

#Preview {
  NavigationStack {
    UnitListScreen(
      bookId: "book-prml", bookTitle: "パターン認識と機械学習",
      units: FakeUnitRepository(), members: FakeMemberRepository())
  }
}
