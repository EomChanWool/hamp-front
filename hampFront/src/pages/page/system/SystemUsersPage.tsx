import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@components/common/Badge'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface SystemUser {
  userId: string
  name: string
  department: string
  position: string
  role: string
  status: '사용' | '미사용'
  lastLoginAt: string
}

const dummyUsers: SystemUser[] = [
  { userId: 'user001', name: '김민준', department: '생산팀', position: '팀장', role: '시스템관리자', status: '사용', lastLoginAt: '2026-06-22 08:20' },
  { userId: 'user002', name: '이서연', department: '품질팀', position: '매니저', role: '생산관리자', status: '사용', lastLoginAt: '2026-06-21 09:20' },
  { userId: 'user003', name: '박지훈', department: '설비팀', position: '작업자', role: '품질관리자', status: '사용', lastLoginAt: '2026-06-20 10:20' },
  { userId: 'user004', name: '최유진', department: '시스템팀', position: '관리자', role: '설비관리자', status: '사용', lastLoginAt: '2026-06-19 11:20' },
  { userId: 'user005', name: '정도윤', department: '생산팀', position: '팀장', role: '일반작업자', status: '사용', lastLoginAt: '2026-06-18 12:20' },
  { userId: 'user006', name: '한수아', department: '품질팀', position: '매니저', role: '시스템관리자', status: '사용', lastLoginAt: '2026-06-17 13:20' },
  { userId: 'user007', name: '오현우', department: '설비팀', position: '작업자', role: '생산관리자', status: '사용', lastLoginAt: '2026-06-16 14:20' },
  { userId: 'user008', name: '임하린', department: '시스템팀', position: '관리자', role: '품질관리자', status: '사용', lastLoginAt: '2026-06-15 15:20' },
  { userId: 'user009', name: '강태오', department: '생산팀', position: '팀장', role: '설비관리자', status: '미사용', lastLoginAt: '2026-06-14 16:20' },
  { userId: 'user010', name: '윤지아', department: '품질팀', position: '매니저', role: '일반작업자', status: '사용', lastLoginAt: '2026-06-22 08:20' },
  { userId: 'user011', name: '서준호', department: '설비팀', position: '작업자', role: '시스템관리자', status: '사용', lastLoginAt: '2026-06-21 09:20' },
  { userId: 'user012', name: '문채원', department: '시스템팀', position: '관리자', role: '생산관리자', status: '사용', lastLoginAt: '2026-06-20 10:20' },
]

const PAGE_SIZE = 10

export function SystemUsersPage() {
  const [filteredUsers, setFilteredUsers] = useState<SystemUser[]>(dummyUsers)
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

  const handleSearch = () => {
    const userId = userIdRef.current?.value.trim() ?? ''
    const name = nameRef.current?.value.trim() ?? ''
    const role = roleRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미유저즈에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredUsers(
      dummyUsers.filter(
        (user) =>
          (!userId || user.userId.includes(userId)) &&
          (!name || user.name.includes(name)) &&
          (!role || user.role.includes(role)) &&
          (!status || user.status.includes(status)),
      ),
    )
  }

  const handleReset = () => {
    ;[userIdRef, nameRef, roleRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredUsers(dummyUsers)
  }

  const handleDelete = (user: SystemUser) => {
    if (window.confirm(`${user.userId} 계정을 삭제할까요?`)) {
      setFilteredUsers((prev) => prev.filter((u) => u !== user))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredUsers((prev) => prev.map((u) => (u === modalUser ? ({ ...u, ...updated } as SystemUser) : u)))
    setModalUser(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredUsers])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pagedUsers = filteredUsers.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

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
    [],
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
        <CusTable data={pagedUsers} columns={columns} onRowClick={setModalUser} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredUsers.length} onPageChange={setPage} />
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
