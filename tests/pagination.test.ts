import { describe, expect, it } from 'bun:test'
import { paginate, paginationItems } from '../src/pagination'

describe('paginate', () => {
  const stories = Array.from({ length: 100 }, (_, index) => index + 1)

  it('shows twelve stories on a full page', () => {
    const page = paginate(stories, 1, 12)

    expect(page.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(page.totalPages).toBe(9)
    expect(page.totalItems).toBe(100)
  })

  it('shows the remaining stories on the final page', () => {
    const page = paginate(stories, 9, 12)

    expect(page.items).toEqual([97, 98, 99, 100])
    expect(page.currentPage).toBe(9)
  })

  it('clamps an invalid page to the available range', () => {
    expect(paginate(stories, 99, 12).currentPage).toBe(9)
    expect(paginate(stories, -3, 12).currentPage).toBe(1)
  })
})

describe('paginationItems', () => {
  it('keeps large page lists compact', () => {
    expect(paginationItems(5, 9)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 9])
  })
})
