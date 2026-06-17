import type { ReactNode } from 'react'
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
          {menuGroups.map((group) => (
            <section key={group.title} className="navGroup">
              <h2>{group.title}</h2>
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
            </section>
          ))}
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
