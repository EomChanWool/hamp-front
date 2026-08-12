import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { MesAreaChart } from '@components/chart/MesAreaChart'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface EnvironmentRecord {
  measuredAt: string
  zone: string
  sensorName: string
  temperature: string
  humidity: string
  co2: string
  status: string
  equipmentName: string
}

function statusTone(status: string): StatusTone {
  if (status === '정상') return 'good'
  if (status === '주의') return 'warn'
  if (status === '경고') return 'danger'
  return 'muted'
}

const dummyEnvironmentRecords: EnvironmentRecord[] = [
  { measuredAt: '2026-06-22 05:20', zone: 'A동 원료실', sensorName: '환경센서-1', temperature: '21.2℃', humidity: '45%', co2: '420ppm', status: '정상', equipmentName: '추출기-01' },
  { measuredAt: '2026-06-21 06:20', zone: 'B동 생산실', sensorName: '환경센서-2', temperature: '22.2℃', humidity: '46%', co2: '460ppm', status: '주의', equipmentName: '건조기-02' },
  { measuredAt: '2026-06-20 07:20', zone: 'C동 포장실', sensorName: '환경센서-3', temperature: '23.2℃', humidity: '47%', co2: '500ppm', status: '경고', equipmentName: '세척기-03' },
  { measuredAt: '2026-06-19 08:20', zone: '품질검사실', sensorName: '환경센서-4', temperature: '24.2℃', humidity: '48%', co2: '540ppm', status: '정상', equipmentName: '분쇄기-01' },
  { measuredAt: '2026-06-18 09:20', zone: '저온창고', sensorName: '환경센서-5', temperature: '25.2℃', humidity: '49%', co2: '580ppm', status: '주의', equipmentName: '포장기-04' },
  { measuredAt: '2026-06-17 10:20', zone: '출하장', sensorName: '환경센서-6', temperature: '26.2℃', humidity: '50%', co2: '620ppm', status: '경고', equipmentName: '압축기-02' },
]

const environmentChart = {
  title: '환경 수집 추이',
  items: [
    { label: 'A동 원료실', value: 30, tone: 'info' as StatusTone },
    { label: 'B동 생산실', value: 41, tone: 'info' as StatusTone },
    { label: 'C동 포장실', value: 52, tone: 'info' as StatusTone },
    { label: '품질검사실', value: 63, tone: 'info' as StatusTone },
    { label: '저온창고', value: 74, tone: 'info' as StatusTone },
    { label: '출하장', value: 85, tone: 'info' as StatusTone },
  ],
}

const PAGE_SIZE = 10

export function FacilityEnvironmentHistoryPage() {
  const [filteredRecords, setFilteredRecords] = useState<EnvironmentRecord[]>(dummyEnvironmentRecords)
  const [modalRecord, setModalRecord] = useState<EnvironmentRecord | null>(null)
  const [page, setPage] = useState(0)

  const periodStartRef = useRef<HTMLInputElement>(null)
  const periodEndRef = useRef<HTMLInputElement>(null)
  const zoneRef = useRef<HTMLInputElement>(null)
  const sensorTypeRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: periodStartRef, endRef: periodEndRef },
    { type: 'input', label: '구역', ref: zoneRef, name: "equipmentName" },
    { type: 'input', label: '센서유형', ref: sensorTypeRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const start = periodStartRef.current?.value ?? ''
    const end = periodEndRef.current?.value ?? ''
    const zone = zoneRef.current?.value.trim() ?? ''
    const sensorType = sensorTypeRef.current?.value.trim() ?? ''

    // 현재는 더미환경데이터에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredRecords(
      dummyEnvironmentRecords.filter((record) => {
        const date = record.measuredAt.slice(0, 10)
        return (
          (!start || date >= start) &&
          (!end || date <= end) &&
          (!zone || record.zone.includes(zone)) &&
          (!sensorType || record.sensorName.includes(sensorType))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[periodStartRef, periodEndRef, zoneRef, sensorTypeRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredRecords(dummyEnvironmentRecords)
  }

  const handleDelete = (record: EnvironmentRecord) => {
    if (window.confirm(`${record.sensorName} 기록을 삭제할까요?`)) {
      setFilteredRecords((prev) => prev.filter((r) => r !== record))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredRecords((prev) => prev.map((r) => (r === modalRecord ? ({ ...r, ...updated } as EnvironmentRecord) : r)))
    setModalRecord(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredRecords])

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE))
  const pagedRecords = filteredRecords.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<EnvironmentRecord>[] = useMemo(
    () => [
      { accessorKey: 'measuredAt', header: '측정일시' },
      { accessorKey: 'zone', header: '구역' },
      { accessorKey: 'sensorName', header: '센서명' },
      { accessorKey: 'temperature', header: '온도' },
      { accessorKey: 'humidity', header: '습도' },
      { accessorKey: 'co2', header: 'CO2' },
      {
        accessorKey: 'status',
        header: '상태',
        cell: ({ getValue }) => <Badge tone={statusTone(getValue() as string)}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'equipmentName', header: '수집장비' },
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
                setModalRecord(row.original)
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
    { label: '측정일시', key: 'measuredAt' },
    { label: '구역', key: 'zone' },
    { label: '센서명', key: 'sensorName' },
    { label: '온도', key: 'temperature' },
    { label: '습도', key: 'humidity' },
    { label: 'CO2', key: 'co2' },
    { label: '상태', key: 'status' },
    { label: '수집장비', key: 'equipmentName' },
  ]

  return (
    <section className="screenStack">
      <MesAreaChart title={environmentChart.title} items={environmentChart.items} />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="환경 데이터 이력 조회 목록">
        <CusTable data={pagedRecords} columns={columns} onRowClick={setModalRecord} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredRecords.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalRecord !== null}
        onClose={() => setModalRecord(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalRecord ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
