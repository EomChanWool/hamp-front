import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FolderIcon, FolderOpenIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { menuRoutes } from "@/router";
import { MenuApi } from "@/api/Menu"; 
import type { MenuResponse } from "@/api/Menu"; 
import Spinner from "@/components/common/Spinner";
import './Layout.css';

type SideMenuProps = {
  collapsed: boolean;
};

export function SideMenu({ collapsed }: SideMenuProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [myMenus, setMyMenus] = useState<MenuResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 컴포넌트 마운트 시 
  useEffect(() => {
    const fetchMyMenus = async () => {
      try {
        const response = await MenuApi.getMyList(); 
        if (response && response.data) {
          setMyMenus(response.data);
        }
      } catch (error) {
        console.error("내 메뉴 목록 조회 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMyMenus();
  }, []);

  // 현재 URL 주소를 기반으로 활성화되어야 하는 대메뉴 그룹(group.title) 탐색
  const currentActiveGroupTitle = (() => {
    if (location.pathname === "/") return null;

    for (const group of menuRoutes) {
      for (const item of group.items) {
        const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");
        if (
          location.pathname === fullPath ||
          location.pathname.startsWith(`${fullPath}/`)
        ) {
          return group.title;
        }
      }
    }
    return null;
  })();

  // 아코디언 메뉴 열림/닫힘 상태 관리
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

  if (isLoading) {
    return (
      <aside className="sidebar">
        <div> <Spinner/> </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar">
      {/* 내부 스크롤과 플라이아웃 메뉴 잘림 방지를 위해 Wrapper 추가 */}
      <div className="sidebarMenuWrapper">
        <nav className="navMenu" aria-label="주 메뉴">
          {menuRoutes.map((group) => {
            // 1. API(myMenus)에서 현재 대메뉴(group.title)와 일치하는 데이터 찾기
            const matchedApiMenu = myMenus.find((m) => m.menuNm === group.title);

            // 권한이 없으면(매칭되는 대메뉴가 없으면) 렌더링 안 함
            if (!matchedApiMenu) return null;

            // 2. 백엔드에서 허용된 소메뉴의 urlPath 목록 추출
            const allowedSubUrls = matchedApiMenu.children
              ? matchedApiMenu.children.map((child) => child.urlPath)
              : [];

            const isOpen = openGroup === group.title;
            const hasActiveItem = currentActiveGroupTitle === group.title;

            // 3. 소메뉴 필터링: hidden이 아니면서, 백엔드가 허용한 urlPath에 포함되는 것만 추출
            const visibleItems = group.items.filter((item) => {
              if (item.hidden) return false;

              const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");
              return allowedSubUrls.includes(fullPath);
            });

            // 만약 권한이 있는 소메뉴가 하나도 없다면 해당 대메뉴 그룹 자체를 숨김
            if (visibleItems.length === 0) return null;

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
                  {visibleItems.map((item) => {
                    const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");

                    // 현재 주소와 일치하는지 여부 판별
                    const isItemActive =
                      location.pathname === fullPath ||
                      location.pathname.startsWith(`${fullPath}/`);
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
      </div>
    </aside>
  );
}