import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

// ── [변경] API 서비스 함수 및 타입 가져오기 ──────────────────────────────
import { fetchSystemUsers, deleteSystemUser, updateSystemUser, type SystemUser, type UserSearchParams } from '@/services/system/system'

const PAGE_SIZE = 10

export function SystemUsersPage() {
  // ── [변경] 상태 관리 구조 고도화 ────────────────────────────────────────
  const [users, setUsers] = useState<SystemUser[]>([]) // 서버(더미)에서 받은 원본 데이터
  const [searchParams, setSearchParams] = useState<UserSearchParams>({}) // 현재 검색 조건 상태
  const [isLoading, setIsLoading] = useState(false) // 로딩 상태 추가
  const [modalUser, setModalUser] = useState<SystemUser | null>(null)
  const [page, setPage] = useState(0)

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

  // ── [추가] 데이터 로드 공통 로직 ────────────────────────────────────────
  const loadUsers = async (params: UserSearchParams) => {
    setIsLoading(true)
    try {
      const data = await fetchSystemUsers(params)
      setUsers(data)
      setPage(0) // 검색 조건이 바뀌면 페이지를 첫 페이지로 초기화
    } catch (error) {
      console.error(error)
      window.alert('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  // 컴포넌트 마운트 및 검색 조건 변경 시 실행
  useEffect(() => {
    loadUsers(searchParams)
  }, [searchParams])


  // ── [변경] 핸들러들 API 호출 방식으로 변경 ───────────────────────────────
  const handleSearch = () => {
    const params: UserSearchParams = {
      userId: userIdRef.current?.value.trim(),
      name: nameRef.current?.value.trim(),
      role: roleRef.current?.value.trim(),
      status: statusRef.current?.value.trim(),
    }
    setSearchParams(params) // 상태를 바꾸면 useEffect가 감지하여 로드합니다.
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
        await deleteSystemUser(user.userId)
        window.alert('삭제되었습니다.')
        loadUsers(searchParams) // 삭제 후 목록 리로드
      } catch (err) {
        window.alert('삭제에 실패했습니다.')
      }
    }
  }

  const handleSave = async (updated: Record<string, string>) => {
    if (!modalUser) return
    try {
      await updateSystemUser(modalUser.userId, updated)
      window.alert('저장되었습니다.')
      setModalUser(null)
      loadUsers(searchParams) // 수정 후 목록 리로드
    } catch (err) {
      window.alert('저장에 실패했습니다.')
    }
  }

  // ── [변경] 페이징 계산 대상 변경 ────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
  const pagedUsers = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

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
    [users, searchParams], // 의존성 추가로 상태 업데이트 동기화
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
        {/* 로딩 표시 조건부 렌더링 */}
        {isLoading ? (
          <div className="py-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>
        ) : (
          <>
            <CusTable data={pagedUsers} columns={columns} onRowClick={setModalUser} />
            <CusPagination page={page} totalPages={totalPages} totalCount={users.length} onPageChange={setPage} />
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