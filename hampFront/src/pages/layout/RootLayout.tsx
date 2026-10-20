import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { setApiNavigator } from '@/api/apiClient'

/**
 * 모든 라우트(로그인/태블릿/에러 페이지 포함)의 최상위에서
 * apiClient 에 navigate 를 등록
 */
export function RootLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const pathRef = useRef('')

  pathRef.current = location.pathname + location.search + location.hash

  useEffect(() => {
    setApiNavigator(navigate, () => pathRef.current)
  }, [navigate])

  return <Outlet />
}
