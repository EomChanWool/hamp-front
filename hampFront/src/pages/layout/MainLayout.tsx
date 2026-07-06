import { useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@pages/layout/AppShell'
import { useAuth } from '@/context/AuthContext'
import { defaultScreen, menuRoutes } from '@/router'
import type { ScreenKey } from '@/types'

export function MainLayout() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [theme, setTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // menuRoutes/defaultScreen은 router와 순환 참조 관계이므로,
  // 모듈 최상위가 아니라 렌더 시점(컴포넌트 본문)에서만 사용한다.
  const screenKeys = useMemo(
    () => new Set<ScreenKey>([defaultScreen, ...menuRoutes.flatMap((group) => group.items.map((item) => item.key))]),
    [],
  )
  const screenLabels = useMemo(
    () =>
      new Map<ScreenKey, string>([
        [defaultScreen, '메인 대시보드'],
        ...menuRoutes.flatMap((group) => group.items.map((item) => [item.key, item.label] as const)),
      ]),
    [],
  )

  const activeScreen = useMemo(() => {
    const key = location.pathname === '/' ? defaultScreen : location.pathname.replace(/^\//, '')
    return screenKeys.has(key as ScreenKey) ? (key as ScreenKey) : defaultScreen
  }, [location.pathname, screenKeys])

  const activeTitle = screenLabels.get(activeScreen) ?? ''
  const activeGroup = useMemo(
    () => menuRoutes.find((group) => group.items.some((item) => item.key === activeScreen))?.title ?? '시스템관리',
    [activeScreen],
  )

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const handleScreenChange = (screen: ScreenKey) => {
    navigate(screen === defaultScreen ? '/' : `/${screen}`)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AppShell
      activeScreen={activeScreen}
      activeGroup={activeGroup}
      activeTitle={activeTitle}
      theme={theme}
      onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
      onScreenChange={handleScreenChange}
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  )
}
