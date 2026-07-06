import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'

export interface CusColumnMeta {
  /** 고정 너비 (예: '150px'). 미지정 시 마지막 컬럼만 150px, 나머지는 auto */
  width?: string
}

type CusTableProps<T> = {
  data: T[]
  columns: ColumnDef<T>[]
  onRowClick?: (row: T) => void
  noDataMessage?: string
}

/** xaas 스타일 컬럼 정의(ColumnDef) 기반 테이블. accessorKey로 실제 데이터 필드명을 그대로 사용한다 */
export function CusTable<T>({ data, columns, onRowClick, noDataMessage }: CusTableProps<T>) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
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
              {headerGroup.headers.map((header) => (
                <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>
              ))}
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
                style={{ cursor: onRowClick ? 'pointer' : 'default' }}
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
