import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { KpiGrid } from '@components/kpi/KpiGrid'
import { MesAreaChart } from '@components/chart/MesAreaChart'
import type { StatusTone } from '@/types'

interface InpiInventoryStatus {
  itemCode: string
  itemName: string
  currentStock: string
  safetyStock: string
  inboundQty: string
  outboundQty: string
  warehouseLocation: string
  status: '정상' | '안전재고미달'
}

const dummyInventoryStatus: InpiInventoryStatus[] = [
  { itemCode: '인피-101', itemName: '인피 원면', currentStock: '420 kg', safetyStock: '240 kg', inboundQty: '32 kg', outboundQty: '18 kg', warehouseLocation: 'A동 원료실', status: '정상' },
  { itemCode: '인피-102', itemName: '인피 섬유', currentStock: '488 kg', safetyStock: '260 kg', inboundQty: '35 kg', outboundQty: '20 kg', warehouseLocation: 'B동 생산실', status: '정상' },
  { itemCode: '인피-103', itemName: '인피 매트', currentStock: '556 kg', safetyStock: '280 kg', inboundQty: '38 kg', outboundQty: '22 kg', warehouseLocation: 'C동 포장실', status: '안전재고미달' },
  { itemCode: '인피-104', itemName: '인피 패드', currentStock: '624 kg', safetyStock: '300 kg', inboundQty: '41 kg', outboundQty: '24 kg', warehouseLocation: '품질검사실', status: '정상' },
  { itemCode: '인피-105', itemName: '인피 롤', currentStock: '692 kg', safetyStock: '320 kg', inboundQty: '44 kg', outboundQty: '26 kg', warehouseLocation: '저온창고', status: '정상' },
  { itemCode: '인피-106', itemName: '인피 보드', currentStock: '760 kg', safetyStock: '340 kg', inboundQty: '47 kg', outboundQty: '28 kg', warehouseLocation: '출하장', status: '정상' },
]

const kpis: { label: string; value: string; tone: StatusTone }[] = [
  { label: '총 재고량', value: '4,820 kg', tone: 'good' },
  { label: '입고량', value: '426 kg', tone: 'info' },
  { label: '출고량', value: '238 kg', tone: 'warn' },
  { label: '안전재고 미달 건수', value: '2건', tone: 'danger' },
]

const chart: { title: string; items: { label: string; value: number; tone: StatusTone }[] } = {
  title: '인피 품목별 재고',
  items: [
    { label: '인피 원면', value: 55, tone: 'good' },
    { label: '인피 섬유', value: 62, tone: 'good' },
    { label: '인피 매트', value: 69, tone: 'warn' },
    { label: '인피 패드', value: 76, tone: 'good' },
    { label: '인피 롤', value: 83, tone: 'good' },
    { label: '인피 보드', value: 90, tone: 'good' },
  ],
}

const PAGE_SIZE = 10

export function InpiInventoryStatusPage() {
  const [filteredStatus, setFilteredStatus] = useState<InpiInventoryStatus[]>(dummyInventoryStatus)
  const [modalStatus, setModalStatus] = useState<InpiInventoryStatus | null>(null)
  const [page, setPage] = useState(0)

  const periodStartRef = useRef<HTMLInputElement>(null)
  const periodEndRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const warehouseLocationRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: periodStartRef, endRef: periodEndRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
    { type: 'input', label: '창고위치', ref: warehouseLocationRef },
  ]

  const handleSearch = () => {
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const warehouseLocation = warehouseLocationRef.current?.value.trim() ?? ''

    // 현재는 더미재고현황에 필터로 걸러내고 있는데 추후에 api 연동할 것
    // (재고현황 데이터에는 날짜 필드가 없어 기간 필터는 현재 동작하지 않는다)
    setFilteredStatus(
      dummyInventoryStatus.filter(
        (item) =>
          (!itemName || item.itemName.includes(itemName)) &&
          (!warehouseLocation || item.warehouseLocation.includes(warehouseLocation)),
      ),
    )
  }

  const handleReset = () => {
    ;[periodStartRef, periodEndRef, itemNameRef, warehouseLocationRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredStatus(dummyInventoryStatus)
  }

  const handleDelete = (item: InpiInventoryStatus) => {
    if (window.confirm(`${item.itemCode} 재고 항목을 삭제할까요?`)) {
      setFilteredStatus((prev) => prev.filter((i) => i !== item))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredStatus((prev) => prev.map((i) => (i === modalStatus ? ({ ...i, ...updated } as InpiInventoryStatus) : i)))
    setModalStatus(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredStatus])

  const totalPages = Math.max(1, Math.ceil(filteredStatus.length / PAGE_SIZE))
  const pagedStatus = filteredStatus.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiInventoryStatus>[] = useMemo(
    () => [
      { accessorKey: 'itemCode', header: '품목코드' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'currentStock', header: '현재고' },
      { accessorKey: 'safetyStock', header: '안전재고' },
      { accessorKey: 'inboundQty', header: '입고량' },
      { accessorKey: 'outboundQty', header: '출고량' },
      { accessorKey: 'warehouseLocation', header: '창고위치' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => <Badge tone={getValue() === '정상' ? 'good' : 'danger'}>{getValue() as string}</Badge>,
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
                setModalStatus(row.original)
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
    { label: '품목코드', key: 'itemCode' },
    { label: '품목명', key: 'itemName' },
    { label: '현재고', key: 'currentStock' },
    { label: '안전재고', key: 'safetyStock' },
    { label: '입고량', key: 'inboundQty' },
    { label: '출고량', key: 'outboundQty' },
    { label: '창고위치', key: 'warehouseLocation' },
    { label: '상태', key: 'status' },
  ]

  return (
    <section className="screenStack">
      <KpiGrid kpis={kpis} />
      <MesAreaChart title={chart.title} items={chart.items} />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="인피 재고현황 목록" action="새로고침" onAction={() => window.alert('mock 새로고침')}>
        <CusTable data={pagedStatus} columns={columns} onRowClick={setModalStatus} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredStatus.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalStatus !== null}
        onClose={() => setModalStatus(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalStatus ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
