import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface OrderRow {
  client: string
  orderNo: string
  clientManager: string
  productItem: string
  quantity: string
  orderAmount: string
  dueDate: string
  status: string
  manager: string
  note: string
}

const dummyOrders: OrderRow[] = [
  { client: '(주)거래처A', orderNo: 'ORD-2026001', clientManager: '김영업', productItem: '헴프 오일 500ml', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026002', clientManager: '김영업', productItem: '헴프 분말 1kg', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026003', clientManager: '김영업', productItem: '프리미엄 단백질 바', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026004', clientManager: '김영업', productItem: '유기농 헴프 음료', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026005', clientManager: '김영업', productItem: '씨드 그래놀라 300g', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
  { client: '(주)거래처A', orderNo: 'ORD-2026006', clientManager: '김영업', productItem: '고농축 헴프 캡슐', quantity: '1000', orderAmount: '5000000', dueDate: '2026-07-30', status: '진행중', manager: '이수주', note: '-' },
]

const PAGE_SIZE = 10

export function OrderManagePage() {
  const [filteredOrders, setFilteredOrders] = useState<OrderRow[]>(dummyOrders)
  const [modalOrder, setModalOrder] = useState<OrderRow | null>(null)
  const [page, setPage] = useState(0)

  const clientRef = useRef<HTMLInputElement>(null)
  const orderNoRef = useRef<HTMLInputElement>(null)
  const clientManagerRef = useRef<HTMLInputElement>(null)
  const productItemRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)
  const orderAmountRef = useRef<HTMLInputElement>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)
  const noteRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '거래처', ref: clientRef },
    { type: 'input', label: '수주번호', ref: orderNoRef },
    { type: 'input', label: '거래처담당자', ref: clientManagerRef },
    { type: 'input', label: '생산품목', ref: productItemRef },
    { type: 'input', label: '생산량', ref: quantityRef },
    { type: 'input', label: '수주금액', ref: orderAmountRef },
    { type: 'input', label: '납기일', ref: dueDateRef },
    { type: 'input', label: '상태', ref: statusRef },
    { type: 'input', label: '담당자', ref: managerRef },
    { type: 'input', label: '비고', ref: noteRef },
  ]

  const handleSearch = () => {
    const client = clientRef.current?.value.trim() ?? ''
    const orderNo = orderNoRef.current?.value.trim() ?? ''
    const clientManager = clientManagerRef.current?.value.trim() ?? ''
    const productItem = productItemRef.current?.value.trim() ?? ''
    const quantity = quantityRef.current?.value.trim() ?? ''
    const orderAmount = orderAmountRef.current?.value.trim() ?? ''
    const dueDate = dueDateRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''
    const note = noteRef.current?.value.trim() ?? ''

    // 현재는 더미수주에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredOrders(
      dummyOrders.filter(
        (order) =>
          (!client || order.client.includes(client)) &&
          (!orderNo || order.orderNo.includes(orderNo)) &&
          (!clientManager || order.clientManager.includes(clientManager)) &&
          (!productItem || order.productItem.includes(productItem)) &&
          (!quantity || order.quantity.includes(quantity)) &&
          (!orderAmount || order.orderAmount.includes(orderAmount)) &&
          (!dueDate || order.dueDate.includes(dueDate)) &&
          (!status || order.status.includes(status)) &&
          (!manager || order.manager.includes(manager)) &&
          (!note || order.note.includes(note)),
      ),
    )
  }

  const handleReset = () => {
    ;[clientRef, orderNoRef, clientManagerRef, productItemRef, quantityRef, orderAmountRef, dueDateRef, statusRef, managerRef, noteRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredOrders(dummyOrders)
  }

  const handleDelete = (order: OrderRow) => {
    if (window.confirm(`${order.orderNo} 수주를 삭제할까요?`)) {
      setFilteredOrders((prev) => prev.filter((o) => o !== order))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredOrders((prev) => prev.map((o) => (o === modalOrder ? ({ ...o, ...updated } as OrderRow) : o)))
    setModalOrder(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredOrders])

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const pagedOrders = filteredOrders.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<OrderRow>[] = useMemo(
    () => [
      { accessorKey: 'client', header: '거래처' },
      { accessorKey: 'orderNo', header: '수주번호' },
      { accessorKey: 'clientManager', header: '거래처담당자' },
      { accessorKey: 'productItem', header: '생산품목' },
      { accessorKey: 'quantity', header: '생산량' },
      { accessorKey: 'orderAmount', header: '수주금액' },
      { accessorKey: 'dueDate', header: '납기일' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => <Badge tone={getValue() === '진행중' ? 'warn' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'manager', header: '담당자' },
      { accessorKey: 'note', header: '비고' },
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
                setModalOrder(row.original)
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
    { label: '거래처', key: 'client' },
    { label: '수주번호', key: 'orderNo' },
    { label: '거래처담당자', key: 'clientManager' },
    { label: '생산품목', key: 'productItem' },
    { label: '생산량', key: 'quantity' },
    { label: '수주금액', key: 'orderAmount' },
    { label: '납기일', key: 'dueDate' },
    { label: '상태', key: 'status' },
    { label: '담당자', key: 'manager' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="수주관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        <CusTable data={pagedOrders} columns={columns} onRowClick={setModalOrder} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredOrders.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalOrder !== null}
        onClose={() => setModalOrder(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalOrder ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
