import { useEffect, useMemo, useState } from "react";
import { FolderIcon, FolderOpenIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { menuRoutes } from "@/router";
import type { ScreenKey } from "@/types";

type SideMenuProps = {
  activeScreen: ScreenKey;
  collapsed: boolean;
  onScreenChange: (screen: ScreenKey) => void;
};

export function SideMenu({ activeScreen, collapsed, onScreenChange }: SideMenuProps) {
  const activeGroupTitle = useMemo(
    () => menuRoutes.find((group) => group.items.some((item) => item.key === activeScreen))?.title,
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

  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  return (
    <aside className="sidebar">
      <nav className="navMenu" aria-label="주 메뉴">
        {menuRoutes.map((group) => {
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
  );
}
