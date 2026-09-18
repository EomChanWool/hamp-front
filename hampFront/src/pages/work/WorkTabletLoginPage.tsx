import { useEffect, useState, type SyntheticEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import '@/pages/work/WorkTabletHome.css';
import '@/pages/work/WorkTabletLoginPage.css';

export function WorkTabletLoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  // 신고처리 등 태블릿 화면 진입이 막혀 로그인으로 넘어온 경우, 로그인 후 그 화면으로 복귀
  const from = (location.state as { from?: string } | null)?.from || '/work';

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

          <button type="submit" className="workTabletBtn" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
