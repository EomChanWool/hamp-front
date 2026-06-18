import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { menuGroups } from '../data/navigation'
import type { ScreenKey } from '../types'

type AppShellProps = {
  activeScreen: ScreenKey
  activeGroup: string
  activeTitle: string
  onScreenChange: (screen: ScreenKey) => void
  onLogout: () => void
  children: ReactNode
}

export function AppShell({
  activeScreen,
  activeGroup,
  activeTitle,
  onScreenChange,
  onLogout,
  children,
}: AppShellProps) {
  const activeGroupTitle = useMemo(
    () => menuGroups.find((group) => group.items.some((item) => item.key === activeScreen))?.title,
    [activeScreen],
  )
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroupTitle ? [activeGroupTitle] : []))

  useEffect(() => {
    if (!activeGroupTitle) return
    setOpenGroups((current) => {
      const next = new Set(current)
      next.add(activeGroupTitle)
      return next
    })
  }, [activeGroupTitle])

  const toggleGroup = (title: string) => {
    setOpenGroups((current) => {
      const next = new Set(current)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">H</span>
          <div>
            <strong>HEMP-MES</strong>
            <small>Production Control</small>
          </div>
        </div>

        <nav className="navMenu" aria-label="주 메뉴">
          {menuGroups.map((group) => {
            const isOpen = openGroups.has(group.title)
            const hasActiveItem = group.items.some((item) => item.key === activeScreen)

            return (
              <section key={group.title} className={`navGroup ${hasActiveItem ? 'current' : ''}`}>
                <button
                  type="button"
                  className="navGroupHeader"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.title)}
                >
                  <span>{group.title}</span>
                  <strong>{isOpen ? '−' : '+'}</strong>
                </button>
                {isOpen && (
                  <div className="navItems">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        className={activeScreen === item.key ? 'active' : ''}
                        type="button"
                        onClick={() => onScreenChange(item.key)}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="breadcrumb">{activeGroup}</span>
            <h1>{activeTitle}</h1>
          </div>
          <div className="topActions">
            <button type="button" className="iconButton" aria-label="알림">
              !
            </button>
            <div className="userBadge">
              <span>관리자</span>
              <strong>admin</strong>
            </div>
            <button type="button" className="ghostButton" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </header>

        {children}
      </main>
    </div>
  )
}
