import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { KpiGrid } from '@components/kpi/KpiGrid'
import { MesAreaChart } from '@components/chart/MesAreaChart'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface InpiProductionResult {
  resultNo: string
  workOrderNo: string
  itemName: string
  producedQty: string
  defectQty: string
  yieldRate: string
  registeredAt: string
}

const dummyProductionResults: InpiProductionResult[] = [
  { resultNo: 'PR-I-3100', workOrderNo: 'WO-I-2400', itemName: '인피 원면', producedQty: '820 kg', defectQty: '8 kg', yieldRate: '98%', registeredAt: '2026-06-22 09:20' },
  { resultNo: 'PR-I-3101', workOrderNo: 'WO-I-2401', itemName: '인피 섬유', producedQty: '916 kg', defectQty: '9 kg', yieldRate: '97.6%', registeredAt: '2026-06-21 10:20' },
  { resultNo: 'PR-I-3102', workOrderNo: 'WO-I-2402', itemName: '인피 매트', producedQty: '1012 kg', defectQty: '10 kg', yieldRate: '97.2%', registeredAt: '2026-06-20 11:20' },
  { resultNo: 'PR-I-3103', workOrderNo: 'WO-I-2403', itemName: '인피 패드', producedQty: '1108 kg', defectQty: '11 kg', yieldRate: '96.8%', registeredAt: '2026-06-19 12:20' },
  { resultNo: 'PR-I-3104', workOrderNo: 'WO-I-2404', itemName: '인피 롤', producedQty: '1204 kg', defectQty: '12 kg', yieldRate: '96.4%', registeredAt: '2026-06-18 13:20' },
  { resultNo: 'PR-I-3105', workOrderNo: 'WO-I-2405', itemName: '인피 보드', producedQty: '1300 kg', defectQty: '13 kg', yieldRate: '96%', registeredAt: '2026-06-17 14:20' },
]

const productionResultKpis: { label: string; value: string; tone: StatusTone }[] = [
  { label: '금일 생산량', value: '3,420 kg', tone: 'good' },
  { label: '금일 불량률', value: '1.8%', tone: 'warn' },
  { label: '목표달성률', value: '92%', tone: 'info' },
]

const productionResultChart = {
  title: '인피 실적 추이',
  items: [
    { label: '투입', value: 45, tone: 'info' as StatusTone },
    { label: '개섬', value: 53, tone: 'info' as StatusTone },
    { label: '정렬', value: 61, tone: 'info' as StatusTone },
    { label: '압축', value: 69, tone: 'info' as StatusTone },
    { label: '포장', value: 77, tone: 'info' as StatusTone },
  ],
}

const PAGE_SIZE = 10

export function InpiProductionResultsPage() {
  const [filteredResults, setFilteredResults] = useState<InpiProductionResult[]>(dummyProductionResults)
  const [modalResult, setModalResult] = useState<InpiProductionResult | null>(null)
  const [page, setPage] = useState(0)

  const registeredStartRef = useRef<HTMLInputElement>(null)
  const registeredEndRef = useRef<HTMLInputElement>(null)
  const workOrderNoRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '등록', startRef: registeredStartRef, endRef: registeredEndRef },
    { type: 'input', label: '작업지시번호', ref: workOrderNoRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
  ]

  const handleSearch = () => {
    const start = registeredStartRef.current?.value ?? ''
    const end = registeredEndRef.current?.value ?? ''
    const workOrderNo = workOrderNoRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''

    // 현재는 더미생산실적에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredResults(
      dummyProductionResults.filter((result) => {
        const date = result.registeredAt.slice(0, 10)
        return (
          (!start || date >= start) &&
          (!end || date <= end) &&
          (!workOrderNo || result.workOrderNo.includes(workOrderNo)) &&
          (!itemName || result.itemName.includes(itemName))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[registeredStartRef, registeredEndRef, workOrderNoRef, itemNameRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredResults(dummyProductionResults)
  }

  const handleDelete = (result: InpiProductionResult) => {
    if (window.confirm(`${result.resultNo} 실적을 삭제할까요?`)) {
      setFilteredResults((prev) => prev.filter((r) => r !== result))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredResults((prev) => prev.map((r) => (r === modalResult ? ({ ...r, ...updated } as InpiProductionResult) : r)))
    setModalResult(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredResults])

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE))
  const pagedResults = filteredResults.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiProductionResult>[] = useMemo(
    () => [
      { accessorKey: 'resultNo', header: '실적번호' },
      { accessorKey: 'workOrderNo', header: '작업지시번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'producedQty', header: '생산수량' },
      { accessorKey: 'defectQty', header: '불량수량' },
      { accessorKey: 'yieldRate', header: '양품률' },
      { accessorKey: 'registeredAt', header: '등록일시' },
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
                setModalResult(row.original)
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
    { label: '실적번호', key: 'resultNo' },
    { label: '작업지시번호', key: 'workOrderNo' },
    { label: '품목명', key: 'itemName' },
    { label: '생산수량', key: 'producedQty' },
    { label: '불량수량', key: 'defectQty' },
    { label: '양품률', key: 'yieldRate' },
    { label: '등록일시', key: 'registeredAt' },
  ]

  return (
    <section className="screenStack">
      <KpiGrid kpis={productionResultKpis} />
      <MesAreaChart title={productionResultChart.title} items={productionResultChart.items} />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="인피 생산실적관리 목록" action="새로고침" onAction={() => window.alert('mock 새로고침')}>
        <CusTable data={pagedResults} columns={columns} onRowClick={setModalResult} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredResults.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalResult !== null}
        onClose={() => setModalResult(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalResult ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
