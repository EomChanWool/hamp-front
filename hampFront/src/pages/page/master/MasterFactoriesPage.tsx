import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

import { fetchFactories, deleteFactories, updateFactories, type FactoryRow, type FactorySearchParams } from '@/services/master/MasterFactoriesPage'


const PAGE_SIZE = 10

export function MasterFactoriesPage() {
  const [factories, setFactories] = useState<FactoryRow[]>([])
  const [searchParams, setSearchParams] = useState<FactorySearchParams>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalFactory, setModalFactory] = useState<FactoryRow | null>(null)
  const [page, setPage] = useState(0)

  const codeRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const managerRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '공장코드', ref: codeRef },
    { type: 'input', label: '공장명', ref: nameRef },
    { type: 'input', label: '담당자', ref: managerRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const loadFactories = async (params: FactorySearchParams) => {
    setIsLoading(true)
    try {
      const data = await fetchFactories(params)
      setFactories(data)
      setPage(0)
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadFactories(searchParams)
  }, [searchParams])

  const handleSearch = () => {
    const params: FactorySearchParams = {
      code: codeRef.current?.value.trim(),
      name: nameRef.current?.value.trim(),
      manager: managerRef.current?.value.trim(),
      status: statusRef.current?.value.trim(),
    }
    setSearchParams(params)
  }

  const handleReset = () => {
    ;[codeRef, nameRef, managerRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setSearchParams({})
  }

  const handleDelete = async (factory: FactoryRow) => {
    if (window.confirm(`${factory.code} 공장을 삭제할까요?`)) {
      try {
        await deleteFactories(factory.code)
        window.alert('삭제되었습니다.')
        loadFactories(searchParams)
      } catch (err) {
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalFactory) return
    try {
      await updateFactories(modalFactory.code, updated)
      window.alert('저장되었습니다.')
      setModalFactory(null)
      loadFactories(searchParams) // 수정 후 목록 리로드
    } catch (err) {
      window.alert('저장에 실패했습니다.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(factories.length / PAGE_SIZE))
  const pagedFactories = factories.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<FactoryRow>[] = useMemo(
    () => [
      { accessorKey: 'code', header: '공장코드' },
      { accessorKey: 'name', header: '공장명' },
      { accessorKey: 'location', header: '위치' },
      { accessorKey: 'manager', header: '담당자' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'registeredAt', header: '등록일자' },
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
                setModalFactory(row.original)
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
    { label: '공장코드', key: 'code' },
    { label: '공장명', key: 'name' },
    { label: '위치', key: 'location' },
    { label: '담당자', key: 'manager' },
    { label: '사용여부', key: 'status' },
    { label: '등록일자', key: 'registeredAt' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="공장관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>

        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedFactories} columns={columns} onRowClick={setModalFactory} />
            <CusPagination page={page} totalPages={totalPages} totalCount={factories.length} onPageChange={setPage} />
          </>
        )}
      </Panel>

      <RowDetailModal
        isOpen={modalFactory !== null}
        onClose={() => setModalFactory(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalFactory ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
