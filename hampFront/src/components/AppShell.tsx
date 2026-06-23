import { useEffect, useMemo, useState, type ReactNode } from "react";
import { menuGroups } from "../data/navigation";
import type { ScreenKey } from "../types";
import { FolderIcon, FolderOpenIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { Header } from "./Header";

type AppShellProps = {
  activeScreen: ScreenKey;
  activeGroup: string;
  activeTitle: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onScreenChange: (screen: ScreenKey) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  activeScreen,
  activeGroup,
  activeTitle,
  theme,
  onToggleTheme,
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
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  return (
    <div className={`appShell ${collapsed ? "collapsed" : ""}`}>
      <Header
        activeGroup={activeGroup}
        activeTitle={activeTitle}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />
      <div className={`mainContent ${collapsed ? "collapsed" : ""}`}>
        <aside className="sidebar">
          <nav className="navMenu" aria-label="주 메뉴">
            {menuGroups.map((group) => {
              const isOpen = openGroup === group.title;
              const hasActiveItem = group.items.some((item) => item.key === activeScreen);

              return (
                <section
                  key={group.title}
                  className={[
                    "navGroup",
                    hasActiveItem ? "current" : "",
                    collapsed && hoveredGroup === group.title ? "flyoutOpen" : "",
                  ].join(" ")}
                  onMouseEnter={() => collapsed && setHoveredGroup(group.title)}
                  onMouseLeave={() => collapsed && setHoveredGroup(null)}
                >
                  <button
                    type="button"
                    className="navGroupHeader"
                    aria-expanded={isOpen}
                    onClick={() => !collapsed && toggleGroup(group.title)}
                  >
                    <span className="groupLabel">
                      <group.icon className="h-5 w-5" />
                      {!collapsed && <span>{group.title}</span>}
                    </span>
                    {!collapsed &&
                      (isOpen ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />)}
                  </button>

                  <div className={`navItems ${isOpen && !collapsed ? "open" : ""}`}>
                    {group.items.map((item) => {
                      const Icon = activeScreen === item.key ? FolderOpenIcon : FolderIcon;
                      return (
                        <button
                          key={item.key}
                          className={activeScreen === item.key ? "active" : ""}
                          type="button"
                          onClick={() => {
                            onScreenChange(item.key);
                            if (collapsed) setHoveredGroup(null);
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </nav>
        </aside>

        <main className="workspace">
          <div className="topbar">
            <div>
              <span className="breadcrumb">{activeGroup}</span>
              <h1>{activeTitle}</h1>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
