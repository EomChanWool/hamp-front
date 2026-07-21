import { useEffect, useState } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { AppShell } from '@pages/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { setApiNavigator, setLogoutCallback } from '@/api/apiClient'

export function MainLayout() {
  const { isAuthenticated, logout } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const navigate = useNavigate()

  useEffect(() => {
    // 1. 서버 다운 리다이렉트용 네비게이터 주입
    setApiNavigator(
      navigate,
      () => window.location.pathname + window.location.search + window.location.hash
    )

    // 2. 401 Unauthorized 에러 발생 시 자동 로그아웃 콜백 주입
    setLogoutCallback(() => {
      logout() // AuthContext의 로그아웃 로직 실행 (토큰 제거 및 isAuthenticated false 전환)
      // 아래의 if (!isAuthenticated) 조건문이 작동하면서 로그인 페이지로 튕겨 나갑니다.
    })
  }, [navigate, logout])

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

  const handleLogout = () => {
    logout()
  }

  return (
    <AppShell
      theme={theme}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  )
}

export default MainLayout;