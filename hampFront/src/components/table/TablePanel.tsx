import type { ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { DataTable } from '../DataTable'
import { Panel } from '../Panel'

type Props = {
  title: string
  headers: string[]
  rows: Array<Array<ReactNode>>
  totalCount: number
  action?: string
  onAction?: () => void
  onRowClick?: (index: number) => void
}

export function TablePanel({
  title,
  headers,
  rows,
  totalCount,
  action,
  onAction,
  onRowClick,
}: Props) {
  return (
    <Panel title={title} action={action} onAction={onAction}>
      <DataTable headers={headers.filter((h, i, arr) => !(h === '관리' && arr.lastIndexOf('관리') !== i))} rows={rows} onRowClick={onRowClick} />
      <div className="paginationBar">
        <span className="paginationInfo">{totalCount}건</span>
        <div className="paginationBtns">
          <button type="button" className="pageBtn" aria-label="이전 페이지">
            <ChevronLeftIcon className="w-4 h-4" />
          </button>
          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              type="button"
              className={`pageBtn ${page === 1 ? 'active' : ''}`}
            >
              {page}
            </button>
          ))}
          <button type="button" className="pageBtn" aria-label="다음 페이지">
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Panel>
  )
}
