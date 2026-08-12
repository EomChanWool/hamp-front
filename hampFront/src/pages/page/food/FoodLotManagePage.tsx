import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface LotRow {
  lotNumber: string
  itemName: string
  producedDate: string
  materialLot: string
  producedQty: string
  currentStatus: '생산완료' | '검사대기' | '검사완료' | '출고완료'
  shipped: '출고완료' | '미출고'
}

const dummyLots: LotRow[] = [
  { lotNumber: 'LOT-F-2606-11', itemName: '헴프 오일', producedDate: '2026-06-20', materialLot: 'RM-8100', producedQty: '700 kg', currentStatus: '생산완료', shipped: '출고완료' },
  { lotNumber: 'LOT-F-2606-12', itemName: '헴프 분말', producedDate: '2026-06-19', materialLot: 'RM-8101', producedQty: '780 kg', currentStatus: '검사대기', shipped: '미출고' },
  { lotNumber: 'LOT-F-2606-13', itemName: '단백질 바', producedDate: '2026-06-18', materialLot: 'RM-8102', producedQty: '860 kg', currentStatus: '검사완료', shipped: '미출고' },
  { lotNumber: 'LOT-F-2606-14', itemName: '헴프 음료', producedDate: '2026-06-17', materialLot: 'RM-8103', producedQty: '940 kg', currentStatus: '출고완료', shipped: '출고완료' },
  { lotNumber: 'LOT-F-2606-15', itemName: '씨드 그래놀라', producedDate: '2026-06-16', materialLot: 'RM-8104', producedQty: '1020 kg', currentStatus: '생산완료', shipped: '미출고' },
  { lotNumber: 'LOT-F-2606-16', itemName: '헴프 캡슐', producedDate: '2026-06-15', materialLot: 'RM-8105', producedQty: '1100 kg', currentStatus: '검사대기', shipped: '미출고' },
]

const lotFlowPanel = {
  title: 'LOT 흐름',
  items: [
    { label: '원료 투입', value: '완료', tone: 'good' as StatusTone },
    { label: '생산', value: '완료', tone: 'good' as StatusTone },
    { label: '검사', value: '완료', tone: 'good' as StatusTone },
    { label: '출고', value: '대기', tone: 'muted' as StatusTone },
  ],
}

const PAGE_SIZE = 10

function currentStatusTone(value: string): StatusTone {
  return value === '검사대기' ? 'warn' : 'good'
}

function shippedTone(value: string): StatusTone {
  return value === '출고완료' ? 'good' : 'info'
}

export function FoodLotManagePage() {
  const [filteredLots, setFilteredLots] = useState<LotRow[]>(dummyLots)
  const [modalLot, setModalLot] = useState<LotRow | null>(null)
  const [page, setPage] = useState(0)

  const producedStartRef = useRef<HTMLInputElement>(null)
  const producedEndRef = useRef<HTMLInputElement>(null)
  const lotNumberRef = useRef<HTMLInputElement>(null)
  const shippedRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '생산', startRef: producedStartRef, endRef: producedEndRef },
    { type: 'input', label: 'LOT번호', ref: lotNumberRef, name: "equipmentName" },
    { type: 'input', label: '출고여부', ref: shippedRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const producedStart = producedStartRef.current?.value ?? ''
    const producedEnd = producedEndRef.current?.value ?? ''
    const lotNumber = lotNumberRef.current?.value.trim() ?? ''
    const shipped = shippedRef.current?.value.trim() ?? ''

    // 현재는 더미LOT에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredLots(
      dummyLots.filter(
        (lot) =>
          (!producedStart || lot.producedDate >= producedStart) &&
          (!producedEnd || lot.producedDate <= producedEnd) &&
          (!lotNumber || lot.lotNumber.includes(lotNumber)) &&
          (!shipped || lot.shipped.includes(shipped)),
      ),
    )
  }

  const handleReset = () => {
    ;[producedStartRef, producedEndRef, lotNumberRef, shippedRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredLots(dummyLots)
  }

  const handleDelete = (lot: LotRow) => {
    if (window.confirm(`${lot.lotNumber} LOT을 삭제할까요?`)) {
      setFilteredLots((prev) => prev.filter((l) => l !== lot))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredLots((prev) => prev.map((l) => (l === modalLot ? ({ ...l, ...updated } as LotRow) : l)))
    setModalLot(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredLots])

  const totalPages = Math.max(1, Math.ceil(filteredLots.length / PAGE_SIZE))
  const pagedLots = filteredLots.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<LotRow>[] = useMemo(
    () => [
      { accessorKey: 'lotNumber', header: 'LOT번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'producedDate', header: '생산일자' },
      { accessorKey: 'materialLot', header: '원료LOT' },
      { accessorKey: 'producedQty', header: '생산수량' },
      {
        accessorKey: 'currentStatus',
        header: '현재상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <Badge tone={currentStatusTone(value)}>{value}</Badge>
        },
      },
      {
        accessorKey: 'shipped',
        header: '출고여부',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <Badge tone={shippedTone(value)}>{value}</Badge>
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
                setModalLot(row.original)
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
    { label: 'LOT번호', key: 'lotNumber' },
    { label: '품목명', key: 'itemName' },
    { label: '생산일자', key: 'producedDate' },
    { label: '원료LOT', key: 'materialLot' },
    { label: '생산수량', key: 'producedQty' },
    { label: '현재상태', key: 'currentStatus' },
    { label: '출고여부', key: 'shipped' },
  ]

  return (
    <section className="screenStack">
      <Panel title={lotFlowPanel.title}>
        <div className="timelineList">
          {lotFlowPanel.items.map((item, index) => (
            <div key={item.label} className="timelineItem">
              <span>{index + 1}</span>
              <strong>{item.label}</strong>
              <Badge tone={item.tone}>{item.value}</Badge>
            </div>
          ))}
        </div>
      </Panel>

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="식품 LOT관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedLots} columns={columns} onRowClick={setModalLot} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredLots.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalLot !== null}
        onClose={() => setModalLot(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalLot ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
