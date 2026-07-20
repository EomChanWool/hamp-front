import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { AppShell } from '@pages/layout/AppShell'
import { useAuth } from '@/context/AuthContext'

export function MainLayout() {
  const { isAuthenticated, logout } = useAuth()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  // 테마(Theme) 상태 반영
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 1. 비로그인 상태면 로그인 페이지로 즉시 튕겨냅니다.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 2. 테마 토글 및 로그아웃 핸들러
  const handleToggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  const handleLogout = () => {
    logout()
    // 라우터 Navigate 처리가 있으므로 상태 변경 시 자동 튕김이 안 될 경우를 대비해 수동 처리도 가능하지만, 
    // 보통 logout() 내부에서 인증 상태가 false가 되면 이 컴포넌트 상단 조건문에서 걸러집니다.
  }

  return (
    <AppShell
      theme={theme}
      onToggleTheme={handleToggleTheme}
      onLogout={handleLogout}
    >
      {/* 
        AppShell 내부의 {children} 영역으로 
        현재 주소(URL)에 일치하는 서브 페이지 컴포넌트들이 실시간 렌더링됩니다.
      */}
      <Outlet />
    </AppShell>
  )
}

export default MainLayout;