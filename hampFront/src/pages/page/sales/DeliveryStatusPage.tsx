import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface DeliveryStatusRow {
  orderNo: string
  client: string
  clientManager: string
  deliveryItem: string
  quantity: string
  deliveryLocation: string
  manager: string
}

const dummyDeliveryStatus: DeliveryStatusRow[] = [
  { orderNo: 'ORD-2026001', client: '(주)거래처A', clientManager: '김영업', deliveryItem: '헴프 오일 출고분', quantity: '1000', deliveryLocation: '본사창고', manager: '박납품' },
  { orderNo: 'ORD-2026002', client: '(주)거래처A', clientManager: '김영업', deliveryItem: '헴프 분말 출고분', quantity: '1000', deliveryLocation: '본사창고', manager: '박납품' },
  { orderNo: 'ORD-2026003', client: '(주)거래처A', clientManager: '김영업', deliveryItem: '단백질 바 세트', quantity: '1000', deliveryLocation: '본사창고', manager: '박납품' },
  { orderNo: 'ORD-2026004', client: '(주)거래처A', clientManager: '김영업', deliveryItem: '헴프 음료 박스', quantity: '1000', deliveryLocation: '본사창고', manager: '박납품' },
  { orderNo: 'ORD-2026005', client: '(주)거래처A', clientManager: '김영업', deliveryItem: '씨드 그래놀라 벌크', quantity: '1000', deliveryLocation: '본사창고', manager: '박납품' },
  { orderNo: 'ORD-2026006', client: '(주)거래처A', clientManager: '김영업', deliveryItem: '헴프 캡슐 완제품', quantity: '1000', deliveryLocation: '본사창고', manager: '박납품' },
]

const PAGE_SIZE = 10

export function DeliveryStatusPage() {
  const [filteredDeliveryStatus, setFilteredDeliveryStatus] = useState<DeliveryStatusRow[]>(dummyDeliveryStatus)
  const [modalDelivery, setModalDelivery] = useState<DeliveryStatusRow | null>(null)
  const [page, setPage] = useState(0)

  const orderNoRef = useRef<HTMLInputElement>(null)
  const clientRef = useRef<HTMLInputElement>(null)
  const clientManagerRef = useRef<HTMLInputElement>(null)
  const deliveryItemRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)
  const deliveryLocationRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '수주번호', ref: orderNoRef, name: "equipmentName" },
    { type: 'input', label: '거래처', ref: clientRef, name: "equipmentName" },
    { type: 'input', label: '거래처담당자', ref: clientManagerRef, name: "equipmentName" },
    { type: 'input', label: '납품품목', ref: deliveryItemRef, name: "equipmentName" },
    { type: 'input', label: '납품량', ref: quantityRef, name: "equipmentName" },
    { type: 'input', label: '납품장소', ref: deliveryLocationRef, name: "equipmentName" },
    { type: 'input', label: '담당자', ref: managerRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const orderNo = orderNoRef.current?.value.trim() ?? ''
    const client = clientRef.current?.value.trim() ?? ''
    const clientManager = clientManagerRef.current?.value.trim() ?? ''
    const deliveryItem = deliveryItemRef.current?.value.trim() ?? ''
    const quantity = quantityRef.current?.value.trim() ?? ''
    const deliveryLocation = deliveryLocationRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''

    // 현재는 더미납품현황에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredDeliveryStatus(
      dummyDeliveryStatus.filter(
        (delivery) =>
          (!orderNo || delivery.orderNo.includes(orderNo)) &&
          (!client || delivery.client.includes(client)) &&
          (!clientManager || delivery.clientManager.includes(clientManager)) &&
          (!deliveryItem || delivery.deliveryItem.includes(deliveryItem)) &&
          (!quantity || delivery.quantity.includes(quantity)) &&
          (!deliveryLocation || delivery.deliveryLocation.includes(deliveryLocation)) &&
          (!manager || delivery.manager.includes(manager)),
      ),
    )
  }

  const handleReset = () => {
    ;[orderNoRef, clientRef, clientManagerRef, deliveryItemRef, quantityRef, deliveryLocationRef, managerRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredDeliveryStatus(dummyDeliveryStatus)
  }

  const handleDelete = (delivery: DeliveryStatusRow) => {
    if (window.confirm(`${delivery.orderNo} 납품을 삭제할까요?`)) {
      setFilteredDeliveryStatus((prev) => prev.filter((d) => d !== delivery))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredDeliveryStatus((prev) => prev.map((d) => (d === modalDelivery ? ({ ...d, ...updated } as DeliveryStatusRow) : d)))
    setModalDelivery(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredDeliveryStatus])

  const totalPages = Math.max(1, Math.ceil(filteredDeliveryStatus.length / PAGE_SIZE))
  const pagedDeliveryStatus = filteredDeliveryStatus.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<DeliveryStatusRow>[] = useMemo(
    () => [
      { accessorKey: 'orderNo', header: '수주번호' },
      { accessorKey: 'client', header: '거래처' },
      { accessorKey: 'clientManager', header: '거래처담당자' },
      { accessorKey: 'deliveryItem', header: '납품품목' },
      { accessorKey: 'quantity', header: '납품량' },
      { accessorKey: 'deliveryLocation', header: '납품장소' },
      { accessorKey: 'manager', header: '담당자' },
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
                setModalDelivery(row.original)
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
    { label: '수주번호', key: 'orderNo' },
    { label: '거래처', key: 'client' },
    { label: '거래처담당자', key: 'clientManager' },
    { label: '납품품목', key: 'deliveryItem' },
    { label: '납품량', key: 'quantity' },
    { label: '납품장소', key: 'deliveryLocation' },
    { label: '담당자', key: 'manager' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="납품현황 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        <CusTable data={pagedDeliveryStatus} columns={columns} onRowClick={setModalDelivery} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredDeliveryStatus.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalDelivery !== null}
        onClose={() => setModalDelivery(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalDelivery ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
