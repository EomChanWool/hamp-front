import { useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate, matchPath } from "react-router-dom";
import { menuRoutes } from "@/router";
import { Header } from "./Header";
import { SideMenu } from "./SideMenu";

type AppShellProps = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  children: ReactNode;
};

export function AppShell({
  theme,
  onToggleTheme,
  children,
}: AppShellProps) {

  // 좌측 메뉴 접고 펴기 상태 관리
  const [collapsed, setCollapsed] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const handleToggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  const handleLogoClick = () => {
    navigate("/");
  };

  // 유저 정보 페이지로 이동하는 핸들러 추가
  const handleUserClick = () => {
    navigate("/system/users/info");
  };

  const { activeGroup, activeTitle } = useMemo(() => {
    let groupName = "대시보드";
    let titleName = "메인 대시보드";

    if (location.pathname !== "/") {
      for (const group of menuRoutes) {
        let isMatched = false;
        for (const item of group.items) {
          const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");
          if (matchPath({ path: fullPath, end: true }, location.pathname)) {
            groupName = group.title;
            titleName = item.name || "";
            isMatched = true;
            break;
          }
        }
        if (isMatched) break;
      }
    }

    return { activeGroup: groupName, activeTitle: titleName };
  }, [location.pathname]);

  return (
    <div className={`appShell ${collapsed ? "collapsed" : ""}`}>
      <div className={`mainContent ${collapsed ? "collapsed" : ""}`}>
        <SideMenu
          collapsed={collapsed}
          onToggleCollapsed={handleToggleCollapsed}
          onLogoClick={handleLogoClick}
        />

        <div className="contentArea">
          <Header
            activeGroup={activeGroup}
            activeTitle={activeTitle}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogoClick={handleLogoClick}
            onUserClick={handleUserClick}
          />

          <main className="workspace">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}