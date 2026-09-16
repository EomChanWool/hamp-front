import { useEffect, useRef, useState } from "react";
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

  // ── 플라이아웃(collapsed 상태의 팝업 서브메뉴) 위치 계산용 ──────────────
  // .navItems가 position:fixed인데 top 값이 CSS에 없어서, 사이드바를
  // 스크롤한 상태에서 열면 실제 버튼 위치와 어긋나 화면 밖으로 벗어나던
  // 문제를 해결하기 위해 hover 시점의 실제 좌표(getBoundingClientRect)를
  // 계산해서 인라인 스타일로 꽂아준다.
  const sidebarRef = useRef<HTMLElement | null>(null);
  const headerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // 플라이아웃(서브메뉴 목록) 자체의 DOM을 잡아서 실제 렌더링된 높이를
  // 재기 위한 ref. opacity:0 상태에서도 레이아웃은 이미 잡혀있어서
  // 높이를 정확히 읽을 수 있다.
  const flyoutRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);

  const FLYOUT_MARGIN = 8; // 화면 가장자리와 최소로 띄울 여백(px)
  const FLYOUT_WIDTH = 215; // .navItems collapsed 상태 고정 폭과 동일

  const updateFlyoutPosition = (title: string) => {
    const btn = headerRefs.current[title];
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    // 1차: 버튼의 top/right 기준으로 기본 위치 산정
    let top = rect.top;
    let left = rect.right + FLYOUT_MARGIN;

    // 2차: 플라이아웃 자체의 실제 높이를 재서, 화면 하단을 벗어나면
    // 위로 당겨서 붙인다 (버튼 위치 그대로 아래로만 펼치면 하단에
    // 가까운 메뉴일수록 서브항목이 화면 밖으로 잘려 나가던 문제 수정)
    const flyoutEl = flyoutRefs.current[title];
    if (flyoutEl) {
      const flyoutHeight = flyoutEl.getBoundingClientRect().height;
      const maxTop = window.innerHeight - flyoutHeight - FLYOUT_MARGIN;
      top = Math.min(top, maxTop);
    }
    top = Math.max(FLYOUT_MARGIN, top);

    // 가로 방향도 동일하게: 우측 가장자리를 벗어나지 않도록 보정
    const maxLeft = window.innerWidth - FLYOUT_WIDTH - FLYOUT_MARGIN;
    left = Math.min(left, maxLeft);

    setFlyoutPos({ top, left });
  };

  const handleGroupEnter = (title: string) => {
    if (!collapsed) return;
    setHoveredGroup(title);
    updateFlyoutPosition(title);
  };

  const handleGroupLeave = () => {
    setHoveredGroup(null);
  };

  // 사이드바를 스크롤하거나 창 크기가 바뀌는 동안(플라이아웃이 열려있을 때)
  // 실시간으로 위치를 다시 계산해서 버튼을 계속 따라가게 함
  useEffect(() => {
    if (!collapsed || !hoveredGroup) return;

    const handleReposition = () => updateFlyoutPosition(hoveredGroup);

    const sidebarEl = sidebarRef.current;
    sidebarEl?.addEventListener("scroll", handleReposition, { passive: true });
    window.addEventListener("resize", handleReposition);

    return () => {
      sidebarEl?.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [collapsed, hoveredGroup]);

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
    <aside className="sidebar" ref={sidebarRef}>
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
            const isFlyoutOpen = collapsed && hoveredGroup === group.title;

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
                  isFlyoutOpen ? "flyoutOpen" : "",
                ].join(" ")}
                onMouseEnter={() => handleGroupEnter(group.title)}
                onMouseLeave={handleGroupLeave}
              >
                {/* 대메뉴 헤더 토글 버튼 */}
                <button
                  type="button"
                  ref={(el) => { headerRefs.current[group.title] = el; }}
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
                <div
                  ref={(el) => { flyoutRefs.current[group.title] = el; }}
                  className={`navItems ${isOpen && !collapsed ? "open" : ""}`}
                  style={isFlyoutOpen && flyoutPos ? { top: flyoutPos.top, left: flyoutPos.left } : undefined}
                >
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
