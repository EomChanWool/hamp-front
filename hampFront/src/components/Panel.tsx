import type { ReactNode } from 'react'

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
