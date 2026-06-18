import { useEffect, useMemo, useState, type ReactNode } from "react";
import { menuGroups } from "../data/navigation";
import type { ScreenKey } from "../types";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/24/outline";

type AppShellProps = {
  activeScreen: ScreenKey;
  activeGroup: string;
  activeTitle: string;
  onScreenChange: (screen: ScreenKey) => void;
  onLogout: () => void;
  children: ReactNode;
};

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
  );
  const [openGroup, setOpenGroup] = useState<string | null>(activeGroupTitle ?? null);

  useEffect(() => {
    if (activeGroupTitle) {
      setOpenGroup(activeGroupTitle);
    }
  }, [activeGroupTitle]);

  const toggleGroup = (title: string) => {
    setOpenGroup((current) => (current === title ? null : title));
  };

  //메뉴 접고 펴기
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`appShell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">H</div>

          {!collapsed && (
            <div>
              <strong>HEMP-MES</strong>
              <small>Production Control</small>
            </div>
          )}

          <button className="sidebarToggle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? ">" : "<"}
          </button>
        </div>

        <nav className="navMenu" aria-label="주 메뉴">
          {menuGroups.map((group) => {
            const isOpen = openGroup === group.title;
            const hasActiveItem = group.items.some((item) => item.key === activeScreen);

            return (
              <section key={group.title} className={`navGroup ${hasActiveItem ? "current" : ""}`}>
                <button
                  type="button"
                  className="navGroupHeader"
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group.title)}
                >
                  <span className="groupLabel">
                    <group.icon className="h-5 w-5" />

                    {!collapsed && <span>{group.title}</span>}
                  </span>

                  <strong>{isOpen ? "−" : "+"}</strong>
                </button>
                {!collapsed && (
                  <div className={`navItems ${isOpen ? "open" : ""}`}>
                    {group.items.map((item) => {
                      const Icon = activeScreen === item.key ? FolderOpenIcon : FolderIcon;

                      return (
                        <button
                          key={item.key}
                          className={activeScreen === item.key ? "active" : ""}
                          type="button"
                          onClick={() => onScreenChange(item.key)}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
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
  );
}
