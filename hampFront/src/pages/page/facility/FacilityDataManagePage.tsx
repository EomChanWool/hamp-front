import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface FacilityData {
  dataId: string
  dataType: string
  equipmentName: string
  collectionInterval: string
  lastCollectedAt: string
  useYn: string
  manager: string
}

const dummyFacilityData: FacilityData[] = [
  { dataId: 'DATA-100', dataType: '출입로그', equipmentName: '추출기-01', collectionInterval: '1초', lastCollectedAt: '2026-06-22 13:20', useYn: '사용', manager: '김민준' },
  { dataId: 'DATA-101', dataType: '환경센서', equipmentName: '건조기-02', collectionInterval: '10초', lastCollectedAt: '2026-06-21 14:20', useYn: '사용', manager: '이서연' },
  { dataId: 'DATA-102', dataType: 'CCTV이벤트', equipmentName: '세척기-03', collectionInterval: '1분', lastCollectedAt: '2026-06-20 15:20', useYn: '사용', manager: '박지훈' },
  { dataId: 'DATA-103', dataType: '설비상태', equipmentName: '분쇄기-01', collectionInterval: '5분', lastCollectedAt: '2026-06-19 16:20', useYn: '사용', manager: '최유진' },
  { dataId: 'DATA-104', dataType: '알림데이터', equipmentName: '포장기-04', collectionInterval: '1초', lastCollectedAt: '2026-06-18 17:20', useYn: '사용', manager: '정도윤' },
  { dataId: 'DATA-105', dataType: '품질데이터', equipmentName: '압축기-02', collectionInterval: '10초', lastCollectedAt: '2026-06-17 18:20', useYn: '미사용', manager: '한수아' },
]

const PAGE_SIZE = 10

export function FacilityDataManagePage() {
  const [filteredData, setFilteredData] = useState<FacilityData[]>(dummyFacilityData)
  const [modalData, setModalData] = useState<FacilityData | null>(null)
  const [page, setPage] = useState(0)

  const dataTypeRef = useRef<HTMLInputElement>(null)
  const equipmentNameRef = useRef<HTMLInputElement>(null)
  const useYnRef = useRef<HTMLInputElement>(null)
  const collectionIntervalRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '데이터유형', ref: dataTypeRef, name: "equipmentName" },
    { type: 'input', label: '수집장비', ref: equipmentNameRef, name: "equipmentName" },
    { type: 'input', label: '사용여부', ref: useYnRef, name: "equipmentName" },
    { type: 'input', label: '수집주기', ref: collectionIntervalRef, name: "equipmentName" },
  ]

  const handleSearch = () => {
    const dataType = dataTypeRef.current?.value.trim() ?? ''
    const equipmentName = equipmentNameRef.current?.value.trim() ?? ''
    const useYn = useYnRef.current?.value.trim() ?? ''
    const collectionInterval = collectionIntervalRef.current?.value.trim() ?? ''

    // 현재는 더미데이터에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredData(
      dummyFacilityData.filter(
        (data) =>
          (!dataType || data.dataType.includes(dataType)) &&
          (!equipmentName || data.equipmentName.includes(equipmentName)) &&
          (!useYn || data.useYn.includes(useYn)) &&
          (!collectionInterval || data.collectionInterval.includes(collectionInterval)),
      ),
    )
  }

  const handleReset = () => {
    ;[dataTypeRef, equipmentNameRef, useYnRef, collectionIntervalRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredData(dummyFacilityData)
  }

  const handleDelete = (data: FacilityData) => {
    if (window.confirm(`${data.dataId} 데이터를 삭제할까요?`)) {
      setFilteredData((prev) => prev.filter((d) => d !== data))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredData((prev) => prev.map((d) => (d === modalData ? ({ ...d, ...updated } as FacilityData) : d)))
    setModalData(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredData])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE))
  const pagedData = filteredData.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<FacilityData>[] = useMemo(
    () => [
      { accessorKey: 'dataId', header: '데이터ID' },
      { accessorKey: 'dataType', header: '데이터유형' },
      { accessorKey: 'equipmentName', header: '수집장비' },
      { accessorKey: 'collectionInterval', header: '수집주기' },
      { accessorKey: 'lastCollectedAt', header: '최종수집일시' },
      {
        accessorKey: 'useYn',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'danger'}>{getValue() as string}</Badge>,
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
                setModalData(row.original)
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
    { label: '데이터ID', key: 'dataId' },
    { label: '데이터유형', key: 'dataType' },
    { label: '수집장비', key: 'equipmentName' },
    { label: '수집주기', key: 'collectionInterval' },
    { label: '최종수집일시', key: 'lastCollectedAt' },
    { label: '사용여부', key: 'useYn' },
    { label: '담당자', key: 'manager' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="데이터 관리 목록" action="등록" onAction={() => window.alert('mock 동작입니다.')}>
        <CusTable data={pagedData} columns={columns} onRowClick={setModalData} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredData.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalData !== null}
        onClose={() => setModalData(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalData ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
