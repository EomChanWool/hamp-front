import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/react/16/solid'

type Props = {
  /** 0-based 현재 페이지 */
  page: number
  totalPages: number
  totalCount: number
  onPageChange: (page: number) => void
  /** 한 번에 보여줄 페이지 번호 버튼 개수 */
  groupSize?: number
}

/** 실제로 페이지를 넘기는 페이지네이션 바 (xaas CusPagination 로직 이식, 디자인은 기존 pageBtn 스타일 재사용) */
export function CusPagination({ page, totalPages, totalCount, onPageChange, groupSize = 5 }: Props) {
  const groupStart = Math.floor(page / groupSize) * groupSize
  const groupEnd = Math.min(groupStart + groupSize, totalPages)
  const pageNumbers = Array.from({ length: Math.max(0, groupEnd - groupStart) }, (_, i) => groupStart + i)

  return (
    <div className="paginationBar">
      <span className="paginationInfo">{totalCount}건</span>
      <div className="paginationBtns">
        <button
          type="button"
          className="pageBtn"
          aria-label="첫 페이지"
          disabled={page === 0}
          onClick={() => onPageChange(0)}
        >
          <ChevronDoubleLeftIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="pageBtn"
          aria-label="이전 페이지"
          disabled={page === 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        {pageNumbers.map((p) => (
          <button
            key={p}
            type="button"
            className={`pageBtn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
          >
            {p + 1}
          </button>
        ))}
        <button
          type="button"
          className="pageBtn"
          aria-label="다음 페이지"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="pageBtn"
          aria-label="마지막 페이지"
          disabled={page >= totalPages - 1}
          onClick={() => onPageChange(totalPages - 1)}
        >
          <ChevronDoubleRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
