import { describe, expect, it } from 'vitest'
import { toPlainText } from './plainText'

describe('toPlainText', () => {
  it('強調の記号を落とす', () => {
    expect(toPlainText('**正則化**は事前分布')).toBe('正則化は事前分布')
    expect(toPlainText('*斜体*と__太字__')).toBe('斜体と太字')
  })

  it('箇条書きと番号付きの記号を落とす', () => {
    expect(toPlainText('- 最小二乗\n- 最尤推定')).toBe('最小二乗 最尤推定')
    expect(toPlainText('1. 最小二乗\n2. MAP推定')).toBe('最小二乗 MAP推定')
  })

  it('見出しと引用の記号を落とす', () => {
    expect(toPlainText('## 今日の要点')).toBe('今日の要点')
    expect(toPlainText('> 引用された文')).toBe('引用された文')
  })

  it('リンクは文字だけ残す', () => {
    expect(toPlainText('[PRML](https://example.com)を読む')).toBe(
      'PRMLを読む',
    )
  })

  it('画像は代替文字だけ残す', () => {
    expect(toPlainText('![板書](https://example.com/a.png)')).toBe('板書')
  })

  it('コードは中身を残し、コードブロックは落とす', () => {
    expect(toPlainText('`npm test` を叩く')).toBe('npm test を叩く')
    expect(toPlainText('前\n```\nconst a = 1\n```\n後')).toBe('前 後')
  })

  it('改行をまとめて1行にする', () => {
    expect(toPlainText('前\n\n\n後')).toBe('前 後')
  })

  it('記号の無い文章はそのまま', () => {
    expect(toPlainText('ふつうの文章です')).toBe('ふつうの文章です')
  })

  it('空文字でも落ちない', () => {
    expect(toPlainText('')).toBe('')
  })

  /*
    記号の一部だけが残るのは許容している。完全な解釈はしない方針で、
    抜粋が読めれば足りるため。壊れないことだけ確かめておく。
  */
  it('閉じていない記号が来ても落ちない', () => {
    expect(() => toPlainText('**閉じていない')).not.toThrow()
  })
})
