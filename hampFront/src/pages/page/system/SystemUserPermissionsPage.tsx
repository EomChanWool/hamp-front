import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PermissionBoard } from '@components/permission/PermissionBoard'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { Panel } from '@/components/card/Panel'

export function SystemUserPermissionsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 검색 필드 Ref
  const authNmRef = useRef<HTMLInputElement>(null)
  const authIdRef = useRef<HTMLInputElement>(null)

  // URL에서 쿼리 값 추출
  const queryAuthNm = searchParams.get("authNm") || "";
  const queryAuthId = searchParams.get("authId") || "";

  // URL 파라미터가 변경될 때마다 input의 값을 동기화 (타이밍 이슈 방지)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authNmRef.current) authNmRef.current.value = queryAuthNm;
      if (authIdRef.current) authIdRef.current.value = queryAuthId;
    }, 0);
    return () => clearTimeout(timer);
  }, [queryAuthNm, queryAuthId]);

  const searchFields: SearchField[] = [
    { type: 'input', label: '권한그룹명', ref: authNmRef },
    { type: 'input', label: '권한ID', ref: authIdRef },
  ]

  const handleSearch = () => {
    const nextParams: Record<string, string> = {}
    const authNm = authNmRef.current?.value.trim()
    const authId = authIdRef.current?.value.trim()
    
    if (authNm) nextParams.authNm = authNm
    if (authId) nextParams.authId = authId
    
    setSearchParams(nextParams)
  }

  const handleReset = () => {
    if (authNmRef.current) authNmRef.current.value = ''
    if (authIdRef.current) authIdRef.current.value = ''
    setSearchParams({})
  }

  return (
    <section className="screenStack">
      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <Panel
        title="사용자 권한관리 목록"
        action="등록"
        onAction={() => {
          const queryStr = searchParams.toString();
          navigate(queryStr ? `/system/auths/create?${queryStr}` : "/system/auths/create");
        }}
      >
        {/* URL 객체 자체를 넘기거나, 필요한 경우 Object로 변환하여 전달 */}
        <PermissionBoard searchParams={Object.fromEntries(searchParams.entries())} />
      </Panel>
    </section>
  )
}