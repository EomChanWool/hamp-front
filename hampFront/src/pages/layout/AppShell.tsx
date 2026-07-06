import { useState, type ReactNode } from "react";
import type { ScreenKey } from "@/types";
import { Header } from "./Header";
import { SideMenu } from "./SideMenu";

type AppShellProps = {
  activeScreen: ScreenKey;
  activeGroup: string;
  activeTitle: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onScreenChange: (screen: ScreenKey) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  activeScreen,
  activeGroup,
  activeTitle,
  theme,
  onToggleTheme,
  onScreenChange,
  onLogout,
  children,
}: AppShellProps) {
  //메뉴 접고 펴기
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`appShell ${collapsed ? "collapsed" : ""}`}>
      <Header
        activeGroup={activeGroup}
        activeTitle={activeTitle}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={onLogout}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onLogoClick={() => onScreenChange("dashboard")}
      />
      <div className={`mainContent ${collapsed ? "collapsed" : ""}`}>
        <SideMenu activeScreen={activeScreen} collapsed={collapsed} onScreenChange={onScreenChange} />

        <main className="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}
