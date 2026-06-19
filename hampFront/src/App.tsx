import { useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import { menuGroups, screenTitles } from "./data/navigation";
import { LoginPage } from "./pages/auth/LoginPage";
import { PageRenderer } from "./pages/PageRenderer";
import type { ScreenKey } from "./types";
import "./App.css";

const SESSION_KEY = "hemp_mes_demo_session";
const defaultScreen: ScreenKey = "dashboard";

const screenKeys = new Set<ScreenKey>(Object.keys(screenTitles) as ScreenKey[]);

function getScreenFromHash(): ScreenKey {
  const hashValue = window.location.hash.replace(/^#\/?/, "");
  return screenKeys.has(hashValue as ScreenKey) ? (hashValue as ScreenKey) : defaultScreen;
}

function moveHash(screen: ScreenKey) {
  const nextHash = `#/${screen}`;
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash;
  }
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem(SESSION_KEY) === "true");
  const [activeScreen, setActiveScreenState] = useState<ScreenKey>(() => getScreenFromHash());
  const [theme, setTheme] = useState<"dark" | "light">("light"); // 추가
  const activeTitle = screenTitles[activeScreen];

  // useEffect는 훅이라 조건부 return 위에 있어야 해요
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveScreenState(getScreenFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (isLoggedIn && !window.location.hash) {
      moveHash(activeScreen);
    }
  }, [activeScreen, isLoggedIn]);

  const activeGroup = useMemo(
    () => menuGroups.find((group) => group.items.some((item) => item.key === activeScreen))?.title ?? "대시보드",
    [activeScreen],
  );

  const setActiveScreen = (screen: ScreenKey) => {
    setActiveScreenState(screen);
    moveHash(screen);
  };

  const handleLogin = () => {
    localStorage.setItem(SESSION_KEY, "true");
    setIsLoggedIn(true);
    moveHash(activeScreen);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setIsLoggedIn(false);
    window.location.hash = "";
    setActiveScreenState(defaultScreen);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AppShell
      activeScreen={activeScreen}
      activeGroup={activeGroup}
      activeTitle={activeTitle}
      theme={theme}                     
      onToggleTheme={() => setTheme(t => t === "light" ? "dark" : "light")}
      onScreenChange={setActiveScreen}
      onLogout={handleLogout}
    >
      <PageRenderer activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
    </AppShell>
  );
}

export default App;
