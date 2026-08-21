import Testing

@testable import RinkoCore

/// `src/repository/logs.test.ts` と `units.test.ts` から移した
private func log(
  _ id: String,
  _ createdAt: String,
  parent: String? = nil,
  pageStart: Int? = nil,
  pageEnd: Int? = nil
) -> LogEntry {
  LogEntry(
    id: id,
    authorId: "me",
    parentLogId: parent,
    body: id,
    pageStart: pageStart,
    pageEnd: pageEnd,
    createdAt: createdAt
  )
}

@Suite
struct BuildThreadsTests {

  @Test
  func rootsNewestFirst() {
    let threads = Threads.build([
      log("古い", "2026-08-01T00:00:00Z"),
      log("新しい", "2026-08-03T00:00:00Z"),
    ])
    #expect(threads.map(\.root.id) == ["新しい", "古い"])
  }

  @Test
  func repliesOldestFirst() {
    let threads = Threads.build([
      log("親", "2026-08-01T00:00:00Z"),
      log("返信2", "2026-08-03T00:00:00Z", parent: "親"),
      log("返信1", "2026-08-02T00:00:00Z", parent: "親"),
    ])
    #expect(threads.count == 1)
    #expect(threads[0].replies.map(\.id) == ["返信1", "返信2"])
  }

  @Test
  func orphanBecomesRoot() {
    let threads = Threads.build([
      log("迷子", "2026-08-01T00:00:00Z", parent: "存在しない")
    ])
    #expect(threads.map(\.root.id) == ["迷子"])
    #expect(threads[0].replies.isEmpty)
  }

  @Test
  func emptyStaysEmpty() {
    #expect(Threads.build([]).isEmpty)
  }
}

@Suite
struct SortByPageTests {

  @Test
  func ascendingByPage() {
    let threads = Threads.build([
      log("後ろ", "2026-08-01T00:00:00Z", pageStart: 50),
      log("前", "2026-08-02T00:00:00Z", pageStart: 10),
    ])
    #expect(Threads.sortByPage(threads).map(\.root.id) == ["前", "後ろ"])
  }

  @Test
  func fallsBackToEnd() {
    let threads = Threads.build([
      log("終点だけ", "2026-08-01T00:00:00Z", pageEnd: 5),
      log("始点あり", "2026-08-02T00:00:00Z", pageStart: 30),
    ])
    #expect(Threads.sortByPage(threads).map(\.root.id) == ["終点だけ", "始点あり"])
  }

  @Test
  func untaggedGoLast() {
    let threads = Threads.build([
      log("ページ無し", "2026-08-01T00:00:00Z"),
      log("ページあり", "2026-08-02T00:00:00Z", pageStart: 99),
    ])
    #expect(Threads.sortByPage(threads).map(\.root.id) == ["ページあり", "ページ無し"])
  }

  @Test
  func samePageOldestFirst() {
    let threads = Threads.build([
      log("後", "2026-08-05T00:00:00Z", pageStart: 10),
      log("先", "2026-08-04T00:00:00Z", pageStart: 10),
    ])
    #expect(Threads.sortByPage(threads).map(\.root.id) == ["先", "後"])
  }

  @Test
  func repliesStayWithRoot() {
    let threads = Threads.build([
      log("親", "2026-08-01T00:00:00Z", pageStart: 10),
      log("返信", "2026-08-02T00:00:00Z", parent: "親"),
      log("別の親", "2026-08-03T00:00:00Z", pageStart: 5),
    ])
    let sorted = Threads.sortByPage(threads)
    #expect(sorted.map(\.root.id) == ["別の親", "親"])
    #expect(sorted[1].replies.map(\.id) == ["返信"])
  }
}

@Suite
struct ProgressTests {

  private func unit(_ order: Int, _ status: UnitStatus) -> Unit {
    Unit(id: "u\(order)", order: order, status: status)
  }

  @Test
  func countsDone() {
    let progress = Progress.count([
      unit(1, .done), unit(2, .done), unit(3, .inProgress), unit(4, .notStarted),
    ])
    #expect(progress.done == 2)
    #expect(progress.total == 4)
    #expect(progress.percent == 50)
  }

  @Test
  func emptyIsZero() {
    let progress = Progress.count([])
    #expect(progress.total == 0)
    #expect(progress.percent == 0)
  }

  @Test
  func roundsPercent() {
    // 1/3 = 33.33... → 33
    #expect(Progress.count([unit(1, .done), unit(2, .notStarted), unit(3, .notStarted)]).percent == 33)
    // 2/3 = 66.66... → 67
    #expect(Progress.count([unit(1, .done), unit(2, .done), unit(3, .notStarted)]).percent == 67)
  }

  @Test
  func findsNext() {
    let units = [unit(1, .done), unit(2, .inProgress), unit(3, .notStarted)]
    #expect(Progress.findNext(units)?.order == 2)
  }

  @Test
  func allDoneHasNoNext() {
    #expect(Progress.findNext([unit(1, .done)]) == nil)
  }
}
