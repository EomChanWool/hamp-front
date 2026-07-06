import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { KpiGrid } from '@components/kpi/KpiGrid'
import { MesAreaChart } from '@components/chart/MesAreaChart'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface SeedInventoryStatusRow {
  itemCode: string
  itemName: string
  currentStock: string
  safetyStock: string
  inboundQty: string
  outboundQty: string
  warehouseLocation: string
  status: string
}

const dummySeedInventoryStatus: SeedInventoryStatusRow[] = [
  { itemCode: '씨드-101', itemName: '헴프 오일', currentStock: '420 kg', safetyStock: '240 kg', inboundQty: '32 kg', outboundQty: '18 kg', warehouseLocation: 'A동 원료실', status: '정상' },
  { itemCode: '씨드-102', itemName: '헴프 분말', currentStock: '488 kg', safetyStock: '260 kg', inboundQty: '35 kg', outboundQty: '20 kg', warehouseLocation: 'B동 생산실', status: '정상' },
  { itemCode: '씨드-103', itemName: '단백질 바', currentStock: '556 kg', safetyStock: '280 kg', inboundQty: '38 kg', outboundQty: '22 kg', warehouseLocation: 'C동 포장실', status: '안전재고미달' },
  { itemCode: '씨드-104', itemName: '헴프 음료', currentStock: '624 kg', safetyStock: '300 kg', inboundQty: '41 kg', outboundQty: '24 kg', warehouseLocation: '품질검사실', status: '정상' },
  { itemCode: '씨드-105', itemName: '씨드 그래놀라', currentStock: '692 kg', safetyStock: '320 kg', inboundQty: '44 kg', outboundQty: '26 kg', warehouseLocation: '저온창고', status: '정상' },
  { itemCode: '씨드-106', itemName: '헴프 캡슐', currentStock: '760 kg', safetyStock: '340 kg', inboundQty: '47 kg', outboundQty: '28 kg', warehouseLocation: '출하장', status: '정상' },
]

const seedInventoryKpis: { label: string; value: string; tone: StatusTone }[] = [
  { label: '총 재고량', value: '4,820 kg', tone: 'good' },
  { label: '금일 입고량', value: '426 kg', tone: 'info' },
  { label: '금일 출고량', value: '238 kg', tone: 'warn' },
  { label: '안전재고 미달 건수', value: '2건', tone: 'danger' },
]

const seedInventoryChart: { title: string; items: { label: string; value: number; tone?: StatusTone }[] } = {
  title: '씨드 품목별 재고',
  items: [
    { label: '헴프 오일', value: 55, tone: 'good' },
    { label: '헴프 분말', value: 62, tone: 'good' },
    { label: '단백질 바', value: 69, tone: 'warn' },
    { label: '헴프 음료', value: 76, tone: 'good' },
    { label: '씨드 그래놀라', value: 83, tone: 'good' },
    { label: '헴프 캡슐', value: 90, tone: 'good' },
  ],
}

const PAGE_SIZE = 10

export function SeedInventoryStatusPage() {
  const [filteredSeedInventoryStatus, setFilteredSeedInventoryStatus] = useState<SeedInventoryStatusRow[]>(dummySeedInventoryStatus)
  const [modalSeedInventoryStatus, setModalSeedInventoryStatus] = useState<SeedInventoryStatusRow | null>(null)
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
    // 재고현황 데이터에는 날짜 필드가 없어 기간 검색은 UI만 유지하고 실제 필터에는 반영하지 않는다
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const warehouseLocation = warehouseLocationRef.current?.value.trim() ?? ''

    // 현재는 더미씨드재고현황에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredSeedInventoryStatus(
      dummySeedInventoryStatus.filter(
        (item) =>
          (!itemName || item.itemName.includes(itemName)) &&
          (!warehouseLocation || item.warehouseLocation.includes(warehouseLocation)),
      ),
    )
  }

  const handleReset = () => {
    if (periodStartRef.current) periodStartRef.current.value = ''
    if (periodEndRef.current) periodEndRef.current.value = ''
    ;[itemNameRef, warehouseLocationRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredSeedInventoryStatus(dummySeedInventoryStatus)
  }

  const handleDelete = (item: SeedInventoryStatusRow) => {
    if (window.confirm(`${item.itemCode} 항목을 삭제할까요?`)) {
      setFilteredSeedInventoryStatus((prev) => prev.filter((i) => i !== item))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredSeedInventoryStatus((prev) => prev.map((i) => (i === modalSeedInventoryStatus ? ({ ...i, ...updated } as SeedInventoryStatusRow) : i)))
    setModalSeedInventoryStatus(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredSeedInventoryStatus])

  const totalPages = Math.max(1, Math.ceil(filteredSeedInventoryStatus.length / PAGE_SIZE))
  const pagedSeedInventoryStatus = filteredSeedInventoryStatus.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<SeedInventoryStatusRow>[] = useMemo(
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
                setModalSeedInventoryStatus(row.original)
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
      <KpiGrid kpis={seedInventoryKpis} />
      <MesAreaChart title={seedInventoryChart.title} items={seedInventoryChart.items} />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="씨드 재고현황 목록" action="새로고침" onAction={() => window.alert('mock 새로고침')}>
        <CusTable data={pagedSeedInventoryStatus} columns={columns} onRowClick={setModalSeedInventoryStatus} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredSeedInventoryStatus.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalSeedInventoryStatus !== null}
        onClose={() => setModalSeedInventoryStatus(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalSeedInventoryStatus ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
