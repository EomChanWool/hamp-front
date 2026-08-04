import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, type SyntheticEvent } from "react";

export function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // 1차: 프론트엔드 유효성 검증
  const validateForm = (): boolean => {
    if (!userId.trim()) {
      alert('아이디를 입력해주세요.');
      return false;
    }
    if (!password.trim()) {
      alert('비밀번호를 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleLogin = async (e: SyntheticEvent) => {
    e.preventDefault();

    // [1차 검증] 프론트엔드 유효성 체크
    if (!validateForm()) {
      return; // 조건 미달 시 백엔드 API 요청 차단
    }

    try {
      setIsSubmitting(true);
      await login({ userId, password });
      
      navigate('/', { replace: true });
    } catch (error: any) {
      // [2차 검증] 백엔드에서 넘어오는 에러 메시지 우선 노출
      const apiErrorMessage =
        error.response?.data?.message || error.message || '로그인 처리에 실패했습니다.';
      
      alert(apiErrorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <main className="loginPage">
      <section className="loginPanel">
        <form className="loginForm" onSubmit={handleLogin}>
          <div className="loginLogo">
            <div className="brandMark">H</div>
            <h2>HEMP-MES</h2>
          </div>
          <div className="inputGroup">
            <label htmlFor="username">
              <input
                id="username"
                type="text"
                placeholder="아이디"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
              <UserCircleIcon className="inputIcon" />
            </label>
            <label htmlFor="password">
              <input
                id="password"
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <LockClosedIcon className="inputIcon" />
            </label>
          </div>
          <button type="submit" className="primaryButton" disabled={isSubmitting}>
            {isSubmitting ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </section>
    </main>
  );
}