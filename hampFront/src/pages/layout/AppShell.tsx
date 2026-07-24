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
      <Header
        activeGroup={activeGroup}
        activeTitle={activeTitle}
        theme={theme}
        onToggleTheme={onToggleTheme}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((prev) => !prev)}
        onLogoClick={() => navigate("/")}
      />

      <div className={`mainContent ${collapsed ? "collapsed" : ""}`}>
        <SideMenu collapsed={collapsed} />

        <main className="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}