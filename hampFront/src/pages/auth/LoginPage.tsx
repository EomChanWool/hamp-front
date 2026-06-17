type LoginPageProps = {
  onLogin: () => void
}

export function LoginPage({ onLogin }: LoginPageProps) {
  return (
    <main className="loginPage">
      <section className="loginPanel">
        <div className="loginCopy">
          <span className="eyebrow">React + Spring Boot + Redis + Mosquitto</span>
          <h1>HEMP-MES</h1>
          <p>입고, LOT, 생산, 품질, 설비 상태를 하나의 운영 화면에서 관리합니다.</p>
          <div className="loginFlow">
            {['입고', 'LOT', '작업지시', '생산실적', '재고', '품질', '설비'].map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
        </div>

        <form className="loginForm" onSubmit={(event) => event.preventDefault()}>
          <h2>HEMP-MES Login</h2>
          <label>
            아이디
            <input defaultValue="admin" type="text" />
          </label>
          <label>
            비밀번호
            <input defaultValue="password" type="password" />
          </label>
          <button type="button" className="primaryButton" onClick={onLogin}>
            로그인
          </button>
          <p>백엔드 연결 전 임시 로그인입니다.</p>
        </form>
      </section>
    </main>
  )
}
