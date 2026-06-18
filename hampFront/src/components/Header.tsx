import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

type HeaderProps = {
  activeGroup: string;
  activeTitle: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
};

export function Header({ activeGroup, activeTitle, theme, onToggleTheme, onLogout }: HeaderProps) {
  return (
    <header className="topbar">
      <div>
        <span className="breadcrumb">{activeGroup}</span>
        <h1>{activeTitle}</h1>
      </div>
      <div className="topActions">
        <button type="button" className="iconButton" aria-label="알림">
          !
        </button>
        <button
          type="button"
          className="themeToggle"
          aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <SunIcon className="themeToggleIcon" aria-hidden="true" />
          ) : (
            <MoonIcon className="themeToggleIcon" aria-hidden="true" />
          )}
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
  );
}