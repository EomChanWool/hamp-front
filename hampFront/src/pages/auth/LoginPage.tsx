import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState, type SyntheticEvent } from "react";

export function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: SyntheticEvent) => {
    e.preventDefault();

    try {
      await login({ userId, password });
      navigate('/');
    } catch (error: any) {
      alert(error.message || '로그인 처리에 실패했습니다.');
    }
  };

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
          <button type="submit" className="primaryButton">
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}