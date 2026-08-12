import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import type { StatusTone } from '@/types'

interface InpiLot {
  lotNo: string
  itemName: string
  producedDate: string
  rawLot: string
  producedQty: string
  currentStatus: '생산완료' | '검사대기' | '검사완료' | '출고완료'
  shippedStatus: '출고완료' | '미출고'
}

const dummyLots: InpiLot[] = [
  { lotNo: 'LOT-I-2606-11', itemName: '인피 원면', producedDate: '2026-06-20', rawLot: 'RM-8100', producedQty: '700 kg', currentStatus: '생산완료', shippedStatus: '출고완료' },
  { lotNo: 'LOT-I-2606-12', itemName: '인피 섬유', producedDate: '2026-06-19', rawLot: 'RM-8101', producedQty: '780 kg', currentStatus: '검사대기', shippedStatus: '미출고' },
  { lotNo: 'LOT-I-2606-13', itemName: '인피 매트', producedDate: '2026-06-18', rawLot: 'RM-8102', producedQty: '860 kg', currentStatus: '검사완료', shippedStatus: '미출고' },
  { lotNo: 'LOT-I-2606-14', itemName: '인피 패드', producedDate: '2026-06-17', rawLot: 'RM-8103', producedQty: '940 kg', currentStatus: '출고완료', shippedStatus: '출고완료' },
  { lotNo: 'LOT-I-2606-15', itemName: '인피 롤', producedDate: '2026-06-16', rawLot: 'RM-8104', producedQty: '1020 kg', currentStatus: '생산완료', shippedStatus: '미출고' },
  { lotNo: 'LOT-I-2606-16', itemName: '인피 보드', producedDate: '2026-06-15', rawLot: 'RM-8105', producedQty: '1100 kg', currentStatus: '검사대기', shippedStatus: '미출고' },
]

const lotFlowPanel: { title: string; items: { label: string; value: string; tone: StatusTone }[] } = {
  title: 'LOT 흐름',
  items: [
    { label: '원료 투입', value: '완료', tone: 'good' },
    { label: '생산', value: '완료', tone: 'good' },
    { label: '검사', value: '완료', tone: 'good' },
    { label: '출고', value: '대기', tone: 'muted' },
  ],
}

const PAGE_SIZE = 10

export function InpiLotManagePage() {
  const [filteredLots, setFilteredLots] = useState<InpiLot[]>(dummyLots)
  const [modalLot, setModalLot] = useState<InpiLot | null>(null)
  const [page, setPage] = useState(0)

  const producedStartRef = useRef<HTMLInputElement>(null)
  const producedEndRef = useRef<HTMLInputElement>(null)
  const lotNoRef = useRef<HTMLInputElement>(null)
  const shippedStatusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '생산', startRef: producedStartRef, endRef: producedEndRef },
    { type: 'input', label: 'LOT번호', ref: lotNoRef, name: "equipmentName" },
    { type: 'input', label: '출고여부', ref: shippedStatusRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const start = producedStartRef.current?.value ?? ''
    const end = producedEndRef.current?.value ?? ''
    const lotNo = lotNoRef.current?.value.trim() ?? ''
    const shippedStatus = shippedStatusRef.current?.value.trim() ?? ''

    // 현재는 더미LOT관리에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredLots(
      dummyLots.filter(
        (lot) =>
          (!start || lot.producedDate >= start) &&
          (!end || lot.producedDate <= end) &&
          (!lotNo || lot.lotNo.includes(lotNo)) &&
          (!shippedStatus || lot.shippedStatus.includes(shippedStatus)),
      ),
    )
  }

  const handleReset = () => {
    ;[producedStartRef, producedEndRef, lotNoRef, shippedStatusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredLots(dummyLots)
  }

  const handleDelete = (lot: InpiLot) => {
    if (window.confirm(`${lot.lotNo} LOT을 삭제할까요?`)) {
      setFilteredLots((prev) => prev.filter((l) => l !== lot))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredLots((prev) => prev.map((l) => (l === modalLot ? ({ ...l, ...updated } as InpiLot) : l)))
    setModalLot(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredLots])

  const totalPages = Math.max(1, Math.ceil(filteredLots.length / PAGE_SIZE))
  const pagedLots = filteredLots.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<InpiLot>[] = useMemo(
    () => [
      { accessorKey: 'lotNo', header: 'LOT번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'producedDate', header: '생산일자' },
      { accessorKey: 'rawLot', header: '원료LOT' },
      { accessorKey: 'producedQty', header: '생산수량' },
      {
        accessorKey: 'currentStatus',
        header: '현재상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <Badge tone={value.includes('완료') ? 'good' : 'warn'}>{value}</Badge>
        },
      },
      {
        accessorKey: 'shippedStatus',
        header: '출고여부',
        cell: ({ getValue }) => {
          const value = getValue() as string
          return <Badge tone={value === '출고완료' ? 'good' : 'muted'}>{value}</Badge>
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
    { label: 'LOT번호', key: 'lotNo' },
    { label: '품목명', key: 'itemName' },
    { label: '생산일자', key: 'producedDate' },
    { label: '원료LOT', key: 'rawLot' },
    { label: '생산수량', key: 'producedQty' },
    { label: '현재상태', key: 'currentStatus' },
    { label: '출고여부', key: 'shippedStatus' },
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

      <Panel title="인피 LOT관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
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
