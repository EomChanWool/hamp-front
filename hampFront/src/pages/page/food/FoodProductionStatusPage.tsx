import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { KpiGrid } from '@components/kpi/KpiGrid'
import { MesAreaChart } from '@components/chart/MesAreaChart'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface ProductionStatusRow {
  workOrderNo: string
  itemName: string
  process: string
  progressRate: string
  producedQty: string
  manager: string
  status: '대기' | '진행중' | '완료'
  startedAt: string
}

const dummyProductionStatus: ProductionStatusRow[] = [
  { workOrderNo: 'WO-F-2500', itemName: '헴프 오일', process: '원료투입', progressRate: '42%', producedQty: '520 kg', manager: '김민준', status: '대기', startedAt: '2026-06-22 07:20' },
  { workOrderNo: 'WO-F-2501', itemName: '헴프 분말', process: '세척', progressRate: '51%', producedQty: '590 kg', manager: '이서연', status: '진행중', startedAt: '2026-06-21 08:20' },
  { workOrderNo: 'WO-F-2502', itemName: '단백질 바', process: '건조', progressRate: '60%', producedQty: '660 kg', manager: '박지훈', status: '완료', startedAt: '2026-06-20 09:20' },
  { workOrderNo: 'WO-F-2503', itemName: '헴프 음료', process: '분쇄', progressRate: '69%', producedQty: '730 kg', manager: '최유진', status: '대기', startedAt: '2026-06-19 10:20' },
  { workOrderNo: 'WO-F-2504', itemName: '씨드 그래놀라', process: '선별', progressRate: '78%', producedQty: '800 kg', manager: '정도윤', status: '진행중', startedAt: '2026-06-18 11:20' },
  { workOrderNo: 'WO-F-2505', itemName: '헴프 캡슐', process: '포장', progressRate: '87%', producedQty: '870 kg', manager: '한수아', status: '완료', startedAt: '2026-06-17 12:20' },
]

const productionStatusKpis: { label: string; value: string; tone: StatusTone }[] = [
  { label: '진행 작업', value: '12건', tone: 'info' },
  { label: '완료 작업', value: '8건', tone: 'good' },
  { label: '지연 작업', value: '2건', tone: 'warn' },
  { label: '라인 효율', value: '86%', tone: 'good' },
]

const productionStatusChart = {
  title: '공정별 진행률',
  items: [
    { label: '원료투입', value: 36, tone: 'good' as StatusTone },
    { label: '세척', value: 46, tone: 'warn' as StatusTone },
    { label: '건조', value: 56, tone: 'good' as StatusTone },
    { label: '분쇄', value: 66, tone: 'good' as StatusTone },
    { label: '선별', value: 76, tone: 'good' as StatusTone },
    { label: '포장', value: 86, tone: 'good' as StatusTone },
  ],
}

const PAGE_SIZE = 10

export function FoodProductionStatusPage() {
  const [filteredStatus, setFilteredStatus] = useState<ProductionStatusRow[]>(dummyProductionStatus)
  const [modalStatus, setModalStatus] = useState<ProductionStatusRow | null>(null)
  const [page, setPage] = useState(0)

  const periodStartRef = useRef<HTMLInputElement>(null)
  const periodEndRef = useRef<HTMLInputElement>(null)
  const processRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: periodStartRef, endRef: periodEndRef },
    { type: 'input', label: '공정', ref: processRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
  ]

  const handleSearch = () => {
    const periodStart = periodStartRef.current?.value ?? ''
    const periodEnd = periodEndRef.current?.value ?? ''
    const process = processRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''

    // 현재는 더미생산현황에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredStatus(
      dummyProductionStatus.filter(
        (status) =>
          (!periodStart || status.startedAt.slice(0, 10) >= periodStart) &&
          (!periodEnd || status.startedAt.slice(0, 10) <= periodEnd) &&
          (!process || status.process.includes(process)) &&
          (!itemName || status.itemName.includes(itemName)),
      ),
    )
  }

  const handleReset = () => {
    ;[periodStartRef, periodEndRef, processRef, itemNameRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredStatus(dummyProductionStatus)
  }

  const handleDelete = (status: ProductionStatusRow) => {
    if (window.confirm(`${status.workOrderNo} 작업을 삭제할까요?`)) {
      setFilteredStatus((prev) => prev.filter((s) => s !== status))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredStatus((prev) => prev.map((s) => (s === modalStatus ? ({ ...s, ...updated } as ProductionStatusRow) : s)))
    setModalStatus(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredStatus])

  const totalPages = Math.max(1, Math.ceil(filteredStatus.length / PAGE_SIZE))
  const pagedStatus = filteredStatus.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<ProductionStatusRow>[] = useMemo(
    () => [
      { accessorKey: 'workOrderNo', header: '작업지시번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'process', header: '공정' },
      { accessorKey: 'progressRate', header: '진행률' },
      { accessorKey: 'producedQty', header: '생산량' },
      { accessorKey: 'manager', header: '담당자' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const tone = value === '완료' ? 'good' : 'warn'
          return <Badge tone={tone}>{value}</Badge>
        },
      },
      { accessorKey: 'startedAt', header: '시작일시' },
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
    { label: '작업지시번호', key: 'workOrderNo' },
    { label: '품목명', key: 'itemName' },
    { label: '공정', key: 'process' },
    { label: '진행률', key: 'progressRate' },
    { label: '생산량', key: 'producedQty' },
    { label: '담당자', key: 'manager' },
    { label: '상태', key: 'status' },
    { label: '시작일시', key: 'startedAt' },
  ]

  return (
    <section className="screenStack">
      <KpiGrid kpis={productionStatusKpis} />
      <MesAreaChart title={productionStatusChart.title} items={productionStatusChart.items} />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="식품 생산현황 목록" action="새로고침" onAction={() => window.alert('mock 새로고침')}>
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
