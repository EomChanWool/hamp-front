import { useState, type ReactNode } from "react";
import { useLocation, useNavigate, matchPath } from "react-router-dom";
import { menuRoutes } from "@/router"; 
import { Header } from "./Header";
import { SideMenu } from "./SideMenu";

type AppShellProps = {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  theme,
  onToggleTheme,
  onLogout,
  children,
}: AppShellProps) {
  // 1. 좌측 메뉴 접고 펴기 상태 관리
  const [collapsed, setCollapsed] = useState(false);

  // 2. 현재 경로 파악 및 페이지 이동을 위한 라우터 훅
  const location = useLocation();
  const navigate = useNavigate();

  // 3. 현재 URL(location.pathname) 기반으로 Header에 표출할 타이틀 자동 매칭
  let activeGroup = "대시보드";
  let activeTitle = "메인 대시보드";

  // '/' 경로가 아닐 때만 매칭 로직을 돌려 성능을 최적화합니다.
  if (location.pathname !== "/") {
    for (const group of menuRoutes) {
      let isMatched = false;
      
      for (const item of group.items) {
        // 라우터 설정 규칙과 동일하게 path 결합 후 중복 슬래시 제거
        const fullPath = `${group.path}/${item.path}`.replace(/\/+/g, "/");
        
        // 현재 브라우저 주소와 정확히 일치하는지 판별
        if (matchPath({ path: fullPath, end: true }, location.pathname)) {
          activeGroup = group.title;
          activeTitle = item.name || "";
          isMatched = true;
          break;
        }
      }
      
      if (isMatched) break;
    }
  }

  return (
    <div className={`appShell ${collapsed ? "collapsed" : ""}`}>
      {/* 계산된 실시간 activeGroup, activeTitle 정보를 Header에 주입 */}
      <Header
        activeGroup={activeGroup}
        activeTitle={activeTitle}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onLogoClick={() => navigate("/")}
      />
      
      <div className={`mainContent ${collapsed ? "collapsed" : ""}`}>
        {/* SideMenu는 굳이 밖에서 active 정보를 넘기지 않고 내부에서 useLocation을 쓰도록 바꿀 것이므로 collapsed만 넘깁니다. */}
        <SideMenu collapsed={collapsed} />

        <main className="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}