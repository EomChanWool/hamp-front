import { useEffect, useRef, useState } from 'react'
import { PermissionBoard } from '@components/permission/PermissionBoard'
import { SearchBand, type SearchField } from '@components/search/SearchBand'
import { apiClient } from '@/api/apiClient'
import type { AuthGroupResponse, ApiResponseListAuthGroupResponse } from '@/types/auth/Auth'


export function SystemUserPermissionsPage() {
  const [authGroups, setAuthGroups] = useState<AuthGroupResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [modalPermission, setModalPermission] = useState<AuthGroupResponse | null>(null)
  const [page, setPage] = useState(0)

  const [searchParams, setSearchParams] = useState<Record<string, string>>({})

  // 검색 필드 Ref (권한그룹명, 권한ID)
  const authNmRef = useRef<HTMLInputElement>(null)
  const authIdRef = useRef<HTMLInputElement>(null)

  const searchFields: SearchField[] = [
    { type: 'input', label: '권한그룹명', ref: authNmRef },
    { type: 'input', label: '권한ID', ref: authIdRef },
  ]

  // GET /auth-groups 목록 조회 API 함수 (params 매개변수 추가 및 공백 제거)
  const fetchAuthGroups = async (params: Record<string, string> = {}) => {
    setIsLoading(true)
    try {
      const cleanedParams = Object.entries(params).reduce(
        (acc, [key, value]) => {
          if (value && value.trim() !== '') acc[key] = value.trim()
          return acc
        },
        {} as Record<string, string>,
      )

      const response = await apiClient.get<ApiResponseListAuthGroupResponse>('/auth-groups', {
        params: cleanedParams,
      })
      setAuthGroups(response.data.data ?? [])
    } catch (error) {
      console.error('권한 그룹 목록 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAuthGroups(searchParams)
  }, [searchParams])

  const handleSearch = () => {
    const params: Record<string, string> = {}
    if (authNmRef.current?.value.trim()) params.authNm = authNmRef.current.value.trim()
    if (authIdRef.current?.value.trim()) params.authId = authIdRef.current.value.trim()

    setPage(0)
    setSearchParams(params)
  }

  const handleReset = () => {
    if (authNmRef.current) authNmRef.current.value = ''
    if (authIdRef.current) authIdRef.current.value = ''
    setPage(0)
    setSearchParams({})
  }

  const handleDelete = (permission: AuthGroupResponse) => {
    if (window.confirm(`${permission.authNm}(${permission.authId}) 권한을 삭제할까요?`)) {
      setAuthGroups((prev) => prev.filter((p) => p.authId !== permission.authId))
      window.alert('DELETE API 미구현으로 화면 상태에서만 삭제되었습니다.')
    }
  }

  const handleSave = (updated: Record<string, string>) => {
    setAuthGroups((prev) =>
      prev.map((p) => (p === modalPermission ? ({ ...p, ...updated } as AuthGroupResponse) : p)),
    )
    setModalPermission(null)
    window.alert('PUT API 미구현으로 화면 상태에만 저장되었습니다.')
  }

  useEffect(() => {
    setPage(0)
  }, [authGroups])


  return (
    <section className="screenStack">

      <SearchBand fields={searchFields} onSearch={handleSearch} onReset={handleReset} />

      <PermissionBoard />


    </section>
  )
}