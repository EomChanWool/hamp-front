import { useLocation, useNavigate } from 'react-router-dom'
import { ErrorLayout } from './ErrorLayout'

interface ApiErrorState {
  from?: string
  status?: number
  method?: string
  url?: string
}

/**
 * API 404: 화면 주소는 맞지만 호출한 API 엔드포인트가 없거나 연결되지 않은 경우
 * (서버가 JSON 에러 코드 없이 404만 내려준 경우 = 게이트웨이/배포/URL 오타 문제)
 */
export function ApiError() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const info = (state ?? {}) as ApiErrorState

  return (
    <ErrorLayout
      code={`API ${info.status ?? 404}`}
      title="데이터를 불러오지 못했습니다."
      description={
        <>
          요청한 API를 찾을 수 없습니다.
          <br />
          문제가 계속되면 아래 정보를 관리자에게 전달해 주세요.
        </>
      }
      detail={
        info.url ? (
          <>
            {info.method?.toUpperCase() ?? 'GET'} {info.url}
          </>
        ) : undefined
      }
      actions={
        <>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => navigate(info.from ?? '/', { replace: true })}
          >
            이전 화면으로
          </button>
          <button
            type="button"
            className="primaryButton"
            onClick={() => navigate('/', { replace: true })}
          >
            홈으로 이동
          </button>
        </>
      }
    />
  )
}
