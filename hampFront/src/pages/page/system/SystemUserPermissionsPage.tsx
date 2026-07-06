import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { PermissionBoard } from '@components/permission/PermissionBoard'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface PermissionRow {
  roleGroup: string
  description: string
  userCount: string
  view: '허용' | '제한'
  create: '허용' | '제한'
  edit: '허용' | '제한'
  delete: '허용' | '제한'
  approve: '허용' | '제한'
}

const dummyPermissions: PermissionRow[] = [
  { roleGroup: '시스템관리자', description: '시스템관리자 메뉴 접근 권한', userCount: '12명', view: '허용', create: '허용', edit: '허용', delete: '허용', approve: '허용' },
  { roleGroup: '생산관리자', description: '생산관리자 메뉴 접근 권한', userCount: '11명', view: '허용', create: '허용', edit: '허용', delete: '허용', approve: '허용' },
  { roleGroup: '품질관리자', description: '품질관리자 메뉴 접근 권한', userCount: '10명', view: '허용', create: '허용', edit: '허용', delete: '제한', approve: '허용' },
  { roleGroup: '설비관리자', description: '설비관리자 메뉴 접근 권한', userCount: '9명', view: '허용', create: '허용', edit: '허용', delete: '제한', approve: '제한' },
  { roleGroup: '일반작업자', description: '일반작업자 메뉴 접근 권한', userCount: '8명', view: '허용', create: '제한', edit: '제한', delete: '제한', approve: '제한' },
]

const PAGE_SIZE = 10

export function SystemUserPermissionsPage() {
  const [filteredPermissions, setFilteredPermissions] = useState<PermissionRow[]>(dummyPermissions)
  const [modalPermission, setModalPermission] = useState<PermissionRow | null>(null)
  const [page, setPage] = useState(0)

  const roleGroupRef = useRef<HTMLInputElement>(null)
  const userCountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const approveRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '권한그룹', ref: roleGroupRef },
    { type: 'input', label: '사용자ID', ref: userCountRef },
    { type: 'input', label: '메뉴명', ref: descriptionRef },
    { type: 'input', label: '사용여부', ref: approveRef },
  ]

  const handleSearch = () => {
    const roleGroup = roleGroupRef.current?.value.trim() ?? ''
    const userCount = userCountRef.current?.value.trim() ?? ''
    const description = descriptionRef.current?.value.trim() ?? ''
    const approve = approveRef.current?.value.trim() ?? ''

    // 현재는 더미퍼미션에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredPermissions(
      dummyPermissions.filter(
        (permission) =>
          (!roleGroup || permission.roleGroup.includes(roleGroup)) &&
          (!userCount || permission.userCount.includes(userCount)) &&
          (!description || permission.description.includes(description)) &&
          (!approve || permission.approve.includes(approve)),
      ),
    )
  }

  const handleReset = () => {
    ;[roleGroupRef, userCountRef, descriptionRef, approveRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredPermissions(dummyPermissions)
  }

  const handleDelete = (permission: PermissionRow) => {
    if (window.confirm(`${permission.roleGroup} 권한을 삭제할까요?`)) {
      setFilteredPermissions((prev) => prev.filter((p) => p !== permission))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredPermissions((prev) =>
      prev.map((p) => (p === modalPermission ? ({ ...p, ...updated } as PermissionRow) : p)),
    )
    setModalPermission(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredPermissions])

  const totalPages = Math.max(1, Math.ceil(filteredPermissions.length / PAGE_SIZE))
  const pagedPermissions = filteredPermissions.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<PermissionRow>[] = useMemo(
    () => [
      { accessorKey: 'roleGroup', header: '권한그룹' },
      { accessorKey: 'description', header: '설명' },
      { accessorKey: 'userCount', header: '사용자수' },
      { accessorKey: 'view', header: '조회' },
      { accessorKey: 'create', header: '등록' },
      { accessorKey: 'edit', header: '수정' },
      { accessorKey: 'delete', header: '삭제' },
      { accessorKey: 'approve', header: '승인' },
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
                setModalPermission(row.original)
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
    { label: '권한그룹', key: 'roleGroup' },
    { label: '설명', key: 'description' },
    { label: '사용자수', key: 'userCount' },
    { label: '조회', key: 'view' },
    { label: '등록', key: 'create' },
    { label: '수정', key: 'edit' },
    { label: '삭제', key: 'delete' },
    { label: '승인', key: 'approve' },
  ]

  return (
    <section className="screenStack">
      <PermissionBoard />

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="사용자 권한관리 목록">
        <CusTable data={pagedPermissions} columns={columns} onRowClick={setModalPermission} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredPermissions.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalPermission !== null}
        onClose={() => setModalPermission(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalPermission ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
