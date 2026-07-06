import type { ReactNode } from 'react'

/** 제목 + 우측 액션 버튼이 있는 흰색 카드 컨테이너. 페이지 콘텐츠를 감싸는 기본 단위 */
type PanelProps = {
  title: string
  action?: string
  onAction?: () => void
  children: ReactNode
}

export function Panel({ title, action, onAction, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
        {action && (
          <button type="button" className="ghostButton" onClick={onAction}>
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
