import { useNavigate } from 'react-router-dom'
import { ErrorLayout } from './ErrorLayout'

/** 라우팅 404: 프론트 라우트에 없는 주소로 접근했을 때 */
export function NotFound() {
  const navigate = useNavigate()

  return (
    <ErrorLayout
      code="404"
      title="페이지를 찾을 수 없습니다."
      description={
        <>
          요청하신 페이지가 존재하지 않거나
          <br />
          주소가 변경되었을 수 있습니다.
        </>
      }
      actions={
        <>
          <button
            type="button"
            className="secondaryButton"
            onClick={() => navigate(-1)}
          >
            이전 페이지
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
