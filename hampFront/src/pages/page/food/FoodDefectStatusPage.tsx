import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { KpiGrid } from '@components/kpi/KpiGrid'
import { MesAreaChart } from '@components/chart/MesAreaChart'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface DefectStatusRow {
  occurredAt: string
  itemName: string
  lotNumber: string
  process: string
  defectType: '이물' | '중량미달' | '파손' | '색상불량'
  quantity: string
  status: '접수' | '원인분석중' | '조치완료' | '폐기'
  manager: string
}

const dummyDefectStatus: DefectStatusRow[] = [
  { occurredAt: '2026-06-22 11:20', itemName: '헴프 오일', lotNumber: 'LOT-7100', process: '세척', defectType: '이물', quantity: '3 kg', status: '접수', manager: '김민준' },
  { occurredAt: '2026-06-21 12:20', itemName: '헴프 분말', lotNumber: 'LOT-7101', process: '건조', defectType: '중량미달', quantity: '4 kg', status: '원인분석중', manager: '이서연' },
  { occurredAt: '2026-06-20 13:20', itemName: '단백질 바', lotNumber: 'LOT-7102', process: '포장', defectType: '파손', quantity: '5 kg', status: '조치완료', manager: '박지훈' },
  { occurredAt: '2026-06-19 14:20', itemName: '헴프 음료', lotNumber: 'LOT-7103', process: '압축', defectType: '색상불량', quantity: '6 kg', status: '폐기', manager: '최유진' },
  { occurredAt: '2026-06-18 15:20', itemName: '씨드 그래놀라', lotNumber: 'LOT-7104', process: '세척', defectType: '이물', quantity: '7 kg', status: '접수', manager: '정도윤' },
  { occurredAt: '2026-06-17 16:20', itemName: '헴프 캡슐', lotNumber: 'LOT-7105', process: '건조', defectType: '중량미달', quantity: '8 kg', status: '원인분석중', manager: '한수아' },
]

const DEFECT_TYPE_COLORS: Record<string, string> = {
  이물: '#10b981',
  중량미달: '#ef4444',
  파손: '#ff8c3a',
  색상불량: '#8b5cf6',
  포장불량: '#eab308',
  기타: '#64748b',
}

const DEFECT_STATUS_COLORS: Record<string, string> = {
  접수: '#818cf8',
  원인분석중: '#e879f9',
  조치완료: '#22d3ee',
  폐기: '#94a3b8',
}

const defectStatusKpis: { label: string; value: string; tone: StatusTone }[] = [
  { label: '금일 불량건수', value: '14건', tone: 'warn' },
  { label: '불량수량', value: '82 kg', tone: 'danger' },
  { label: '불량률', value: '1.9%', tone: 'warn' },
  { label: '조치완료율', value: '76%', tone: 'good' },
]

const defectStatusChart = {
  title: '불량유형별 현황',
  items: [
    { label: '이물', value: 28, tone: 'warn' as StatusTone },
    { label: '중량미달', value: 40, tone: 'warn' as StatusTone },
    { label: '파손', value: 52, tone: 'warn' as StatusTone },
    { label: '색상불량', value: 64, tone: 'danger' as StatusTone },
  ],
}

const PAGE_SIZE = 10

export function FoodDefectStatusPage() {
  const [filteredDefectStatus, setFilteredDefectStatus] = useState<DefectStatusRow[]>(dummyDefectStatus)
  const [modalDefectStatus, setModalDefectStatus] = useState<DefectStatusRow | null>(null)
  const [page, setPage] = useState(0)

  const periodStartRef = useRef<HTMLInputElement>(null)
  const periodEndRef = useRef<HTMLInputElement>(null)
  const processRef = useRef<HTMLInputElement>(null)
  const defectTypeRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: periodStartRef, endRef: periodEndRef },
    { type: 'input', label: '공정', ref: processRef },
    { type: 'input', label: '불량유형', ref: defectTypeRef },
  ]

  const handleSearch = () => {
    const periodStart = periodStartRef.current?.value ?? ''
    const periodEnd = periodEndRef.current?.value ?? ''
    const process = processRef.current?.value.trim() ?? ''
    const defectType = defectTypeRef.current?.value.trim() ?? ''

    // 현재는 더미불량현황에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredDefectStatus(
      dummyDefectStatus.filter(
        (status) =>
          (!periodStart || status.occurredAt.slice(0, 10) >= periodStart) &&
          (!periodEnd || status.occurredAt.slice(0, 10) <= periodEnd) &&
          (!process || status.process.includes(process)) &&
          (!defectType || status.defectType.includes(defectType)),
      ),
    )
  }

  const handleReset = () => {
    ;[periodStartRef, periodEndRef, processRef, defectTypeRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredDefectStatus(dummyDefectStatus)
  }

  const handleDelete = (status: DefectStatusRow) => {
    if (window.confirm(`${status.lotNumber} 불량 이력을 삭제할까요?`)) {
      setFilteredDefectStatus((prev) => prev.filter((s) => s !== status))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredDefectStatus((prev) => prev.map((s) => (s === modalDefectStatus ? ({ ...s, ...updated } as DefectStatusRow) : s)))
    setModalDefectStatus(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredDefectStatus])

  const totalPages = Math.max(1, Math.ceil(filteredDefectStatus.length / PAGE_SIZE))
  const pagedDefectStatus = filteredDefectStatus.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<DefectStatusRow>[] = useMemo(
    () => [
      { accessorKey: 'occurredAt', header: '발생일시' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'lotNumber', header: 'LOT번호' },
      { accessorKey: 'process', header: '공정' },
      {
        accessorKey: 'defectType',
        header: '불량유형',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <span style={{ color: DEFECT_TYPE_COLORS[value], fontWeight: 600 }}>{value}</span>
        },
      },
      { accessorKey: 'quantity', header: '수량' },
      {
        accessorKey: 'status',
        header: '처리상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <span style={{ color: DEFECT_STATUS_COLORS[value], fontWeight: 600 }}>{value}</span>
        },
      },
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
                setModalDefectStatus(row.original)
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
    { label: '발생일시', key: 'occurredAt' },
    { label: '품목명', key: 'itemName' },
    { label: 'LOT번호', key: 'lotNumber' },
    { label: '공정', key: 'process' },
    { label: '불량유형', key: 'defectType' },
    { label: '수량', key: 'quantity' },
    { label: '처리상태', key: 'status' },
    { label: '담당자', key: 'manager' },
  ]

  return (
    <section className="screenStack">
      <KpiGrid kpis={defectStatusKpis} />
      <MesAreaChart title={defectStatusChart.title} items={defectStatusChart.items} />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="식품 불량현황 목록" action="새로고침" onAction={() => window.alert('mock 새로고침')}>
        <CusTable data={pagedDefectStatus} columns={columns} onRowClick={setModalDefectStatus} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredDefectStatus.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalDefectStatus !== null}
        onClose={() => setModalDefectStatus(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalDefectStatus ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
