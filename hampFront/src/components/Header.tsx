import { MoonIcon, SunIcon, BellIcon, UserIcon, ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type HeaderProps = {
  activeGroup: string;
  activeTitle: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function Header({ theme, onToggleTheme, onLogout, collapsed, onToggleCollapsed }: HeaderProps) {
  return (
    <header className="header">
      <div className="brand" style={{ width: collapsed ? 'fit-content' : '252px', transition: 'width 0.3s ease' }}>
        <div className="brandInfo">
          <div className="brandMark">H</div>
          {!collapsed && (
            <div className="brandText">
              <strong>HEMP-MES</strong>
              <small>Production Control</small>
            </div>
          )}
        </div>
      </div>

      <div className="headerRight">
        <button className="sidebarToggle" onClick={onToggleCollapsed}>
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
        <div className="headActions">
          {/* 알림 */}
          <button type="button" className="headerIconBtn" aria-label="알림">
            <BellIcon className="h-5 w-5" />
            <span className="headerBadgeDot" />
          </button>

          {/* 테마 토글 */}
          <button
            type="button"
            className="headerIconBtn"
            aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </button>

          <div className="headerDivider" />

          {/* 유저 */}
          <div className="headerUser">
            <div className="headerAvatar">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="headerUserInfo">
              <span>관리자</span>
              <strong>admin</strong>
            </div>
          </div>

          {/* 로그아웃 */}
          <button type="button" className="headerIconBtn headerLogout" aria-label="로그아웃" onClick={onLogout}>
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
