import { mesScreens } from '../../data/mesScreens'
import { RowDetailModal } from '../../components/RowDetailModal'
import { MesAreaChart } from '../../components/chart/MesAreaChart'
import { SearchBand } from '../../components/common/SearchBand'
import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildTableRows } from '../../utils/buildTableRows'

const DEF = mesScreens.facilityEnvironmentHistory

export function FacilityEnvironmentHistoryPage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } =
    useTableData(DEF.rows)

  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete)

  return (
    <section className="screenStack">
      {DEF.chart && <MesAreaChart title={DEF.chart.title} items={DEF.chart.items} />}
      <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />
      <TablePanel
        title={`${DEF.title} 목록`}
        headers={[...DEF.columns, '관리']}
        rows={tableRows}
        totalCount={filteredRows.length}
        onRowClick={(i) => setModalRow(filteredRows[i])}
      />
      <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={handleSave} fields={fields} data={modalRow ?? {}} />
    </section>
  )
}
