import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'
import { apiClient } from '@/api/apiClient'
import { paginate } from '@/utils/common'
import { type SystemUser, type UserSearchParams, mockUsers } from '@/types/system/System'

export function SystemUsersPage() {
  const [users, setUsers] = useState<SystemUser[]>([])
  const [searchParams, setSearchParams] = useState<UserSearchParams>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalUser, setModalUser] = useState<SystemUser | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const userIdRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const roleRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '사용자ID', ref: userIdRef },
    { type: 'input', label: '이름', ref: nameRef },
    { type: 'input', label: '권한', ref: roleRef },
    { type: 'input', label: '사용여부', ref: statusRef },
  ]

  const loadUsers = async (params: UserSearchParams) => {
    setIsLoading(true)
    try {
      // -------------------------------------------------------------
      // [개발용 Mock Mode] 백엔드 연결 후 아래 블록은 삭제/주석 처리하세요.
      await new Promise((resolve) => setTimeout(resolve, 300))
      let filtered = [...mockUsers]
      if (params) {
        filtered = filtered.filter(
          (user) =>
            (!params.userId || user.userId.includes(params.userId)) &&
            (!params.name || user.name.includes(params.name)) &&
            (!params.role || user.role.includes(params.role)) &&
            (!params.status || user.status.includes(params.status)),
        )
      }
      setUsers(filtered)
      // -------------------------------------------------------------

      /*
      // [실제 API 호출 Mode] 백엔드 완공 시 주석 해제하여 사용
      const response = await apiClient.get<SystemUser[]>('/system/users', { params })
      setUsers(response.data)
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
    loadUsers(searchParams)
  }, [searchParams])

  const handleSearch = () => {
    const params: UserSearchParams = {
      userId: userIdRef.current?.value.trim(),
      name: nameRef.current?.value.trim(),
      role: roleRef.current?.value.trim(),
      status: statusRef.current?.value.trim(),
    }
    setSearchParams(params)
  }

  const handleReset = () => {
    ;[userIdRef, nameRef, roleRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setSearchParams({})
  }

  const handleDelete = async (user: SystemUser) => {
    if (window.confirm(`${user.userId} 계정을 삭제할까요?`)) {
      try {
        // [개발용 Mock Mode]
        setUsers((prev) => prev.filter((u) => u.userId !== user.userId))

        /*
        // [실제 API 호출 Mode]
        await apiClient.delete(`/system/users/${user.userId}`)
        loadUsers(searchParams) // 삭제 후 re-fetch
        */

        window.alert('삭제되었습니다.')
      } catch (err) {
        console.error(err)
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalUser) return
    try {
      // [개발용 Mock Mode]
      setUsers((prev) =>
        prev.map((u) => (u.userId === modalUser.userId ? { ...u, ...updated } : u)),
      )

      /*
      // [실제 API 호출 Mode]
      await apiClient.put(`/system/users/${modalUser.userId}`, updated)
      loadUsers(searchParams) // 수정 후 re-fetch
      */

      window.alert('저장되었습니다.')
      setModalUser(null)
    } catch (err) {
      console.error(err)
      window.alert('저장에 실패했습니다.')
    }
  }

  const { totalPages, pagedData } = paginate(users, currentPage);


  const columns: ColumnDef<SystemUser>[] = useMemo(
    () => [
      { accessorKey: 'userId', header: '사용자ID' },
      { accessorKey: 'name', header: '이름' },
      { accessorKey: 'department', header: '부서' },
      { accessorKey: 'position', header: '직책' },
      { accessorKey: 'role', header: '권한' },
      {
        accessorKey: 'status',
        header: '사용여부',
        cell: ({ getValue }) => <Badge tone={getValue() === '사용' ? 'good' : 'muted'}>{getValue() as string}</Badge>,
      },
      { accessorKey: 'lastLoginAt', header: '최근접속일시' },
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
                setModalUser(row.original)
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
    [users, searchParams],
  )

  const detailFields = [
    { label: '사용자ID', key: 'userId' },
    { label: '이름', key: 'name' },
    { label: '부서', key: 'department' },
    { label: '직책', key: 'position' },
    { label: '권한', key: 'role' },
    { label: '사용여부', key: 'status' },
    { label: '최근접속일시', key: 'lastLoginAt' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="사용자관리 목록" action="등록" onAction={() => window.alert('등록 기능은 API 연동 후 사용 가능합니다.')}>
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedData} columns={columns} onRowClick={setModalUser} />
            <CusPagination page={currentPage} totalPages={totalPages} totalCount={users.length} onPageChange={setCurrentPage} />
          </>
        )}
      </Panel>

      <RowDetailModal
        isOpen={modalUser !== null}
        onClose={() => setModalUser(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalUser ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}