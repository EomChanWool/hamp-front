import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { paginate } from '@/utils/common'

// 컴포넌트 내부에서 사용할 타입 직접 정의
export interface OrderManageRow {
  id: string
  client: string
  orderNo: string
  clientManager: string
  productItem: string
  quantity: string
  orderAmount: string
  dueDate: string
  status: string
  manager: string
  note?: string
}

export interface OrderManageSearchParams {
  client?: string
  orderNo?: string
  clientManager?: string
  productItem?: string
  quantity?: string
  orderAmount?: string
  dueDate?: string
  status?: string
  manager?: string
  note?: string
}

// 자체 내장 더미 데이터
const INITIAL_MOCK_ORDERS: OrderManageRow[] = [
  {
    id: '1',
    client: '그린팜 농협',
    orderNo: 'ORD-2026-0001',
    clientManager: '박과장',
    productItem: '방울토마토 씨드 A',
    quantity: '1,000',
    orderAmount: '5,000,000원',
    dueDate: '2026-06-30',
    status: '진행중',
    manager: '김철수',
    note: '우선 납품 요청',
  },
  {
    id: '2',
    client: '푸른들 영농조합',
    orderNo: 'ORD-2026-0002',
    clientManager: '최팀장',
    productItem: '청상추 씨드 B',
    quantity: '500',
    orderAmount: '2,500,000원',
    dueDate: '2026-07-05',
    status: '완료',
    manager: '이영희',
    note: '정상 납품 완료',
  },
  {
    id: '3',
    client: '한라 생태농원',
    orderNo: 'ORD-2026-0003',
    clientManager: '오대리',
    productItem: '파프리카 씨드 C',
    quantity: '800',
    orderAmount: '6,400,000원',
    dueDate: '2026-07-15',
    status: '진행중',
    manager: '관리자',
    note: '특수 포장 요구',
  },
]

export function OrderManagePage() {
  const [orders, setOrders] = useState<OrderManageRow[]>([])
  const [searchParams, setSearchParams] = useState<OrderManageSearchParams>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalOrder, setModalOrder] = useState<OrderManageRow | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

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
    { type: 'input', label: '거래처', ref: clientRef, name: "client" },
    { type: 'input', label: '수주번호', ref: orderNoRef, name: "orderNo" },
    { type: 'input', label: '거래처담당자', ref: clientManagerRef, name: "clientManager" },
    { type: 'input', label: '생산품목', ref: productItemRef, name: "productItem" },
    { type: 'input', label: '생산량', ref: quantityRef, name: "quantity" },
    { type: 'input', label: '수주금액', ref: orderAmountRef, name: "orderAmount" },
    { type: 'input', label: '납기일', ref: dueDateRef, name: "dueDate" },
    { type: 'input', label: '상태', ref: statusRef, name: "status" },
    { type: 'input', label: '담당자', ref: managerRef, name: "manager" },
    { type: 'input', label: '비고', ref: noteRef, name: "note" },
  ]

  const loadOrder = async (params: OrderManageSearchParams) => {
    setIsLoading(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      let filtered = [...INITIAL_MOCK_ORDERS]
      
      if (params) {
        filtered = filtered.filter(
          (item) =>
            (!params.client || item.client.includes(params.client)) &&
            (!params.orderNo || item.orderNo.includes(params.orderNo)) &&
            (!params.clientManager || item.clientManager.includes(params.clientManager)) &&
            (!params.productItem || item.productItem.includes(params.productItem)) &&
            (!params.quantity || item.quantity.includes(params.quantity)) &&
            (!params.orderAmount || item.orderAmount.includes(params.orderAmount)) &&
            (!params.dueDate || item.dueDate.includes(params.dueDate)) &&
            (!params.status || item.status.includes(params.status)) &&
            (!params.manager || item.manager.includes(params.manager)) &&
            (!params.note || (item.note ?? '').includes(params.note)),
        )
      }
      setOrders(filtered)
      setCurrentPage(0)
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadOrder(searchParams)
  }, [searchParams])

  const handleSearch = () => {
    const params: OrderManageSearchParams = {
      client: clientRef.current?.value.trim() || undefined,
      orderNo: orderNoRef.current?.value.trim() || undefined,
      clientManager: clientManagerRef.current?.value.trim() || undefined,
      productItem: productItemRef.current?.value.trim() || undefined,
      quantity: quantityRef.current?.value.trim() || undefined,
      orderAmount: orderAmountRef.current?.value.trim() || undefined,
      dueDate: dueDateRef.current?.value.trim() || undefined,
      status: statusRef.current?.value.trim() || undefined,
      manager: managerRef.current?.value.trim() || undefined,
      note: noteRef.current?.value.trim() || undefined,
    }
    setSearchParams(params)
  }

  const handleReset = () => {
    ;[
      clientRef,
      orderNoRef,
      clientManagerRef,
      productItemRef,
      quantityRef,
      orderAmountRef,
      dueDateRef,
      statusRef,
      managerRef,
      noteRef,
    ].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setSearchParams({})
  }

  const handleDelete = async (item: OrderManageRow) => {
    if (window.confirm(`${item.orderNo} 수주를 삭제할까요?`)) {
      try {
        setOrders((prev) => prev.filter((i) => i.id !== item.id))
        window.alert('삭제되었습니다.')
      } catch (err) {
        console.error(err)
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalOrder) return
    try {
      setOrders((prev) =>
        prev.map((i) => (i.id === modalOrder.id ? { ...i, ...updated } : i)),
      )
      window.alert('저장되었습니다.')
      setModalOrder(null)
    } catch (err) {
      console.error(err)
      window.alert('저장에 실패했습니다.')
    }
  }

  const { totalPages, pagedData } = paginate(orders, currentPage)

  const columns: ColumnDef<OrderManageRow>[] = useMemo(
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
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <Badge tone={value === '진행중' ? 'warn' : 'muted'}>{value}</Badge>
        },
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
    [orders, searchParams],
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

      <Panel title="수주관리 목록" action="등록" onAction={() => window.alert('등록 기능은 준비 중입니다.')}>
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedData} columns={columns} onRowClick={setModalOrder} />
            <CusPagination page={currentPage} totalPages={totalPages} totalCount={orders.length} onPageChange={setCurrentPage} />
          </>
        )}
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