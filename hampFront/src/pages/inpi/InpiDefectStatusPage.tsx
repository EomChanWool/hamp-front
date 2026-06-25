import { mesScreens } from '../../data/mesScreens'
import { RowDetailModal } from '../../components/RowDetailModal'
import { KpiGrid } from '../../components/kpi/KpiGrid'
import { MesAreaChart } from '../../components/chart/MesAreaChart'
import { SearchBand } from '../../components/common/SearchBand'
import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildTableRows } from '../../utils/buildTableRows'

const DEF = mesScreens.inpiDefectStatus

export function InpiDefectStatusPage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } = useTableData(DEF.rows)
  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete)
  return (
    <section className="screenStack">
      {DEF.kpis && <KpiGrid kpis={DEF.kpis} />}
      {DEF.chart && <MesAreaChart title={DEF.chart.title} items={DEF.chart.items} />}
      <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />
      <TablePanel title={`${DEF.title} 목록`} headers={[...DEF.columns, '관리']} rows={tableRows} totalCount={filteredRows.length} action="새로고침" onAction={() => window.alert('mock 새로고침')} onRowClick={(i) => setModalRow(filteredRows[i])} />
      <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={handleSave} fields={fields} data={modalRow ?? {}} />
    </section>
  )
}
