// 이 태블릿에서 마지막으로 사용한 생산동을 기억해 두는 용도.
// 로그인 직후 곧바로 해당 생산동 메뉴로 보내주기 위해 쓴다. (생산동은 "기기 설정"에 가까워서 로그아웃해도 유지)
const LAST_ZONE_KEY = 'hemp.work.lastZone';

export const getLastWorkZone = (): string | null => {
  try {
    return localStorage.getItem(LAST_ZONE_KEY);
  } catch {
    return null;
  }
};

export const setLastWorkZone = (zone: string) => {
  try {
    localStorage.setItem(LAST_ZONE_KEY, zone);
  } catch {
    // 사생활 보호 모드 등으로 저장이 막혀도 화면 동작에는 영향 없음
  }
};
