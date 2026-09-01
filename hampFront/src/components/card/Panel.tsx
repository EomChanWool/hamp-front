import type { ReactNode } from 'react'

/** 제목 + 우측 액션 버튼이 있는 흰색 카드 컨테이너. 페이지 콘텐츠를 감싸는 기본 단위 */
type PanelProps = {
  title: string
  action?: string
  onAction?: () => void
  /**
   * 우측에 버튼 대신(또는 버튼과 함께) 자유롭게 넣고 싶은 커스텀 요소.
   * 예: 기간 선택 탭 그룹, 필터 드롭다운 등.
   * action/onAction과 동시에 넘기면 action 버튼 뒤에 이어서 렌더링됨.
   */
  extra?: ReactNode
  children?: ReactNode
}

export function Panel({ title, action, onAction, extra, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{title}</h2>
        {/* action 버튼과 extra 커스텀 요소를 함께 묶어서 우측에 배치 */}
        {(action || extra) && (
          <div className="panelHeaderActions">
            {action && (
              <button type="button" className="ghostButton" onClick={onAction}>
                {action}
              </button>
            )}
            {extra}
          </div>
        )}
      </div>
      {children}
    </section>
  )
}
