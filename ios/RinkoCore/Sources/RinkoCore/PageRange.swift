import Foundation

/// ページ範囲の扱い。`src/lib/pageRange.ts` から移した。
public enum PageRange {

  /// 空欄なら nil、数字なら数値にする。数字でなければ nil 扱い。
  ///
  /// TypeScript版は `Number()` を使っているため `"1.5"` も `"-1"` も
  /// 一度は数になるが、そのあと整数かつ0以上かを見て弾いている。
  /// Swiftでは `Int()` が小数を弾くので、負数の判定だけ残せばよい。
  public static func toPageNumber(_ value: String) -> Int? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return nil }
    guard let parsed = Int(trimmed), parsed >= 0 else { return nil }
    return parsed
  }

  /// 開始・終了の組み合わせが正しいか確かめる。
  ///
  /// 片方だけ、両方とも空はどちらも許す。開始が終了より大きいときだけ拒む。
  /// 返すのは利用者に出す文言。問題が無ければ nil。
  public static func validate(start: Int?, end: Int?) -> String? {
    if let start, let end, start > end {
      return "開始ページは終了ページ以下にしてください。"
    }
    return nil
  }

  /// 記録が指すページ範囲を表示用にする。
  ///
  /// 「この発言はp.47-60について」という**閉じた**範囲。
  public static func formatLog(start: Int?, end: Int?) -> String? {
    if start == nil && end == nil { return nil }
    if let start, let end {
      return start == end ? "p.\(start)" : "p.\(start)-\(end)"
    }
    return "p.\(start ?? end!)"
  }

  /// 回が進んだページ範囲を表示用にする。
  ///
  /// 記録の範囲とは意味が違うので分けてある。こちらは「次回はp.71から」の
  /// ように、始まる前から片方だけ埋まる**開いた**範囲。だから開始だけの
  /// ときは「〜」を付けて続きがあることを示す。
  public static func formatUnit(start: Int?, end: Int?) -> String? {
    if start == nil && end == nil { return nil }
    if let start, let end {
      return start == end ? "p.\(start)" : "p.\(start)〜p.\(end)"
    }
    if let start { return "p.\(start)〜" }
    return "〜p.\(end!)"
  }
}
