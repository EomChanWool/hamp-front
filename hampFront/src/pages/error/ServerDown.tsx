import { useNavigate } from 'react-router-dom'
import { ErrorLayout } from './ErrorLayout'

/** 서버 다운: 5xx / 네트워크 단절 / 타임아웃 */
export function ServerDown() {
  const navigate = useNavigate()

  const handleRetry = () => {
    const prevPath = sessionStorage.getItem('preServerDownPath')
    sessionStorage.removeItem('preServerDownPath')
    // 이전 화면으로 복귀. 서버가 아직 죽어 있으면 인터셉터가 다시 이 페이지로 보낸다.
    navigate(prevPath && !prevPath.startsWith('/server-down') ? prevPath : '/', {
      replace: true,
    })
  }

  return (
    <ErrorLayout
      code="503"
      title="서버에 연결할 수 없습니다."
      description={
        <>
          서버 점검 중이거나 네트워크 연결에 문제가 있습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="primaryButton"
            onClick={handleRetry}
          >
            다시 시도
          </button>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => {
              sessionStorage.removeItem('preServerDownPath')
              navigate('/', { replace: true })
            }}
          >
            홈으로 이동
          </button>
        </>
      }
    />
  )
}
