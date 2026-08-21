import Foundation

/// 記録をスレッドの形に組み直す。`src/repository/logs.ts` から移した。
public enum Threads {

  /// 平らな配列をスレッドに組み直す。
  ///
  /// 並び順は親が新しい順（最新の話題が上）、返信はその中で古い順
  /// （会話の流れを追える）。
  ///
  /// **親が見当たらない返信は、親として扱う。** 削除は連鎖するので普通は
  /// 起きないが、消えて見えなくなるより場所がずれても出る方がましなため。
  ///
  /// 問い合わせを親と返信で分けず、1回で取ってからここで組み立てる方針も
  /// そのまま引き継いでいる。親ごとに取りに行くと件数分だけ通信が増える。
  public static func build(_ logs: [LogEntry]) -> [LogThread] {
    let ids = Set(logs.map(\.id))

    var repliesByParent: [String: [LogEntry]] = [:]
    var roots: [LogEntry] = []

    for log in logs {
      guard let parentId = log.parentLogId, ids.contains(parentId) else {
        roots.append(log)
        continue
      }
      repliesByParent[parentId, default: []].append(log)
    }

    roots.sort { $0.createdAt > $1.createdAt }

    return roots.map { root in
      LogThread(
        root: root,
        replies: (repliesByParent[root.id] ?? []).sorted {
          $0.createdAt < $1.createdAt
        }
      )
    }
  }

  /// スレッドをページ順に並べ替える。
  ///
  /// **束のまま動かす。** 返信は本文だけで投稿できるためページを持たない。
  /// 平らに並べ替えると親と返信が離れて会話が切れるので、順序は親の
  /// ページだけで決める。
  ///
  /// ページが未記入のスレッドは最後にまとめる。読み返しの手がかりに
  /// ならないものが先頭に来ないようにするため。
  ///
  /// 同じページの中は投稿の古い順。読み返すときは書かれた順に読みたい。
  public static func sortByPage(_ threads: [LogThread]) -> [LogThread] {
    var withPage: [LogThread] = []
    var withoutPage: [LogThread] = []

    for thread in threads {
      if thread.root.pageStart == nil && thread.root.pageEnd == nil {
        withoutPage.append(thread)
      } else {
        withPage.append(thread)
      }
    }

    // 片方しか入っていないこともあるので、始点が無ければ終点で見る
    func pageOf(_ thread: LogThread) -> Int {
      thread.root.pageStart ?? thread.root.pageEnd ?? 0
    }

    withPage.sort { a, b in
      let (pa, pb) = (pageOf(a), pageOf(b))
      if pa != pb { return pa < pb }
      return a.root.createdAt < b.root.createdAt
    }

    withoutPage.sort { $0.root.createdAt < $1.root.createdAt }

    return withPage + withoutPage
  }
}

/// 回の進み具合。`src/repository/units.ts` から移した。
public enum Progress {

  public static func count(_ units: [Unit]) -> UnitProgress {
    let total = units.count
    let done = units.filter { $0.status == .done }.count
    // TypeScript版の Math.round に合わせる。四捨五入
    let percent = total == 0 ? 0 : Int((Double(done) / Double(total) * 100).rounded())
    return UnitProgress(done: done, total: total, percent: percent)
  }

  /// 次にやる回。第N回の順で最初の「完了していない回」。
  ///
  /// 日付ではなく並び順で決めている。日付が入っていない回や、予定より
  /// 遅れている回でも同じように扱えるため。
  public static func findNext(_ units: [Unit]) -> Unit? {
    units.first { $0.status != .done }
  }
}
