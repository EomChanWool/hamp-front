import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
// 태블릿 화면 확대 스타일 - 가드 하위의 모든 /work/* 화면에 공통 적용 (로그인 화면은 자체적으로 import)
import '@/pages/work/WorkTabletScale.css';

// /work/login을 제외한 모든 태블릿 라우트(생산동 선택, 홈, 작업지시, 신고처리, 출고처리)에 씌우는 가드
export function WorkTabletGuard() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/work/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
