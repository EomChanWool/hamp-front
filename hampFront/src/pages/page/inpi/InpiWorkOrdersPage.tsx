import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface InpiWorkOrder {
  workOrderNo: string
  itemName: string
  orderedQty: string
  unit: string
  workDate: string
  process: string
  status: '대기' | '진행중' | '완료' | '보류'
}

const dummyWorkOrders: InpiWorkOrder[] = [
  { workOrderNo: 'WO-I-2400', itemName: '인피 원면', orderedQty: '900', unit: 'kg', workDate: '2026-06-22', process: '투입', status: '대기' },
  { workOrderNo: 'WO-I-2401', itemName: '인피 섬유', orderedQty: '1020', unit: 'kg', workDate: '2026-06-21', process: '개섬', status: '진행중' },
  { workOrderNo: 'WO-I-2402', itemName: '인피 매트', orderedQty: '1140', unit: 'kg', workDate: '2026-06-20', process: '정렬', status: '완료' },
  { workOrderNo: 'WO-I-2403', itemName: '인피 패드', orderedQty: '1260', unit: 'kg', workDate: '2026-06-19', process: '압축', status: '보류' },
  { workOrderNo: 'WO-I-2404', itemName: '인피 롤', orderedQty: '1380', unit: 'kg', workDate: '2026-06-18', process: '포장', status: '대기' },
  { workOrderNo: 'WO-I-2405', itemName: '인피 보드', orderedQty: '1500', unit: 'kg', workDate: '2026-06-17', process: '투입', status: '진행중' },
]

const PAGE_SIZE = 10

export function InpiWorkOrdersPage() {
  const [filteredWorkOrders, setFilteredWorkOrders] = useState<InpiWorkOrder[]>(dummyWorkOrders)
  const [modalWorkOrder, setModalWorkOrder] = useState<InpiWorkOrder | null>(null)
  const [page, setPage] = useState(0)

  const workDateStartRef = useRef<HTMLInputElement>(null)
  const workDateEndRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '작업일자', startRef: workDateStartRef, endRef: workDateEndRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
    { type: 'input', label: '상태', ref: statusRef },
  ]

  const handleSearch = () => {
    const start = workDateStartRef.current?.value ?? ''
    const end = workDateEndRef.current?.value ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미작업지시에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredWorkOrders(
      dummyWorkOrders.filter(
        (order) =>
          (!start || order.workDate >= start) &&
          (!end || order.workDate <= end) &&
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

  const handleDelete = (order: InpiWorkOrder) => {
    if (window.confirm(`${order.workOrderNo} 작업지시를 삭제할까요?`)) {
      setFilteredWorkOrders((prev) => prev.filter((o) => o !== order))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredWorkOrders((prev) => prev.map((o) => (o === modalWorkOrder ? ({ ...o, ...updated } as InpiWorkOrder) : o)))
    setModalWorkOrder(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredWorkOrders])

  const totalPages = Math.max(1, Math.ceil(filteredWorkOrders.length / PAGE_SIZE))
  const pagedWorkOrders = filteredWorkOrders.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiWorkOrder>[] = useMemo(
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
          return (
            <Badge tone={value === '완료' ? 'good' : value === '진행중' ? 'info' : value === '보류' ? 'danger' : 'warn'}>
              {value}
            </Badge>
          )
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

      <Panel title="인피 작업지시관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
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
