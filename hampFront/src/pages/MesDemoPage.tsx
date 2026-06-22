import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../components/Badge'
import { DataTable } from '../components/DataTable'
import { Panel } from '../components/Panel'
import { RowDetailModal } from '../components/RowDetailModal'
import { getStatusTone, mesScreens, type MesRow } from '../data/mesScreens'
import { menuGroups } from '../data/navigation'
import type { ScreenKey, StatusTone } from '../types'

function makeEmptyRow(columns: string[], count: number): MesRow {
  return Object.fromEntries(columns.map((column, index) => [`c${index}`, index === 0 ? `NEW-${String(count).padStart(3, '0')}` : column.includes('상태') ? '대기' : '']))
}

function cellTone(value: string): StatusTone | null {
  const tone = getStatusTone(value)
  return tone === 'muted' ? null : tone
}

export function MesDemoPage({ screen }: { screen: ScreenKey }) {
  const definition = mesScreens[screen]
  const groupTitle = menuGroups.find((group) => group.items.some((item) => item.key === screen))?.title ?? 'MES'
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState<MesRow[]>(definition.rows)
  const [modalRow, setModalRow] = useState<MesRow | null>(null)
  const [updatedAt, setUpdatedAt] = useState(new Date())
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    setKeyword('')
    setRows(definition.rows)
    setModalRow(null)
  }, [definition])

  useEffect(() => {
    if (definition.kind !== 'realtime') return

    const timer = window.setInterval(() => {
      setUpdatedAt(new Date())
      setPulse((value) => value + 1)
    }, 2500)

    return () => window.clearInterval(timer)
  }, [definition.kind])

  const filteredRows = useMemo(() => {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized) return rows
    return rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(normalized))
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

  const saveRow = (updated: Record<string, string>) => {
    setRows((current) => current.map((row) => (row === modalRow ? { ...row, ...updated } : row)))
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
        onClick={(event) => {
          event.stopPropagation()
          setModalRow(row)
        }}
      >
        상세
      </button>
      <button
        type="button"
        className="miniButton danger"
        onClick={(event) => {
          event.stopPropagation()
          handleDelete(row)
        }}
      >
        삭제
      </button>
    </div>,
  ])

  return (
    <section className="screenStack">
      {definition.kpis && <KpiGrid kpis={definition.kpis} pulse={pulse} />}

      {definition.kind === 'realtime' && (
        <div className="realtimeStrip">
          <span className="liveDot" />
          <strong>실시간 mock 갱신</strong>
          <span>최종 갱신시간 {updatedAt.toLocaleTimeString('ko-KR')}</span>
        </div>
      )}

      {definition.kind === 'permission' && <PermissionBoard />}

      {definition.kind === 'cctv' && <CctvGrid rows={rows} />}

      {definition.chart && <BarChart title={definition.chart.title} items={definition.chart.items} pulse={pulse} />}

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

      <div className="searchBand">
        {definition.filters.map((filter, index) => (
          <label key={filter}>
            {filter}
            <input
              type={filter.includes('일') ? 'date' : 'text'}
              value={index === 0 && !filter.includes('일') ? keyword : undefined}
              onChange={(event) => index === 0 && !filter.includes('일') && setKeyword(event.target.value)}
              placeholder={`${filter} 입력`}
            />
          </label>
        ))}
        <button type="button" className="primaryButton" onClick={() => window.alert('mock data 기준으로 조회되었습니다.')}>
          조회
        </button>
      </div>

      <Panel
        title={`${definition.title} 목록`}
        action={definition.kind === 'dashboard' || definition.kind === 'realtime' ? '새로고침' : '등록'}
        onAction={definition.kind === 'dashboard' || definition.kind === 'realtime' ? () => setUpdatedAt(new Date()) : handleAdd}
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
          <button type="button" className="miniButton">
            이전
          </button>
          <strong>1</strong>
          <button type="button" className="miniButton">
            다음
          </button>
          <span>{filteredRows.length}건 표시 중</span>
        </div>
      </Panel>

      <Panel title="운영 메모" action="처리 완료" onAction={() => window.alert('mock 상태로 처리되었습니다.')}>
        <div className="detailList">
          <div>
            <span>메뉴 경로</span>
            <strong>
              {groupTitle} / {definition.title}
            </strong>
          </div>
          <div>
            <span>화면 동작</span>
            <strong>검색, 등록, 수정, 삭제, 상세 확인은 API 없이 브라우저 상태에서만 동작합니다.</strong>
          </div>
        </div>
      </Panel>

      <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={saveRow} fields={fields} data={modalRow ?? {}} />
    </section>
  )
}

function KpiGrid({ kpis, pulse }: { kpis: { label: string; value: string; tone: StatusTone }[]; pulse: number }) {
  return (
    <section className="metricGrid">
      {kpis.map((kpi, index) => (
        <article key={kpi.label} className={`metricCard ${kpi.tone} ${pulse % 2 === 1 && index === 0 ? 'pulse' : ''}`}>
          <span>{kpi.label}</span>
          <strong>{kpi.value}</strong>
        </article>
      ))}
    </section>
  )
}

function BarChart({ title, items, pulse }: { title: string; items: { label: string; value: number; tone?: StatusTone }[]; pulse: number }) {
  return (
    <Panel title={title}>
      <div className="barChart">
        {items.map((item, index) => {
          const value = Math.min(100, item.value + (pulse % 3) * (index % 2 === 0 ? 2 : -1))
          return (
            <div key={item.label} className="barRow">
              <span>{item.label}</span>
              <div className="barTrack">
                <i className={item.tone ?? 'info'} style={{ width: `${Math.max(8, value)}%` }} />
              </div>
              <strong>{Math.round(value)}%</strong>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function PermissionBoard() {
  const menus = menuGroups.flatMap((group) => group.items.map((item) => `${group.title} / ${item.label}`))
  const roles = ['시스템관리자', '생산관리자', '품질관리자', '설비관리자', '일반작업자']

  return (
    <section className="permissionBoard">
      <Panel title="권한 그룹">
        <div className="roleList">
          {roles.map((role, index) => (
            <button key={role} type="button" className={index === 0 ? 'active' : ''}>
              <strong>{role}</strong>
              <span>{12 - index}명</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="메뉴 접근 권한">
        <div className="permissionMatrix">
          {menus.slice(0, 12).map((menu, index) => (
            <div key={menu} className="permissionMatrixRow">
              <strong>{menu}</strong>
              {['조회', '등록', '수정', '삭제', '승인'].map((permission, permissionIndex) => (
                <label key={permission} className="checkRow">
                  <input type="checkbox" defaultChecked={index < 8 || permissionIndex < 2} />
                  {permission}
                </label>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </section>
  )
}

function CctvGrid({ rows }: { rows: MesRow[] }) {
  return (
    <section className="cctvGrid">
      {rows.map((row, index) => (
        <article key={row.c0} className="cctvCard">
          <div className={`cctvFrame ${index % 3 === 2 ? 'offline' : ''}`}>
            <span>REC</span>
            <strong>{row.c0}</strong>
          </div>
          <div>
            <strong>{row.c0}</strong>
            <span>{row.c1}</span>
          </div>
          <Badge tone={getStatusTone(row.c2)}>{row.c2}</Badge>
          <small>최근감지시간 {row.c3}</small>
        </article>
      ))}
    </section>
  )
}
