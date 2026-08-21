import Testing

@testable import RinkoCore

/// `src/repository/search.test.ts` と `activity.test.ts` から移した
private func log(
  _ id: String,
  type: LogType = .none,
  title: String? = nil,
  body: String = "",
  tags: [String] = [],
  resolved: String? = nil,
  order: Int = 1,
  created: String = "2026-08-01T00:00:00Z"
) -> SearchableLog {
  SearchableLog(
    id: id, unitId: "u", unitOrder: order, unitTitle: "第1回", authorId: "me",
    title: title, body: body, type: type, resolvedAt: resolved,
    tagNames: tags, createdAt: created, attachmentCount: 0)
}

@Suite
struct SearchTests {

  @Test
  func returnsNothingWithoutCriteria() {
    #expect(Search.filter([log("a", body: "正則化")], SearchCriteria()).isEmpty)
    #expect(Search.filter([log("a", body: "正則化")], SearchCriteria(query: "   ")).isEmpty)
  }

  @Test
  func recordsWhereItMatched() {
    let hits = Search.filter(
      [
        log("title", title: "正則化の話", body: "無関係"),
        log("body", body: "正則化について"),
        log("tag", body: "無関係", tags: ["正則化"]),
      ], SearchCriteria(query: "正則化"))
    #expect(Set(hits.map(\.id)) == ["title", "body", "tag"])
    #expect(hits.first { $0.id == "title" }?.matchedIn == [.title])
    #expect(hits.first { $0.id == "tag" }?.matchedIn == [.tag])
  }

  @Test
  func ignoresCase() {
    #expect(Search.filter([log("a", body: "Regularization")], SearchCriteria(query: "REGULARIZATION")).count == 1)
  }

  @Test
  func filtersByTypeAlone() {
    let hits = Search.filter(
      [log("q", type: .question), log("r", type: .review)],
      SearchCriteria(types: [.question]))
    #expect(hits.map(\.id) == ["q"])
    // キーワードが無いので、どこに当たったかは空
    #expect(hits.first?.matchedIn == [])
  }

  @Test
  func filtersByUnresolvedQuestion() {
    let hits = Search.filter(
      [
        log("未解決", type: .question),
        log("解決済み", type: .question, resolved: "2026-08-20T00:00:00Z"),
        log("復習", type: .review),
      ], SearchCriteria(unresolvedOnly: true))
    #expect(hits.map(\.id) == ["未解決"])
  }

  // 画面では両方を同時に選べない。ここは広く返さないための守り
  @Test
  func contradictoryCriteriaReturnNothing() {
    #expect(
      Search.filter(
        [log("q", type: .question), log("r", type: .review)],
        SearchCriteria(types: [.review], unresolvedOnly: true)
      ).isEmpty)
  }

  @Test
  func combinesAllAxes() {
    let hits = Search.filter(
      [
        log("全部満たす", type: .question, body: "正則化"),
        log("しおり無し", type: .question, body: "正則化"),
        log("種類違い", type: .review, body: "正則化"),
      ],
      SearchCriteria(query: "正則化", types: [.question], markedIds: ["全部満たす", "種類違い"]))
    #expect(hits.map(\.id) == ["全部満たす"])
  }

  @Test
  func sortsByUnitThenOldest() {
    let hits = Search.filter(
      [
        log("2回目の新しい方", body: "あ", order: 2, created: "2026-08-05T00:00:00Z"),
        log("2回目の古い方", body: "あ", order: 2, created: "2026-08-04T00:00:00Z"),
        log("1回目", body: "あ", order: 1, created: "2026-08-09T00:00:00Z"),
      ], SearchCriteria(query: "あ"))
    #expect(hits.map(\.id) == ["1回目", "2回目の古い方", "2回目の新しい方"])
  }

  @Test
  func ranksTagsByCountThenName() {
    let tags = Search.topTags([
      log("a", tags: ["線形代数", "固有値"]),
      log("b", tags: ["線形代数"]),
      log("c", tags: ["線形代数", "固有値"]),
      log("d", tags: ["行列式"]),
    ])
    #expect(tags == ["線形代数", "固有値", "行列式"])
    #expect(Search.topTags([log("a", tags: ["B", "A"])]) == ["A", "B"])
  }
}

@Suite
struct UpcomingTests {

  private func item(_ title: String, _ date: String?) -> UpcomingUnit {
    UpcomingUnit(
      bookId: title, bookTitle: title, unitId: title, order: 1, title: "第1回",
      scheduledDate: date, presenterName: nil, isMine: false)
  }

  @Test
  func soonestFirst() {
    #expect(Upcoming.sort([item("後", "2026-09-10"), item("先", "2026-09-01")]).map(\.bookTitle) == ["先", "後"])
  }

  @Test
  func undatedGoesLast() {
    #expect(Upcoming.sort([item("未定", nil), item("決定", "2026-09-10")]).map(\.bookTitle) == ["決定", "未定"])
  }

  @Test
  func tiesBreakOnTitle() {
    #expect(Upcoming.sort([item("B", "2026-09-01"), item("A", "2026-09-01")]).map(\.bookTitle) == ["A", "B"])
    #expect(Upcoming.sort([item("B", nil), item("A", nil)]).map(\.bookTitle) == ["A", "B"])
  }
}

@Suite
struct TagsTests {

  @Test
  func splitsOnSeparators() {
    #expect(Tags.parse("正則化 過学習") == ["正則化", "過学習"])
    #expect(Tags.parse("正則化,過学習、汎化") == ["正則化", "過学習", "汎化"])
  }

  // TypeScript版が `[\s,、#]+` で分けている。前置きではなく区切り
  @Test
  func hashIsASeparator() {
    #expect(Tags.parse("#正則化#過学習") == ["正則化", "過学習"])
  }

  @Test
  func dropsDuplicatesAndEmpty() {
    #expect(Tags.parse("正則化 正則化") == ["正則化"])
    #expect(Tags.parse("   ").isEmpty)
  }
}
