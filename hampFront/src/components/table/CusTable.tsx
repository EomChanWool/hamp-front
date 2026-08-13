import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from '@tanstack/react-table'
import { ChevronUpIcon, ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import './Custable.css'

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
      const nextSorting = typeof updater === 'function' 
        ? updater(table.getState().sorting) 
        : updater;
      
      onSortingChange?.(nextSorting);
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true, // 서버사이드 정렬을 사용할 경우 수동 정렬 활성화
    enableMultiSort: true, // 다중 정렬 활성화
  })

  // Shift 없이 일반 클릭 시 다중 정렬 누적 및 사이클 처리를 위한 커스텀 핸들러
  const handleSort = (columnId: string) => {
    const currentSorting = table.getState().sorting;
    const existingSort = currentSorting.find((s) => s.id === columnId);
    
    let nextSorting: SortingState = [];

    if (!existingSort) {
      // 1. 새로운 컬럼 클릭 시: 기존 정렬에 누적 (오름차순부터 시작)
      nextSorting = [...currentSorting, { id: columnId, desc: false }];
    } else if (!existingSort.desc) {
      // 2. 이미 오름차순(asc)인 경우: 내림차순(desc)으로 변경
      nextSorting = currentSorting.map((s) => 
        s.id === columnId ? { ...s, desc: true } : s
      );
    } else {
      // 3. 이미 내림차순(desc)인 경우: 해당 컬럼 정렬 제거
      nextSorting = currentSorting.filter((s) => s.id !== columnId);
    }

    onSortingChange?.(nextSorting);
  };

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
                const sortDir = header.column.getIsSorted() 

                return (
                  <th 
                    key={header.id}
                    onClick={canSort ? () => handleSort(header.column.id) : undefined}
                    style={{ cursor: canSort ? 'pointer' : 'default' }}
                  >
                    <div className="th-content">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className={`sort-icon ${sortDir ? 'active' : ''}`}>
                          {sortDir === 'asc' ? (
                            <ChevronUpIcon className="w-4 h-4" aria-hidden="true" />
                          ) : sortDir === 'desc' ? (
                            <ChevronDownIcon className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ChevronUpDownIcon className="w-4 h-4" aria-hidden="true" />
                          )}
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
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                className={onRowClick ? "hover:bg-gray-50 transition-colors" : ""}
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