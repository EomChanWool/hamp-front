import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'

export interface CusColumnMeta {
  /** 고정 너비 (예: '150px'). 미지정 시 마지막 컬럼만 150px, 나머지는 auto */
  width?: string
}

type CusTableProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
  noDataMessage?: string
  sorting?: SortingState // 정렬 상태 (예: [{ id: 'defCode', desc: false }])
  onSortingChange?: (sorting: SortingState) => void // 정렬 변경 핸들러
}

/** xaas 스타일 컬럼 정의(ColumnDef) 기반 테이블. accessorKey로 실제 데이터 필드명을 그대로 사용한다 */
export function CusTable<T>({ 
  data, 
  columns, 
  onRowClick, 
  noDataMessage,
  sorting = [],
  onSortingChange
}: CusTableProps<T>) {
  const table = useReactTable({ 
    data, 
    columns, 
    state: { sorting },
    onSortingChange: (updater) => {
      if (typeof updater === 'function') {
        onSortingChange?.(updater(sorting))
      } else {
        onSortingChange?.(updater)
      }
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // 서버사이드 정렬을 사용할 경우 수동 정렬 활성화
  })

  const headerGroups = table.getHeaderGroups()
  const colCount = headerGroups[0]?.headers.length ?? columns.length

  return (
    <div className="tableWrap">
      <table>
        <colgroup>
          {headerGroups[0]?.headers.map((header, i) => {
            const width = (header.column.columnDef.meta as CusColumnMeta | undefined)?.width
            const isLast = i === headerGroups[0].headers.length - 1
            return <col key={header.id} style={{ width: width ?? (isLast ? '150px' : 'auto') }} />
          })}
        </colgroup>
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sortDir = header.column.getIsSorted() // false | 'asc' | 'desc'

                return (
                  <th 
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="th-content">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className={`sort-icon ${sortDir ? 'active' : ''}`}>
                          {sortDir === 'asc' ? ' ▲' : sortDir === 'desc' ? ' ▼' : ' ↕'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {data.length === 0 && noDataMessage ? (
            <tr>
              <td colSpan={colCount}>{noDataMessage}</td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}