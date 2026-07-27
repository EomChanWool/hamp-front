import { useEffect, useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { AppShell } from '@pages/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { setApiNavigator } from '@/api/apiClient'

export function MainLayout() {
  const { isAuthenticated } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const navigate = useNavigate()

  useEffect(() => {
    // 1. 서버 다운 리다이렉트용 네비게이터 주입
    setApiNavigator(
      navigate,
      () => window.location.pathname + window.location.search + window.location.hash
    )

  }, [navigate])

  // 테마(Theme) 상태 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 훅(Hook) 선언부 아래쪽으로 이동하여 리액트 렌더링 규칙 준수
  // 비로그인 상태면 로그인 페이지로 즉시 튕겨냅니다.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 테마 토글 및 로그아웃 핸들러
  const handleToggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  return (
    <AppShell
      theme={theme}
      onToggleTheme={handleToggleTheme}
    >
      <Outlet />
    </AppShell>
  )
}

export default MainLayout;