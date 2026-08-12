import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface SeedReportReturnRow {
  reportNo: string
  itemName: string
  quantity: string
  reportDate: string
  returnDueDate: string
  processStatus: string
  manager: string
}

const PROCESS_STATUS_COLORS: Record<string, string> = {
  신고접수: '#818cf8',
  반납대기: '#e879f9',
  반납완료: '#22d3ee',
  취소: '#94a3b8',
}

const dummySeedReportReturns: SeedReportReturnRow[] = [
  { reportNo: 'SR-4000', itemName: '헴프 오일', quantity: '40 kg', reportDate: '2026-06-10', returnDueDate: '2026-06-18', processStatus: '신고접수', manager: '김민준' },
  { reportNo: 'SR-4001', itemName: '헴프 분말', quantity: '48 kg', reportDate: '2026-06-11', returnDueDate: '2026-06-19', processStatus: '반납대기', manager: '이서연' },
  { reportNo: 'SR-4002', itemName: '단백질 바', quantity: '56 kg', reportDate: '2026-06-12', returnDueDate: '2026-06-20', processStatus: '반납완료', manager: '박지훈' },
  { reportNo: 'SR-4003', itemName: '헴프 음료', quantity: '64 kg', reportDate: '2026-06-13', returnDueDate: '2026-06-21', processStatus: '취소', manager: '최유진' },
  { reportNo: 'SR-4004', itemName: '씨드 그래놀라', quantity: '72 kg', reportDate: '2026-06-14', returnDueDate: '2026-06-22', processStatus: '신고접수', manager: '정도윤' },
  { reportNo: 'SR-4005', itemName: '헴프 캡슐', quantity: '80 kg', reportDate: '2026-06-15', returnDueDate: '2026-06-23', processStatus: '반납대기', manager: '한수아' },
]

const PAGE_SIZE = 10

export function SeedReportReturnManagePage() {
  const [filteredSeedReportReturns, setFilteredSeedReportReturns] = useState<SeedReportReturnRow[]>(dummySeedReportReturns)
  const [modalSeedReportReturn, setModalSeedReportReturn] = useState<SeedReportReturnRow | null>(null)
  const [page, setPage] = useState(0)

  const reportNoRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)
  const processStatusRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '신고번호', ref: reportNoRef, name: "equipmentName" },
    { type: 'input', label: '품목명', ref: itemNameRef, name: "equipmentName" },
    { type: 'input', label: '처리상태', ref: processStatusRef, name: "equipmentName" },
    { type: 'input', label: '담당자', ref: managerRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const reportNo = reportNoRef.current?.value.trim() ?? ''
    const itemName = itemNameRef.current?.value.trim() ?? ''
    const processStatus = processStatusRef.current?.value.trim() ?? ''
    const manager = managerRef.current?.value.trim() ?? ''

    // 현재는 더미신고반납에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredSeedReportReturns(
      dummySeedReportReturns.filter(
        (item) =>
          (!reportNo || item.reportNo.includes(reportNo)) &&
          (!itemName || item.itemName.includes(itemName)) &&
          (!processStatus || item.processStatus.includes(processStatus)) &&
          (!manager || item.manager.includes(manager)),
      ),
    )
  }

  const handleReset = () => {
    ;[reportNoRef, itemNameRef, processStatusRef, managerRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredSeedReportReturns(dummySeedReportReturns)
  }

  const handleDelete = (item: SeedReportReturnRow) => {
    if (window.confirm(`${item.reportNo} 신고 건을 삭제할까요?`)) {
      setFilteredSeedReportReturns((prev) => prev.filter((i) => i !== item))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredSeedReportReturns((prev) => prev.map((i) => (i === modalSeedReportReturn ? ({ ...i, ...updated } as SeedReportReturnRow) : i)))
    setModalSeedReportReturn(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredSeedReportReturns])

  const totalPages = Math.max(1, Math.ceil(filteredSeedReportReturns.length / PAGE_SIZE))
  const pagedSeedReportReturns = filteredSeedReportReturns.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<SeedReportReturnRow>[] = useMemo(
    () => [
      { accessorKey: 'reportNo', header: '신고번호' },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'quantity', header: '수량' },
      { accessorKey: 'reportDate', header: '신고일자' },
      { accessorKey: 'returnDueDate', header: '반납예정일' },
      {
        accessorKey: 'processStatus',
        header: '처리상태',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const color = PROCESS_STATUS_COLORS[value]
          return color ? <span style={{ color, fontWeight: 600 }}>{value}</span> : value
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
                setModalSeedReportReturn(row.original)
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
    { label: '신고번호', key: 'reportNo' },
    { label: '품목명', key: 'itemName' },
    { label: '수량', key: 'quantity' },
    { label: '신고일자', key: 'reportDate' },
    { label: '반납예정일', key: 'returnDueDate' },
    { label: '처리상태', key: 'processStatus' },
    { label: '담당자', key: 'manager' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="신고반납관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedSeedReportReturns} columns={columns} onRowClick={setModalSeedReportReturn} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredSeedReportReturns.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalSeedReportReturn !== null}
        onClose={() => setModalSeedReportReturn(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalSeedReportReturn ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
