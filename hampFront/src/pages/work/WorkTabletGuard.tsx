import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// 작업지시 화면 등 로그인이 필요한 태블릿 라우트에만 씌우는 가드
// (/work 홈과 신고처리는 로그인 없이도 접근 가능해서 이 가드를 거치지 않음)
export function WorkTabletGuard() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/work/login" replace state={{
      from: `${location.pathname}${location.search}`,
    }} />;
  }

  return <Outlet />;
}
