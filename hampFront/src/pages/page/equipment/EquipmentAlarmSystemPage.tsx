import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface AlarmRow {
  alarmAt: string
  equipmentName: string
  alarmType: string
  alarmGrade: '정보' | '주의' | '경고' | '위험'
  status: '미처리' | '처리중' | '조치완료'
  manager: string
  action: string
}

const dummyAlarms: AlarmRow[] = [
  { alarmAt: '2026-06-22 12:20', equipmentName: '추출기-01', alarmType: '온도상승', alarmGrade: '정보', status: '미처리', manager: '김민준', action: '현장 확인 중' },
  { alarmAt: '2026-06-21 13:20', equipmentName: '건조기-02', alarmType: '진동감지', alarmGrade: '주의', status: '처리중', manager: '이서연', action: '현장 확인 중' },
  { alarmAt: '2026-06-20 14:20', equipmentName: '세척기-03', alarmType: '전류이상', alarmGrade: '경고', status: '조치완료', manager: '박지훈', action: '센서 교체 완료' },
  { alarmAt: '2026-06-19 15:20', equipmentName: '분쇄기-01', alarmType: '통신지연', alarmGrade: '위험', status: '미처리', manager: '최유진', action: '현장 확인 중' },
  { alarmAt: '2026-06-18 16:20', equipmentName: '포장기-04', alarmType: '온도상승', alarmGrade: '정보', status: '처리중', manager: '정도윤', action: '현장 확인 중' },
  { alarmAt: '2026-06-17 17:20', equipmentName: '압축기-02', alarmType: '진동감지', alarmGrade: '주의', status: '조치완료', manager: '한수아', action: '센서 교체 완료' },
]

const ALARM_GRADE_TONE: Record<AlarmRow['alarmGrade'], 'good' | 'warn' | 'danger' | 'info' | 'muted'> = {
  정보: 'info',
  주의: 'warn',
  경고: 'danger',
  위험: 'danger',
}

const STATUS_COLORS: Record<AlarmRow['status'], string> = {
  미처리: '#e879f9',
  처리중: '#e879f9',
  조치완료: '#22d3ee',
}

const ACTION_COLORS: Record<string, string> = {
  '현장 확인 중': '#fbbf24',
  '센서 교체 완료': '#34d399',
}

const PAGE_SIZE = 10

export function EquipmentAlarmSystemPage() {
  const [filteredAlarms, setFilteredAlarms] = useState<AlarmRow[]>(dummyAlarms)
  const [modalAlarm, setModalAlarm] = useState<AlarmRow | null>(null)
  const [page, setPage] = useState(0)

  const alarmStartRef = useRef<HTMLInputElement>(null)
  const alarmEndRef = useRef<HTMLInputElement>(null)
  const equipmentNameRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '알림', startRef: alarmStartRef, endRef: alarmEndRef },
    { type: 'input', label: '설비명', ref: equipmentNameRef },
    { type: 'input', label: '처리상태', ref: statusRef },
  ]

  const handleSearch = () => {
    const alarmStart = alarmStartRef.current?.value.trim() ?? ''
    const alarmEnd = alarmEndRef.current?.value.trim() ?? ''
    const equipmentName = equipmentNameRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미알림에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredAlarms(
      dummyAlarms.filter((alarm) => {
        const alarmDate = alarm.alarmAt.slice(0, 10)
        return (
          (!alarmStart || alarmDate >= alarmStart) &&
          (!alarmEnd || alarmDate <= alarmEnd) &&
          (!equipmentName || alarm.equipmentName.includes(equipmentName)) &&
          (!status || alarm.status.includes(status))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[alarmStartRef, alarmEndRef, equipmentNameRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredAlarms(dummyAlarms)
  }

  const handleDelete = (alarm: AlarmRow) => {
    if (window.confirm(`${alarm.equipmentName} 알림을 삭제할까요?`)) {
      setFilteredAlarms((prev) => prev.filter((a) => a !== alarm))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredAlarms((prev) => prev.map((a) => (a === modalAlarm ? ({ ...a, ...updated } as AlarmRow) : a)))
    setModalAlarm(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredAlarms])

  const totalPages = Math.max(1, Math.ceil(filteredAlarms.length / PAGE_SIZE))
  const pagedAlarms = filteredAlarms.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<AlarmRow>[] = useMemo(
    () => [
      { accessorKey: 'alarmAt', header: '알림일시' },
      { accessorKey: 'equipmentName', header: '설비명' },
      { accessorKey: 'alarmType', header: '알림유형' },
      {
        accessorKey: 'alarmGrade',
        header: '알림등급',
        cell: ({ getValue }) => {
          const value = getValue() as AlarmRow['alarmGrade']
          return <Badge tone={ALARM_GRADE_TONE[value]}>{value}</Badge>
        },
      },
      {
        accessorKey: 'status',
        header: '처리상태',
        cell: ({ getValue }) => {
          const value = getValue() as AlarmRow['status']
          return <span style={{ color: STATUS_COLORS[value], fontWeight: 600 }}>{value}</span>
        },
      },
      { accessorKey: 'manager', header: '담당자' },
      {
        accessorKey: 'action',
        header: '조치내용',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const color = ACTION_COLORS[value]
          return color ? <span style={{ color, fontWeight: 600 }}>{value}</span> : value
        },
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
                setModalAlarm(row.original)
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
    { label: '알림일시', key: 'alarmAt' },
    { label: '설비명', key: 'equipmentName' },
    { label: '알림유형', key: 'alarmType' },
    { label: '알림등급', key: 'alarmGrade' },
    { label: '처리상태', key: 'status' },
    { label: '담당자', key: 'manager' },
    { label: '조치내용', key: 'action' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="설비알림시스템 목록" action="처리" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedAlarms} columns={columns} onRowClick={setModalAlarm} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredAlarms.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalAlarm !== null}
        onClose={() => setModalAlarm(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalAlarm ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
