import Foundation

/*
 画面を組むための偽のデータと偽の実装。

 **本番のバンドルに入れないこと。** 今は同じモジュールに置いているが、
 Supabaseに繋ぐ実装が入った時点で、SwiftUIのプレビュー専用に切り分ける。

 なぜ先に作るか。プロトコル（`Repositories.swift`）だけでは画面を動かせず、
 かといってSupabaseを先に繋ぐと**ネットワークと画面の不具合を同時に
 見ることになる**。偽の実装を挟むと、画面だけを切り離して確かめられる。

 Web版で `src/dev/seed.ts` が果たしていた役割に近い。あちらは本物の
 データベースに書いたが、こちらは書かずに済むぶん速い。
 */

public enum PreviewData {

  public static let me = "me"
  public static let friend = "friend"

  public static let books: [ShelfBook] = [
    ShelfBook(
      id: "book-prml", title: "パターン認識と機械学習",
      coverStoragePath: nil, shelfStatus: .reading, memberCount: 3),
    ShelfBook(
      id: "book-dl", title: "ゼロから作るDeep Learning",
      coverStoragePath: nil, shelfStatus: .reading, memberCount: 1),
    ShelfBook(
      id: "book-linear", title: "線形代数",
      coverStoragePath: nil, shelfStatus: .reading, memberCount: 4),
  ]

  public static let units: [StudyUnit] = [
    StudyUnit(
      id: "unit-1", order: 1, title: "序章と確率の復習", status: .done,
      presenterId: me, scheduledDate: "2026-08-07", pageFrom: 1, pageTo: 22),
    StudyUnit(
      id: "unit-2", order: 2, title: "線形回帰モデル", status: .inProgress,
      presenterId: me, scheduledDate: "2026-08-21", pageFrom: 23, pageTo: 58),
    StudyUnit(
      id: "unit-3", order: 3, title: "カーネル法", status: .notStarted,
      presenterId: friend, scheduledDate: "2026-08-28", pageFrom: 59, pageTo: 92),
  ]

  /// 種類・解決済み・返信が一通り揃うようにしてある
  public static let logs: [LogEntry] = [
    LogEntry(
      id: "log-preview", authorId: me, type: .preview,
      title: "最小二乗法は最尤推定と一致する",
      body: "誤差にガウス分布を仮定すると、対数尤度の最大化が二乗誤差の最小化と同じ式になる。",
      pageStart: 24, pageEnd: 27, createdAt: "2026-08-21T09:00:00Z",
      tagNames: ["最尤推定", "線形回帰"]),
    LogEntry(
      id: "log-solved", authorId: me, type: .question,
      title: "正則化項はなぜ二乗和なのか",
      body: "L1でもよさそうに見えるのに、まず出てくるのがL2なのはなぜ？",
      pageStart: 31, createdAt: "2026-08-21T09:10:00Z",
      resolvedAt: "2026-08-21T10:00:00Z", tagNames: ["正則化"]),
    LogEntry(
      id: "log-reply-1", authorId: friend, parentLogId: "log-solved",
      body: "L2は解が閉じた形で書けるからだと思う。微分がきれいに解ける。",
      createdAt: "2026-08-21T09:20:00Z"),
    LogEntry(
      id: "log-reply-2", authorId: me, parentLogId: "log-solved",
      body: "なるほど。L1は3.1.4で出てきて、そちらはスパースになる利点があると書いてある。",
      createdAt: "2026-08-21T09:30:00Z"),
    LogEntry(
      id: "log-open", authorId: friend, type: .question,
      title: "ハイパーパラメータλはどう決める？",
      body: "交差検証で決めると書いてあるが、計算量が現実的なのか気になる。",
      pageStart: 35, createdAt: "2026-08-21T09:40:00Z",
      tagNames: ["正則化", "交差検証"]),
    LogEntry(
      id: "log-review", authorId: me, type: .review, title: "今日の要点",
      body: "**正則化は事前分布の形で入ってくる**、というのが一番の収穫。\n\n- 最小二乗 = 最尤推定\n- L2正則化 = 重みにガウス事前分布",
      pageStart: 23, pageEnd: 40, createdAt: "2026-08-21T09:50:00Z",
      tagNames: ["正則化", "MAP推定"]),
  ]

  public static let members: [BookMember] = [
    BookMember(id: me, displayName: "ひろゆき", role: .editor),
    BookMember(id: friend, displayName: "たなか", role: .editor),
  ]

  public static let upcoming: [UpcomingUnit] = [
    UpcomingUnit(
      bookId: "book-prml", bookTitle: "パターン認識と機械学習",
      unitId: "unit-2", order: 2, title: "線形回帰モデル",
      scheduledDate: "2026-08-21", presenterName: "ひろゆき", isMine: true),
    UpcomingUnit(
      bookId: "book-linear", bookTitle: "線形代数",
      unitId: "unit-x", order: 1, title: "行列式",
      scheduledDate: "2026-08-25", presenterName: "たなか", isMine: false),
  ]

  /// 新着の数。線形代数にだけ付く（他人が書いたものだけ数える決まり）
  public static let newCounts: [String: Int] = ["book-linear": 3]
}

/// 偽の実装。ネットワークを使わずに画面を動かす
public struct FakeBookRepository: BookRepository {
  public init() {}

  public func listShelf(status: ShelfStatus) async throws -> [ShelfBook] {
    PreviewData.books.filter { $0.shelfStatus == status }
  }
  public func countShelf(status: ShelfStatus) async throws -> Int {
    try await listShelf(status: status).count
  }
  public func get(id: String) async throws -> Book? {
    guard let shelf = PreviewData.books.first(where: { $0.id == id }) else { return nil }
    return Book(
      id: shelf.id, title: shelf.title,
      goal: "12月までに上巻を読み切る\n演習は各章3問ずつ解く",
      coverStoragePath: nil, createdBy: PreviewData.me)
  }
  public func create(title: String, goal: String?) async throws -> String { "new-book" }
  public func update(id: String, title: String, goal: String?) async throws {}
  public func updateShelfStatus(id: String, status: ShelfStatus) async throws {}
  public func setCoverPath(id: String, path: String?) async throws {}
  public func trash(id: String) async throws {}
  public func restore(id: String) async throws {}
  public func permanentlyDelete(id: String) async throws {}
  public func listTrashed() async throws -> [TrashedBook] { [] }
}

public struct FakeUnitRepository: UnitRepository {
  public init() {}

  public func list(bookId: String) async throws -> [StudyUnit] { PreviewData.units }
  public func get(id: String) async throws -> StudyUnit? {
    PreviewData.units.first { $0.id == id }
  }
  public func create(_ input: NewUnit) async throws -> String { "new-unit" }
  public func update(id: String, _ input: NewUnit) async throws {}
  public func updatePages(id: String, from: Int?, to: Int?, startNote: String?) async throws {}
  public func updateStatus(id: String, status: UnitStatus) async throws {}
  public func trash(id: String) async throws {}
  public func restore(id: String) async throws {}
  public func permanentlyDelete(id: String) async throws {}
  public func listMyTrashed() async throws -> [TrashedUnit] { [] }
}

public struct FakeLogRepository: LogRepository {
  public init() {}

  public func list(unitId: String) async throws -> [LogEntry] { PreviewData.logs }
  public func get(id: String) async throws -> LogEntry? {
    PreviewData.logs.first { $0.id == id }
  }
  public func create(_ input: NewLog) async throws -> String { "new-log" }
  public func update(id: String, _ input: NewLog) async throws {}
  public func updatePages(id: String, start: Int?, end: Int?) async throws {}
  public func setResolved(id: String, resolved: Bool) async throws {}
  public func delete(id: String) async throws {}
  public func countInBook(bookId: String) async throws -> Int { PreviewData.logs.count }
  public func countUnresolvedQuestions(bookId: String) async throws -> Int {
    PreviewData.logs.filter(\.isUnresolvedQuestion).count
  }
}

public struct FakeMemberRepository: MemberRepository {
  public init() {}
  public func list(bookId: String) async throws -> [BookMember] { PreviewData.members }
}

public struct FakeActivityRepository: ActivityRepository {
  public init() {}
  public func countNewLogs() async throws -> [String: Int] { PreviewData.newCounts }
  public func countNewLogsByUnit(bookId: String) async throws -> [String: Int] { [:] }
  public func markSeen(bookId: String) async throws {}
  public func listUpcoming() async throws -> [UpcomingUnit] {
    Upcoming.sort(PreviewData.upcoming)
  }
}
