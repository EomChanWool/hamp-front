import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext"; // 👈 Context 가져오기
import { loginApi } from "@/services/auth/auth";
import { useState } from "react";

export function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuth(); 

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = await loginApi({ userId, password });
      const token = data.accessToken || data.token;

      if (token) {
        login(token);
        alert('로그인 성공!');
        navigate('/');
      } else {
        alert('토큰을 전달받지 못했습니다.');
      }
    } catch (error: any) {
      console.error('로그인 실패 상세 에러:', error);
      alert(error.response?.data?.message || '로그인에 실패했습니다.');
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