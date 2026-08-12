import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface WorkOrderRow {
  workOrderNo: string
  itemName: string
  orderedQty: string
  unit: string
  workDate: string
  process: string
  status: '대기' | '진행중' | '완료' | '보류'
}

const dummyWorkOrders: WorkOrderRow[] = [
  { workOrderNo: 'WO-F-2400', itemName: '헴프 오일', orderedQty: '900', unit: 'kg', workDate: '2026-06-22', process: '원료투입', status: '대기' },
  { workOrderNo: 'WO-F-2401', itemName: '헴프 분말', orderedQty: '1020', unit: 'kg', workDate: '2026-06-21', process: '세척', status: '진행중' },
  { workOrderNo: 'WO-F-2402', itemName: '단백질 바', orderedQty: '1140', unit: 'kg', workDate: '2026-06-20', process: '건조', status: '완료' },
  { workOrderNo: 'WO-F-2403', itemName: '헴프 음료', orderedQty: '1260', unit: 'kg', workDate: '2026-06-19', process: '분쇄', status: '보류' },
  { workOrderNo: 'WO-F-2404', itemName: '씨드 그래놀라', orderedQty: '1380', unit: 'kg', workDate: '2026-06-18', process: '선별', status: '대기' },
  { workOrderNo: 'WO-F-2405', itemName: '헴프 캡슐', orderedQty: '1500', unit: 'kg', workDate: '2026-06-17', process: '포장', status: '진행중' },
]

const PAGE_SIZE = 10

export function FoodWorkOrdersPage() {
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<WorkOrderRow[]>(dummyWorkOrders)
  const [modalWorkOrder, setModalWorkOrder] = useState<WorkOrderRow | null>(null)
  const [page, setPage] = useState(0)

  const workDateStartRef = useRef<HTMLInputElement>(null)
  const workDateEndRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '작업일자', startRef: workDateStartRef, endRef: workDateEndRef },
    { type: 'input', label: '품목명', ref: itemNameRef, name: "equipmentName" },
    { type: 'input', label: '상태', ref: statusRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const workDateStart = workDateStartRef.current?.value ?? ''
    const workDateEnd = workDateEndRef.current?.value ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미작업지시에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredWorkOrders(
      dummyWorkOrders.filter(
        (order) =>
          (!workDateStart || order.workDate >= workDateStart) &&
          (!workDateEnd || order.workDate <= workDateEnd) &&
          (!itemName || order.itemName.includes(itemName)) &&
          (!status || order.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[workDateStartRef, workDateEndRef, itemNameRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredWorkOrders(dummyWorkOrders)
  }

  const handleDelete = (order: WorkOrderRow) => {
    if (window.confirm(`${order.workOrderNo} 작업지시를 삭제할까요?`)) {
      setFilteredWorkOrders((prev) => prev.filter((o) => o !== order))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredWorkOrders((prev) => prev.map((o) => (o === modalWorkOrder ? ({ ...o, ...updated } as WorkOrderRow) : o)))
    setModalWorkOrder(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredWorkOrders])

  const totalPages = Math.max(1, Math.ceil(filteredWorkOrders.length / PAGE_SIZE))
  const pagedWorkOrders = filteredWorkOrders.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<WorkOrderRow>[] = useMemo(
    () => [
      { accessorKey: 'workOrderNo', header: '작업지시번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'orderedQty', header: '지시수량' },
      { accessorKey: 'unit', header: '단위' },
      { accessorKey: 'workDate', header: '작업일자' },
      { accessorKey: 'process', header: '공정' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const tone = value === '완료' ? 'good' : 'warn'
          return <Badge tone={tone}>{value}</Badge>
        },
      },
      {
        id: 'actions',
        header: '관리',
        meta: { width: '150px' },
        cell: ({ row }) => (
          <div className="rowActions">
            <button
              type="button"
              className="miniButton"
              onClick={(e) => {
                e.stopPropagation()
                setModalWorkOrder(row.original)
              }}
            >
              상세
            </button>
            <button
              type="button"
              className="miniButton danger"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(row.original)
              }}
            >
              삭제
            </button>
          </div>
        ),
      },
    ],
    [],
  )

  const detailFields = [
    { label: '작업지시번호', key: 'workOrderNo' },
    { label: '품목명', key: 'itemName' },
    { label: '지시수량', key: 'orderedQty' },
    { label: '단위', key: 'unit' },
    { label: '작업일자', key: 'workDate' },
    { label: '공정', key: 'process' },
    { label: '상태', key: 'status' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="식품 작업지시관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedWorkOrders} columns={columns} onRowClick={setModalWorkOrder} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredWorkOrders.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalWorkOrder !== null}
        onClose={() => setModalWorkOrder(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalWorkOrder ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
