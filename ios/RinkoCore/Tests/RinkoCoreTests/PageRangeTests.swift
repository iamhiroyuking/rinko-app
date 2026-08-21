import Testing

@testable import RinkoCore

/*
 `src/lib/pageRange.test.ts` から移した。

 **文言まで含めて同じ結果になることを確かめる。** 移植でいちばん怖いのは
 「だいたい動くが細部が違う」なので、元のテストを一つずつ持ってくる。
 */

@Suite
struct PageRangeTests {

  @Test
  func emptyIsNil() {
    #expect(PageRange.toPageNumber("") == nil)
    #expect(PageRange.toPageNumber("   ") == nil)
  }

  @Test
  func digitsBecomeNumbers() {
    #expect(PageRange.toPageNumber("42") == 42)
    #expect(PageRange.toPageNumber(" 7 ") == 7)
    #expect(PageRange.toPageNumber("0") == 0)
  }

  @Test
  func nonDigitsAreNil() {
    #expect(PageRange.toPageNumber("abc") == nil)
    #expect(PageRange.toPageNumber("1.5") == nil)
    #expect(PageRange.toPageNumber("-3") == nil)
  }

  @Test
  func rejectsOnlyReversedRange() {
    #expect(PageRange.validate(start: 10, end: 3) != nil)
    #expect(PageRange.validate(start: 3, end: 10) == nil)
    #expect(PageRange.validate(start: 5, end: 5) == nil)
  }

  @Test
  func allowsOpenRanges() {
    #expect(PageRange.validate(start: 10, end: nil) == nil)
    #expect(PageRange.validate(start: nil, end: 10) == nil)
    #expect(PageRange.validate(start: nil, end: nil) == nil)
  }

  @Test
  func formatsLogRange() {
    #expect(PageRange.formatLog(start: 47, end: 60) == "p.47-60")
    #expect(PageRange.formatLog(start: 47, end: 47) == "p.47")
    #expect(PageRange.formatLog(start: 47, end: nil) == "p.47")
    #expect(PageRange.formatLog(start: nil, end: 60) == "p.60")
    #expect(PageRange.formatLog(start: nil, end: nil) == nil)
  }

  @Test
  func formatsUnitRange() {
    #expect(PageRange.formatUnit(start: 71, end: 90) == "p.71〜p.90")
    #expect(PageRange.formatUnit(start: 71, end: 71) == "p.71")
    #expect(PageRange.formatUnit(start: 71, end: nil) == "p.71〜")
    #expect(PageRange.formatUnit(start: nil, end: 90) == "〜p.90")
    #expect(PageRange.formatUnit(start: nil, end: nil) == nil)
  }
}
