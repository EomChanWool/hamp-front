import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 16,
      }}
    >
      <h1>404</h1>
      <p>페이지를 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/')}>홈으로 이동</button>
    </div>
  )
}
