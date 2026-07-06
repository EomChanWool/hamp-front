import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface ItemRow {
  code: string
  name: string
  category: string
  unit: string
  spec: string
  status: '사용' | '미사용'
  safetyStock: string
}

const dummyItems: ItemRow[] = [
  { code: 'ITEM-1000', name: '헴프 오일', category: '원료', unit: 'kg', spec: '10kg/box', status: '사용', safetyStock: '200' },
  { code: 'ITEM-1001', name: '헴프 분말', category: '반제품', unit: 'kg', spec: '11kg/box', status: '사용', safetyStock: '220' },
  { code: 'ITEM-1002', name: '단백질 바', category: '완제품', unit: 'kg', spec: '12kg/box', status: '사용', safetyStock: '240' },
  { code: 'ITEM-1003', name: '헴프 음료', category: '원료', unit: 'kg', spec: '13kg/box', status: '사용', safetyStock: '260' },
  { code: 'ITEM-1004', name: '씨드 그래놀라', category: '반제품', unit: 'kg', spec: '14kg/box', status: '사용', safetyStock: '280' },
  { code: 'ITEM-1005', name: '헴프 캡슐', category: '완제품', unit: 'kg', spec: '15kg/box', status: '사용', safetyStock: '300' },
  { code: 'ITEM-1006', name: '인피 원면', category: '원료', unit: 'kg', spec: '16kg/box', status: '사용', safetyStock: '320' },
  { code: 'ITEM-1007', name: '인피 섬유', category: '반제품', unit: 'kg', spec: '17kg/box', status: '미사용', safetyStock: '340' },
]

const PAGE_SIZE = 10

export function MasterItemsPage() {
  const [filteredItems, setFilteredItems] = useState<ItemRow[]>(dummyItems)
  const [modalItem, setModalItem] = useState<ItemRow | null>(null)
  const [page, setPage] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '품목코드', ref: codeRef },
    { type: 'input', label: '품목명', ref: nameRef },
    { type: 'input', label: '품목구분', ref: categoryRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const handleSearch = () => {
    const code = codeRef.current?.value.trim() ?? ''
    const name = nameRef.current?.value.trim() ?? ''
    const category = categoryRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미품목에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredItems(
      dummyItems.filter(
        (item) =>
          (!code || item.code.includes(code)) &&
          (!name || item.name.includes(name)) &&
          (!category || item.category.includes(category)) &&
          (!status || item.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[codeRef, nameRef, categoryRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredItems(dummyItems)
  }

  const handleDelete = (item: ItemRow) => {
    if (window.confirm(`${item.code} 품목을 삭제할까요?`)) {
      setFilteredItems((prev) => prev.filter((i) => i !== item))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredItems((prev) => prev.map((i) => (i === modalItem ? ({ ...i, ...updated } as ItemRow) : i)))
    setModalItem(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredItems])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const pagedItems = filteredItems.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<ItemRow>[] = useMemo(
    () => [
      { accessorKey: 'code', header: '품목코드' },
      { accessorKey: 'name', header: '품목명' },
      { accessorKey: 'category', header: '품목구분' },
      { accessorKey: 'unit', header: '단위' },
      { accessorKey: 'spec', header: '규격' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'safetyStock', header: '안전재고' },
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
                setModalItem(row.original)
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
    { label: '품목코드', key: 'code' },
    { label: '품목명', key: 'name' },
    { label: '품목구분', key: 'category' },
    { label: '단위', key: 'unit' },
    { label: '규격', key: 'spec' },
    { label: '사용여부', key: 'status' },
    { label: '안전재고', key: 'safetyStock' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="품목관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        <CusTable data={pagedItems} columns={columns} onRowClick={setModalItem} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredItems.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalItem !== null}
        onClose={() => setModalItem(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalItem ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
