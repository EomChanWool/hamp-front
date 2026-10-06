import { useEffect, useState, type SyntheticEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isValidWorkZone } from '@/utils/common';
import { getLastWorkZone } from '@/pages/work/WorkZoneStorage';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkTabletLoginPage.css';
import '@/pages/work/WorkTabletScale.css';

export function WorkTabletLoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  // 로그인 후 이동할 곳
  // 1) 가드에 막혀서 온 경우 -> 원래 가려던 화면
  // 2) 직접 로그인 화면으로 온 경우 -> 이 태블릿에서 마지막으로 쓴 생산동 메뉴(없으면 생산동 선택 화면)
  const lastZone = getLastWorkZone();
  const defaultPath = isValidWorkZone(lastZone)
    ? `/work/home?zone=${encodeURIComponent(lastZone)}`
    : '/work';
  const from = (location.state as { from?: string } | null)?.from || defaultPath;

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleLogin = async (e: SyntheticEvent) => {
    e.preventDefault();

    if (!userId.trim()) {
      alert('아이디를 입력해 주세요.');
      return;
    }
    if (!password.trim()) {
      alert('비밀번호를 입력해 주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ userId, password });
      navigate(from, { replace: true });
    } catch (error) {
      // AuthContext.login()이 항상 Error로 감싸서 던지므로 message만 꺼내면 됨
      const message = error instanceof Error ? error.message : undefined;
      alert(message || '로그인 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="workTabletPage">
      <div className="workTabletPanel">
        <form className="workTabletLoginContainer" onSubmit={handleLogin}>
          <div className="workTabletLoginMain">
            {/* TODO: 헴프 로고 자리 - 지금은 자리만 잡아둔 임시 표시 */}
            <div className="workTabletLogoPlaceholder workTabletLogoPlaceholder--center">로고</div>

            <div className="workTabletHeader">
              <h1>현장 태블릿 로그인</h1>
              <p>업무를 시작하려면 로그인해 주세요.</p>
            </div>

            <div className="workTabletLoginFields">
              <input
                type="text"
                className="workTabletLoginInput"
                placeholder="아이디"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
              />
              <input
                type="password"
                className="workTabletLoginInput"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="workTabletLoginSubmitBtn" disabled={isSubmitting}>
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
