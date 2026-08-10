export interface PaginationResult<T> {
  items: T[]
  currentPage: number
  totalPages: number
  totalItems: number
}

export function paginate<T>(items: T[], requestedPage: number, pageSize: number): PaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize))
  const currentPage = Math.min(Math.max(1, Math.floor(requestedPage)), totalPages)
  const pageStart = (currentPage - 1) * safePageSize

  return {
    items: items.slice(pageStart, pageStart + safePageSize),
    currentPage,
    totalPages,
    totalItems: items.length,
  }
}

export function paginationItems(
  currentPage: number,
  totalPages: number,
): Array<number | 'ellipsis'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const visiblePages = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b)
  const items: Array<number | 'ellipsis'> = []

  visiblePages.forEach((page, index) => {
    const previous = visiblePages[index - 1]
    if (previous && page - previous > 1) items.push('ellipsis')
    items.push(page)
  })

  return items
}
