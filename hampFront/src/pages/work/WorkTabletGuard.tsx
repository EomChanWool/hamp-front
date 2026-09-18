import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

// 태블릿 전용 화면(/work 이하)은 로그인 후에만 진입 가능
export function WorkTabletGuard() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/work/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
