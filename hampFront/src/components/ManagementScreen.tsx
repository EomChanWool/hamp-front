import type { ReactNode } from 'react'
import { DataTable } from './DataTable'
import { Panel } from './Panel'

type ManagementScreenProps = {
  title: string
  filters: string[]
  primary: string
  table: { headers: string[]; rows: Array<Array<ReactNode>> }
  children?: ReactNode
}

export function ManagementScreen({ title, filters, primary, table, children }: ManagementScreenProps) {
  return (
    <section className="screenStack">
      <div className="searchBand">
        {filters.map((filter) => (
          <label key={filter}>
            {filter}
            <input placeholder={`${filter} 검색`} />
          </label>
        ))}
        <button type="button" className="primaryButton">
          조회
        </button>
      </div>
      <Panel title={title} action={primary}>
        {children}
        <DataTable headers={table.headers} rows={table.rows} />
      </Panel>
    </section>
  )
}
