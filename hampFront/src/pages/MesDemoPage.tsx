import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../components/Badge'
import { DataTable } from '../components/DataTable'
import { Panel } from '../components/Panel'
import { RowDetailModal } from '../components/RowDetailModal'
import { KpiGrid } from '../components/kpi/KpiGrid'
import { MesAreaChart } from '../components/chart/MesAreaChart'
import { PermissionBoard } from '../components/permission/PermissionBoard'
import { CctvGrid } from '../components/cctv/CctvGrid'
import { getStatusTone, mesScreens, type MesRow } from '../data/mesScreens'
import { menuGroups } from '../data/navigation'
import type { ScreenKey, StatusTone } from '../types'
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/16/solid'

function makeEmptyRow(columns: string[], count: number): MesRow {
  return Object.fromEntries(
    columns.map((column, index) => [
      `c${index}`,
      index === 0
        ? `NEW-${String(count).padStart(3, '0')}`
        : column.includes('상태')
          ? '대기'
          : '',
    ]),
  )
}

function cellTone(value: string): StatusTone | null {
  const tone = getStatusTone(value)
  if (tone === 'muted') return null
  return tone
}

export function MesDemoPage({ screen }: { screen: ScreenKey }) {
  const definition = mesScreens[screen]
  const groupTitle =
    menuGroups.find((group) => group.items.some((item) => item.key === screen))?.title ?? 'MES'

  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<MesRow[]>(definition.rows)
  const [modalRow, setModalRow] = useState<MesRow | null>(null)
  const [updatedAt, setUpdatedAt] = useState(new Date())
  const [pulse, setPulse] = useState(0)
  const [filterKey, setFilterKey] = useState(0)

  useEffect(() => {
    setKeyword('')
    setRows(definition.rows)
    setModalRow(null)
  }, [definition])

  useEffect(() => {
    if (definition.kind !== 'realtime') return
    const timer = window.setInterval(() => {
      setUpdatedAt(new Date())
      setPulse((v) => v + 1)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [definition.kind])

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) =>
      Object.values(row).join(' ').toLowerCase().includes(normalized),
    )
  }, [keyword, rows])

  const fields = definition.columns.map((label, index) => ({ label, key: `c${index}` }))

  const handleAdd = () => {
    const nextRow = makeEmptyRow(definition.columns, rows.length + 1)
    setRows((current) => [nextRow, ...current])
    setModalRow(nextRow)
  }

  const handleDelete = (row: MesRow) => {
    if (window.confirm(`${row.c0} 항목을 화면에서 삭제할까요?`)) {
      setRows((current) => current.filter((item) => item !== row))
      window.alert('실제 API 호출 없이 mock data에서만 삭제되었습니다.')
    }
  }

  const handleReset = () => {
    setKeyword('')
    setFilterKey((k) => k + 1)
  }

  const saveRow = (updated: Record<string, string>) => {
    setRows((current) =>
      current.map((row) => (row === modalRow ? { ...row, ...updated } : row)),
    )
    setModalRow(null)
    window.alert('실제 API 호출 없이 화면 상태에만 저장되었습니다.')
  }

  const tableRows = filteredRows.map((row) => [
    ...definition.columns.map((_, index) => {
      const value = row[`c${index}`] ?? ''
      const tone = cellTone(value)
      return tone ? <Badge tone={tone}>{value}</Badge> : value
    }),
    <div className="rowActions">
      <button
        type="button"
        className="miniButton"
        onClick={(e) => {
          e.stopPropagation()
          setModalRow(row)
        }}
      >
        상세
      </button>
      <button
        type="button"
        className="miniButton danger"
        onClick={(e) => {
          e.stopPropagation()
          handleDelete(row)
        }}
      >
        삭제
      </button>
    </div>,
  ])

  return (
    <section className="screenStack">
      {/* KPI */}
      {definition.kpis && <KpiGrid kpis={definition.kpis} pulse={pulse} />}

      {/* 실시간 배너 */}
      {definition.kind === 'realtime' && (
        <div className="realtimeStrip">
          <span className="liveDot" />
          <strong>실시간 mock 갱신</strong>
          <span>최종 갱신시간 {updatedAt.toLocaleTimeString('ko-KR')}</span>
        </div>
      )}

      {/* 권한 매트릭스 */}
      {definition.kind === 'permission' && <PermissionBoard />}

      {/* CCTV 그리드 */}
      {definition.kind === 'cctv' && <CctvGrid rows={rows} />}

      {/* 차트 */}
      {definition.chart && (
        <MesAreaChart
          title={definition.chart.title}
          items={definition.chart.items}
          pulse={pulse}
        />
      )}

      {/* 패널 (LOT 흐름 등) */}
      {definition.panels?.map((panel) => (
        <Panel key={panel.title} title={panel.title}>
          <div className="timelineList">
            {panel.items.map((item, index) => (
              <div key={item.label} className="timelineItem">
                <span>{index + 1}</span>
                <strong>{item.label}</strong>
                <Badge tone={item.tone ?? getStatusTone(item.value)}>{item.value}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      ))}

      {/* 검색 필터 */}
      <div className="searchBand">
        <div className="searchBandTop">
          <h2>
            <AdjustmentsHorizontalIcon className="w-5 h-5" /> Search
          </h2>
          <button className="resetButton" onClick={handleReset}>
            <ArrowPathIcon className="w-5 h-5" /> 초기화
          </button>
        </div>
        <div className="serchItem">
          {definition.filters.map((filter, index) => (
            <label key={`${filterKey}-${filter}`}>
              <p>{filter}</p>
              <input
                type={filter.includes('일') ? 'date' : 'text'}
                value={index === 0 && !filter.includes('일') ? keyword : undefined}
                onChange={(e) =>
                  index === 0 && !filter.includes('일') && setKeyword(e.target.value)
                }
                placeholder={`${filter} 입력`}
              />
            </label>
          ))}
          <button
            type="button"
            className="primaryButton"
            onClick={() => window.alert('mock data 기준으로 조회되었습니다.')}
          >
            조회
          </button>
        </div>
      </div>

      {/* 메인 테이블 */}
      <Panel
        title={`${definition.title} 목록`}
        action={
          definition.kind === 'dashboard' || definition.kind === 'realtime'
            ? '새로고침'
            : '등록'
        }
        onAction={
          definition.kind === 'dashboard' || definition.kind === 'realtime'
            ? () => setUpdatedAt(new Date())
            : handleAdd
        }
      >
        <DataTable
          headers={[...definition.columns, '관리']}
          rows={tableRows}
          onRowClick={(index) => {
            const row = filteredRows[index]
            if (row) setModalRow(row)
          }}
        />
        <div className="paginationBar">
          <span className="paginationInfo">{filteredRows.length}건</span>
          <div className="paginationBtns">
            <button type="button" className="pageBtn" aria-label="이전 페이지">
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            {[1, 2, 3, 4, 5].map((page) => (
              <button
                key={page}
                type="button"
                className={`pageBtn ${page === 1 ? 'active' : ''}`}
              >
                {page}
              </button>
            ))}
            <button type="button" className="pageBtn" aria-label="다음 페이지">
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Panel>

      {/* 운영 메모 */}
      <Panel
        title="운영 메모"
        action="처리 완료"
        onAction={() => window.alert('mock 상태로 처리되었습니다.')}
      >
        <div className="detailList">
          <div>
            <span>메뉴 경로</span>
            <strong>
              {groupTitle} / {definition.title}
            </strong>
          </div>
          <div>
            <span>화면 동작</span>
            <strong>
              검색, 등록, 수정, 삭제, 상세 확인은 API 없이 브라우저 상태에서만 동작합니다.
            </strong>
          </div>
        </div>
      </Panel>

      <RowDetailModal
        isOpen={modalRow !== null}
        onClose={() => setModalRow(null)}
        onSave={saveRow}
        fields={fields}
        data={modalRow ?? {}}
      />
    </section>
  )
}
