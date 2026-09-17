import type { ReactNode } from 'react'

/** 제목 + 우측 액션 버튼이 있는 흰색 카드 컨테이너. 페이지 콘텐츠를 감싸는 기본 단위 */
type PanelProps = {
  title: ReactNode;
  action?: string | ReactNode; // <- string 또는 ReactNode(버튼 그룹 등)를 모두 받을 수 있게 수정
  onAction?: () => void
  children: ReactNode
}

export function Panel({ title, action, onAction, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
        {action && (
          // 만약 action이 string이면 기존처럼 버튼으로 감싸고, JSX(노드)면 그대로 렌더링
          typeof action === 'string' ? (
            <button type="button" className="ghostButton" onClick={onAction}>
              {action}
            </button>
          ) : (
            action
          )
        )}
      </div>
      {children}
    </section>
  )
}