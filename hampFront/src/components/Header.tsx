import { useState } from "react";
import {
  MoonIcon,
  SunIcon,
  BellIcon,
  UserIcon,
  ArrowRightStartOnRectangleIcon,
  HomeIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type HeaderProps = {
  activeGroup: string;
  activeTitle: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogoClick: () => void;
};

type NotificationItem = {
  id: string;
  message: string;
  time: string;
};

const initialNotifications: NotificationItem[] = [
  { id: "1", message: "새로운 알림이 있습니다.", time: "2026.07.01 10:30" },
  { id: "2", message: "새로운 알림이 있습니다.", time: "2026.07.01 10:30" },
  { id: "3", message: "새로운 알림이 있습니다.", time: "2026.07.01 10:30" },
  { id: "4", message: "새로운 알림이 있습니다.", time: "2026.07.01 10:30" },
];

export function Header({
  activeGroup,
  activeTitle,
  theme,
  onToggleTheme,
  onLogout,
  collapsed,
  onToggleCollapsed,
  onLogoClick,
}: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <header className="header">
      <div className="brand" style={{ width: collapsed ? "100px" : "252px", transition: "width 0.3s ease" }}>
        <div
          className="brandInfo"
          onClick={onLogoClick}
          role="button"
          aria-label="메인 대시보드로 이동"
          style={{ cursor: "pointer" }}
        >
          <div className="brandMark">H</div>
          {!collapsed && (
            <div className="brandText">
              <strong>HEMP-MES</strong>
              <small>Production Control</small>
            </div>
          )}
        </div>

        <button className={`sidebarToggle ${collapsed ? "collapsedToggle" : ""}`} onClick={onToggleCollapsed}>
          {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
        </button>
      </div>

      <div className="headerRight">
        <div className="topbar">
          <div>
            <nav className="breadcrumb" aria-label="현재 위치">
              <button
                type="button"
                className="breadcrumbHomeBtn"
                onClick={onLogoClick}
                aria-label="메인 대시보드로 이동"
              >
                <HomeIcon className="h-4 w-4 breadcrumbHomeIcon" />
              </button>
              <ChevronRightIcon className="h-3 w-3 breadcrumbSep" />
              <span className="breadcrumbGroup">{activeGroup}</span>
              <ChevronRightIcon className="h-3 w-3 breadcrumbSep" />
              <span className="breadcrumbCurrent">{activeTitle}</span>
            </nav>
          </div>
        </div>
        <div className="headActions">
          {/* 알림 */}
          <div className="headerNotificationWrap">
            <button
              type="button"
              className="headerIconBtn"
              aria-label="알림"
              onClick={() => setShowNotifications((prev) => !prev)}
            >
              <BellIcon className="h-5 w-5" />
              {notifications.length > 0 && <span className="headerBadgeDot" />}
            </button>

            {/* 알림팝업 */}
            {showNotifications && (
              <div className="headerNotificationPopup">
                <div className="headerPopupTopBox">
                  <p>알림</p>
                  <button
                    type="button"
                    className="headerPopupCloseBtn"
                    aria-label="알림 닫기"
                    onClick={() => setShowNotifications(false)}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
                <ul className="headerPopup">
                  {notifications.length === 0 && (
                    <li className="headerPopupEmpty">알림이 없습니다.</li>
                  )}
                  {notifications.map((item) => (
                    <li key={item.id} className="headerPopupContent">
                      <p>{item.message}</p>
                      <span className="headerPopupTime">{item.time}</span>
                      <button
                        type="button"
                        className="headerListCloseBtn"
                        aria-label="알림 삭제"
                        onClick={() => removeNotification(item.id)}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

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