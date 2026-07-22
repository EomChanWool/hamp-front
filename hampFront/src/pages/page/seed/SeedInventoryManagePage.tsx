import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { paginate } from '@/utils/common'
import { apiClient } from '@/api/apiClient'
import { type SeedInventoryRow, type SeedInventorySearchParams, mockSeedInventory } from '@/types/seed/Seed'

const PROCESS_TYPE_COLORS: Record<string, string> = {
  입고: '#34d399',
  출고: '#fb7185',
  조정: '#94a3b8',
}

export function SeedInventoryManagePage() {
  const [seedInventory, setSeedInventory] = useState<SeedInventoryRow[]>([])
  const [searchParams, setSearchParams] = useState<SeedInventorySearchParams>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalSeedInventory, setModalSeedInventory] = useState<SeedInventoryRow | null>(null)
  const [currentPage, setCurrentPage] = useState(0)


  const processStartRef = useRef<HTMLInputElement>(null)
  const processEndRef = useRef<HTMLInputElement>(null)
  const processTypeRef = useRef<HTMLInputElement>(null)
  const itemNameRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '처리', startRef: processStartRef, endRef: processEndRef },
    { type: 'input', label: '처리구분', ref: processTypeRef },
    { type: 'input', label: '품목명', ref: itemNameRef },
  ]

  const loadSeedInventory = async (params: SeedInventorySearchParams) => {
    setIsLoading(true)
    try {
      // -------------------------------------------------------------
      // [개발용 Mock Mode] 백엔드 연결 후 아래 블록은 삭제/주석 처리하세요.
      await new Promise((resolve) => setTimeout(resolve, 300))
      let filtered = [...mockSeedInventory]
      if (params) {
        filtered = filtered.filter(
          (item) =>
            (!params.startDate || item.processDate >= params.startDate) &&
            (!params.endDate || item.processDate <= params.endDate) &&
            (!params.processType || item.processType.includes(params.processType)) &&
            (!params.itemName || item.itemName.includes(params.itemName)),
        )
      }
      setSeedInventory(filtered)
      // -------------------------------------------------------------

      /*
      // [실제 API 호출 Mode] 백엔드 완공 시 주석 해제하여 사용
      const response = await apiClient.get<SeedInventoryRow[]>('/seed/inventory', { params })
      setSeedInventory(response.data)
      */

      setCurrentPage(0)
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSeedInventory(searchParams)
  }, [searchParams])

  const handleSearch = () => {
    const params: SeedInventorySearchParams = {
      startDate: processStartRef.current?.value || undefined,
      endDate: processEndRef.current?.value || undefined,
      processType: processTypeRef.current?.value.trim() || undefined,
      itemName: itemNameRef.current?.value.trim() || undefined,
    }
    setSearchParams(params)
  }

  const handleReset = () => {
    if (processStartRef.current) processStartRef.current.value = ''
    if (processEndRef.current) processEndRef.current.value = ''
      ;[processTypeRef, itemNameRef].forEach((ref) => {
        if (ref.current) ref.current.value = ''
      })
    setSearchParams({})
  }

  const handleDelete = async (item: SeedInventoryRow) => {
    if (window.confirm(`${item.processDate} ${item.itemName} 내역을 삭제할까요?`)) {
      try {
        // [개발용 Mock Mode]
        setSeedInventory((prev) => prev.filter((i) => i.id !== item.id))

        /*
        // [실제 API 호출 Mode]
        await apiClient.delete(`/seed/inventory/${item.id}`)
        loadSeedInventory(searchParams) // 삭제 후 re-fetch
        */

        window.alert('삭제되었습니다.')
      } catch (err) {
        console.error(err)
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalSeedInventory) return
    try {
      // [개발용 Mock Mode]
      setSeedInventory((prev) =>
        prev.map((i) => (i.id === modalSeedInventory.id ? { ...i, ...updated } : i)),
      )

      /*
      // [실제 API 호출 Mode]
      await apiClient.put(`/seed/inventory/${modalSeedInventory.id}`, updated)
      loadSeedInventory(searchParams) // 수정 후 re-fetch
      */

      window.alert('저장되었습니다.')
      setModalSeedInventory(null)
    } catch (err) {
      console.error(err)
      window.alert('저장에 실패했습니다.')
    }
  }

  const { totalPages, pagedData } = paginate(seedInventory, currentPage);
  

  const columns: ColumnDef<SeedInventoryRow>[] = useMemo(
    () => [
      { accessorKey: 'processDate', header: '처리일자' },
      {
        accessorKey: 'processType',
        header: '처리구분',
        cell: ({ getValue }) => {
          const value = getValue() as string
          const color = PROCESS_TYPE_COLORS[value]
          return color ? <span style={{ color, fontWeight: 600 }}>{value}</span> : value
        },
      },
      { accessorKey: 'itemName', header: '품목명' },
      { accessorKey: 'quantity', header: '수량' },
      { accessorKey: 'unit', header: '단위' },
      { accessorKey: 'manager', header: '담당자' },
      { accessorKey: 'note', header: '비고' },
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
                setModalSeedInventory(row.original)
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
    [seedInventory, searchParams],
  )

  const detailFields = [
    { label: '처리일자', key: 'processDate' },
    { label: '처리구분', key: 'processType' },
    { label: '품목명', key: 'itemName' },
    { label: '수량', key: 'quantity' },
    { label: '단위', key: 'unit' },
    { label: '담당자', key: 'manager' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="씨드 재고관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedData} columns={columns} onRowClick={setModalSeedInventory} />
            <CusPagination page={currentPage} totalPages={totalPages} totalCount={seedInventory.length} onPageChange={setCurrentPage} />
          </>
        )}
      </Panel>

      <RowDetailModal
        isOpen={modalSeedInventory !== null}
        onClose={() => setModalSeedInventory(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalSeedInventory ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}