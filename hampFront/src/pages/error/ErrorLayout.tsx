import type { ReactNode } from 'react'
import './NotFound.css'
import './ErrorLayout.css'

interface ErrorLayoutProps {
  /** 큰 글씨로 표시되는 코드 (예: 404, 503, API-404) */
  code: string
  title: string
  description: ReactNode
  /** 버튼 영역 */
  actions: ReactNode
  /** 담당자 문의용 부가 정보 (요청 URL 등) */
  detail?: ReactNode
}

export function ErrorLayout({
  code,
  title,
  description,
  actions,
  detail,
}: ErrorLayoutProps) {
  return (
    <main className="notFoundPage">
      <section className="notFoundPanel">
        <div className="notFoundContent">
          <span className="notFoundCode">{code}</span>

          <h1>{title}</h1>

          <p>{description}</p>

          {detail && <div className="errorDetail">{detail}</div>}

          <div className="errorActions">{actions}</div>
        </div>
      </section>
    </main>
  )
}
