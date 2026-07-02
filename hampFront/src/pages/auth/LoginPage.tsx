import { LockClosedIcon, UserCircleIcon } from "@heroicons/react/24/outline";

type LoginPageProps = {
  onLogin: () => void;
};

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <main className="loginPage">
      <section className="loginPanel">
        <form className="loginForm" onSubmit={(event) => event.preventDefault()}>
          <div className="loginLogo">
            <div className="brandMark">H</div>
            <h2>HEMP-MES</h2>
          </div>
          <div className="inputGroup">
            <label htmlFor="username">
              <input id="username" defaultValue="admin" type="text" placeholder="아이디" />
              <UserCircleIcon className="inputIcon" />
            </label>
            <label htmlFor="password">
              <input id="password" defaultValue="password" type="password" placeholder="비밀번호" />
              <LockClosedIcon className="inputIcon" />
            </label>
          </div>
          <button type="button" className="primaryButton" onClick={onLogin}>
            로그인
          </button>
          <p>백엔드 연결 전 임시 로그인입니다.</p>
        </form>
      </section>
    </main>
  );
}
