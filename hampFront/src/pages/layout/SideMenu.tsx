import { useEffect, useState } from "react";
import { useLocation, useNavigate, matchPath } from "react-router-dom";
import { FolderIcon, FolderOpenIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { menuRoutes } from "@/router"; // 💡 프로젝트 실제 경로 확인

type SideMenuProps = {
  collapsed: boolean;
};

export function SideMenu({ collapsed }: SideMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // 1. 현재 URL 주소를 기반으로 활성화되어야 하는 대메뉴 그룹(group.title) 탐색
  const currentActiveGroupTitle = (() => {
    if (location.pathname === "/") return null;

    for (const group of menuRoutes) {
      for (const item of group.items) {
        const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");
        if (matchPath({ path: fullPath, end: true }, location.pathname)) {
          return group.title;
        }
      }
    }
    return null;
  })();

  // 2. 아코디언 메뉴 열림/닫힘 상태 관리
  const [openGroup, setOpenGroup] = useState<string | null>(currentActiveGroupTitle);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // URL 주소가 바뀔 때마다 활성화된 그룹 자동 확장
  useEffect(() => {
    if (currentActiveGroupTitle) {
      setOpenGroup(currentActiveGroupTitle);
    }
  }, [currentActiveGroupTitle]);

  const toggleGroup = (title: string) => {
    setOpenGroup((current) => (current === title ? null : title));
  };

  return (
    <aside className="sidebar">
      <nav className="navMenu" aria-label="주 메뉴">
        {menuRoutes.map((group) => {
          const isOpen = openGroup === group.title;
          const hasActiveItem = currentActiveGroupTitle === group.title;

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
              {/* 대메뉴 헤더 토글 버튼 */}
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

              {/* 소메뉴 아이템 리스트 영역 */}
              <div className={`navItems ${isOpen && !collapsed ? "open" : ""}`}>
                {group.items.map((item) => {
                  const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");
                  
                  // 현재 주소와 일치하는지 여부 판별
                  const isItemActive = matchPath({ path: fullPath, end: true }, location.pathname);
                  const Icon = isItemActive ? FolderOpenIcon : FolderIcon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      className={isItemActive ? "active" : ""}
                      onClick={() => {
                        navigate(fullPath);
                        if (collapsed) setHoveredGroup(null);
                      }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
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