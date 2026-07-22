import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

import { fetchOrders, deleteOrders, updateOrders, type OrderManage, type OrderSearchParams } from '@/services/sales/OrderManagePage'


const PAGE_SIZE = 10

export function OrderManagePage() {
  const [orders, setOrders] = useState<OrderManage[]>([]) // 서버(더미)에서 받은 원본 데이터
  const [searchParams, setSearchParams] = useState<OrderSearchParams>({}) // 현재 검색 조건 상태
  const [isLoading, setIsLoading] = useState(false) // 로딩 상태 추가
  const [modalOrder, setModalOrder] = useState<OrderManage | null>(null)
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

  const loadOrder = async (params: OrderSearchParams) => {
    setIsLoading(true)
    try {
      const data = await fetchOrders(params)
      setOrders(data)
      setPage(0) // 검색 조건이 바뀌면 페이지를 첫 페이지로 초기화
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
    const params: OrderSearchParams = {
      client: clientRef.current?.value.trim(),
      orderNo: orderNoRef.current?.value.trim(),
      clientManager: clientManagerRef.current?.value.trim(),
      productItem: productItemRef.current?.value.trim(),
      quantity: quantityRef.current?.value.trim(),
      orderAmount: orderAmountRef.current?.value.trim(),
      dueDate: dueDateRef.current?.value.trim(),
      status: statusRef.current?.value.trim(),
      manager: managerRef.current?.value.trim(),
      note: noteRef.current?.value.trim(),
    }
    setSearchParams(params) // 상태를 바꾸면 useEffect가 감지하여 로드합니다.
  }

  const handleReset = () => {
    ;[clientRef, orderNoRef, clientManagerRef, productItemRef, quantityRef, orderAmountRef, dueDateRef, statusRef, managerRef, noteRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setSearchParams({})
  }

  const handleDelete = async (order: OrderManage) => {
    if (window.confirm(`${order.orderNo} 수주를 삭제할까요?`)) {
      try {
        await deleteOrders(order.orderNo)
        window.alert('삭제되었습니다.')
        loadOrder(searchParams) // 삭제 후 목록 리로드
      } catch (err) {
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalOrder) return
    try {
      await updateOrders(modalOrder.client, updated)
      window.alert('저장되었습니다.')
      setModalOrder(null)
      loadOrder(searchParams) // 수정 후 목록 리로드
    } catch (err) {
      window.alert('저장에 실패했습니다.')
    }
  }


  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE))
  const pagedOrders = orders.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<OrderManage>[] = useMemo(
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

      <Panel title="수주관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>

            <CusTable data={pagedOrders} columns={columns} onRowClick={setModalOrder} />
            <CusPagination page={page} totalPages={totalPages} totalCount={orders.length} onPageChange={setPage} />
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
