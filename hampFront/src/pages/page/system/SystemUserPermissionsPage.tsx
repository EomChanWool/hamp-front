import { useRef, useState } from 'react'
import { PermissionBoard } from '@components/permission/PermissionBoard'
import { SearchBand, type SearchField } from '@components/search/SearchBand'


export function SystemUserPermissionsPage() {
  const [searchParams, setSearchParams] = useState<Record<string, string>>({})

  // 검색 필드 Ref (권한그룹명, 권한ID)
  const authNmRef = useRef<HTMLInputElement>(null)
  const authIdRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '권한그룹명', ref: authNmRef },
    { type: 'input', label: '권한ID', ref: authIdRef },
  ]

   const handleSearch = () => {
    const params: Record<string, string> = {}
    if (authNmRef.current?.value.trim()) params.authNm = authNmRef.current.value.trim()
    if (authIdRef.current?.value.trim()) params.authId = authIdRef.current.value.trim()
    setSearchParams(params)
  }

  const handleReset = () => {
    if (authNmRef.current) authNmRef.current.value = ''
    if (authIdRef.current) authIdRef.current.value = ''
    setSearchParams({})
  }

  return (
    <section className="screenStack">
      {/* 검색 영역 */}
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      {/* 권한 매트릭스 보드 (내부에서 API 조회, 탭 관리, 수정/저장 처리 모두 수행) */}
      <PermissionBoard searchParams={searchParams} />
    </section>
  )
}