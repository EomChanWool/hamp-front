import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { paginate } from '@/utils/common'
import { type OrderManageRow, type OrderManageSearchParams, mockOrderManage } from '@/types/sales/Sales'

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

  const loadOrder = async (params: OrderManageSearchParams) => {
    setIsLoading(true)
    try {
      // -------------------------------------------------------------
      // [개발용 Mock Mode] 백엔드 연결 후 아래 블록은 삭제/주석 처리하세요.
      await new Promise((resolve) => setTimeout(resolve, 300))
      let filtered = [...mockOrderManage]
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
            (!params.note || item.note.includes(params.note)),
        )
      }
      setOrders(filtered)
      // -------------------------------------------------------------

      /*
      // [실제 API 호출 Mode] 백엔드 완공 시 주석 해제하여 사용
      const response = await apiClient.get<OrderManageRow[]>('/sales/order-manage', { params })
      setOrders(response.data)
      */

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
        // [개발용 Mock Mode]
        setOrders((prev) => prev.filter((i) => i.id !== item.id))

        /*
        // [실제 API 호출 Mode]
        await apiClient.delete(`/sales/order-manage/${item.id}`)
        loadOrder(searchParams) // 삭제 후 re-fetch
        */

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
      // [개발용 Mock Mode]
      setOrders((prev) =>
        prev.map((i) => (i.id === modalOrder.id ? { ...i, ...updated } : i)),
      )

      /*
      // [실제 API 호출 Mode]
      await apiClient.put(`/sales/order-manage/${modalOrder.id}`, updated)
      loadOrder(searchParams) // 수정 후 re-fetch
      */

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

      <Panel title="수주관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
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