import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Panel } from '@components/card/Panel'
import { RowDetailModal } from '@components/common/RowDetailModal'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { CusTable } from '@components/table/CusTable'
import { CusPagination } from '@components/table/CusPagination'

interface AccessLog {
  loginAt: string
  userId: string
  name: string
  ip: string
  browser: string
  status: '성공' | '실패'
  logoutAt: string
  note: string
}

const dummyAccessLogs: AccessLog[] = [
  { loginAt: '2026-06-22 07:20', userId: 'user001', name: '김민준', ip: '10.10.1.24', browser: 'Chrome', status: '성공', logoutAt: '2026-06-22 08:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-21 08:20', userId: 'user002', name: '이서연', ip: '10.10.1.25', browser: 'Edge', status: '성공', logoutAt: '2026-06-21 09:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-20 09:20', userId: 'user003', name: '박지훈', ip: '10.10.1.26', browser: 'Whale', status: '성공', logoutAt: '2026-06-20 10:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-19 10:20', userId: 'user004', name: '최유진', ip: '10.10.1.27', browser: 'Chrome', status: '실패', logoutAt: '-', note: '비밀번호 오류' },
  { loginAt: '2026-06-18 11:20', userId: 'user005', name: '정도윤', ip: '10.10.1.28', browser: 'Edge', status: '성공', logoutAt: '2026-06-18 12:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-17 12:20', userId: 'user006', name: '한수아', ip: '10.10.1.29', browser: 'Whale', status: '성공', logoutAt: '2026-06-17 13:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-16 13:20', userId: 'user007', name: '오현우', ip: '10.10.1.30', browser: 'Chrome', status: '성공', logoutAt: '2026-06-16 14:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-15 14:20', userId: 'user008', name: '임하린', ip: '10.10.1.31', browser: 'Edge', status: '성공', logoutAt: '2026-06-15 15:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-14 15:20', userId: 'user009', name: '강태오', ip: '10.10.1.32', browser: 'Whale', status: '성공', logoutAt: '2026-06-14 16:20', note: '정상 로그아웃' },
  { loginAt: '2026-06-22 07:20', userId: 'user010', name: '윤지아', ip: '10.10.1.33', browser: 'Chrome', status: '성공', logoutAt: '2026-06-22 08:20', note: '정상 로그아웃' },
]

const PAGE_SIZE = 10

export function SystemAccessLogsPage() {
  const [filteredLogs, setFilteredLogs] = useState<AccessLog[]>(dummyAccessLogs)
  const [modalLog, setModalLog] = useState<AccessLog | null>(null)
  const [page, setPage] = useState(0)

  const loginStartRef = useRef<HTMLInputElement>(null)
  const loginEndRef = useRef<HTMLInputElement>(null)
  const userIdRef = useRef<HTMLInputElement>(null)
  const statusRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'date', label: '기간', startRef: loginStartRef, endRef: loginEndRef },
    { type: 'input', label: '사용자ID', ref: userIdRef },
    { type: 'input', label: '접속상태', ref: statusRef },
  ]

  const handleSearch = () => {
    const loginStart = loginStartRef.current?.value.trim() ?? ''
    const loginEnd = loginEndRef.current?.value.trim() ?? ''
    const userId = userIdRef.current?.value.trim() ?? ''
    const status = statusRef.current?.value.trim() ?? ''

    // 현재는 더미접속기록에 필터로 걸러내고 있는데 추후에 api 연동할 것
    setFilteredLogs(
      dummyAccessLogs.filter((log) => {
        const loginDate = log.loginAt.slice(0, 10)
        return (
          (!loginStart || loginDate >= loginStart) &&
          (!loginEnd || loginDate <= loginEnd) &&
          (!userId || log.userId.includes(userId)) &&
          (!status || log.status.includes(status))
        )
      }),
    )
  }

  const handleReset = () => {
    ;[loginStartRef, loginEndRef, userIdRef, statusRef].forEach((ref) => {
      if (ref.current) ref.current.value = ''
    })
    setFilteredLogs(dummyAccessLogs)
  }

  const handleDelete = (log: AccessLog) => {
    if (window.confirm(`${log.userId} 접속기록을 삭제할까요?`)) {
      setFilteredLogs((prev) => prev.filter((l) => l !== log))
      window.alert('mock data에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setFilteredLogs((prev) => prev.map((l) => (l === modalLog ? ({ ...l, ...updated } as AccessLog) : l)))
    setModalLog(null)
    window.alert('화면 상태에만 저장되었습니다.')
  }

  // 검색 결과가 바뀌면 페이지를 처음으로 되돌리기
  useEffect(() => {
    setPage(0)
  }, [filteredLogs])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  const pagedLogs = filteredLogs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const columns: ColumnDef<AccessLog>[] = useMemo(
    () => [
      { accessorKey: 'loginAt', header: '접속일시' },
      { accessorKey: 'userId', header: '사용자ID' },
      { accessorKey: 'name', header: '이름' },
      { accessorKey: 'ip', header: 'IP' },
      { accessorKey: 'browser', header: '접속브라우저' },
      { accessorKey: 'status', header: '접속상태' },
      { accessorKey: 'logoutAt', header: '로그아웃일시' },
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
                setModalLog(row.original)
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
    { label: '접속일시', key: 'loginAt' },
    { label: '사용자ID', key: 'userId' },
    { label: '이름', key: 'name' },
    { label: 'IP', key: 'ip' },
    { label: '접속브라우저', key: 'browser' },
    { label: '접속상태', key: 'status' },
    { label: '로그아웃일시', key: 'logoutAt' },
    { label: '비고', key: 'note' },
  ]

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel title="사용자접속기록 목록">
        <CusTable data={pagedLogs} columns={columns} onRowClick={setModalLog} />
        <CusPagination page={page} totalPages={totalPages} totalCount={filteredLogs.length} onPageChange={setPage} />
      </Panel>

      <RowDetailModal
        isOpen={modalLog !== null}
        onClose={() => setModalLog(null)}
        onSave={handleSave}
        fields={detailFields}
        data={(modalLog ?? {}) as unknown as Record<string, string>}
      />
    </section>
  )
}
