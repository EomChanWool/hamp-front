import { mesScreens } from '../../data/mesScreens'
// import { RowDetailModal } from '../../components/RowDetailModal'
import { CctvGrid } from '../../components/cctv/CctvGrid'
// import { SearchBand } from '../../components/common/SearchBand'
// import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildTableRows } from '../../utils/buildTableRows'

const DEF = mesScreens.facilityCctv

export function FacilityCctvPage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } =
    useTableData(DEF.rows)

  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete)

  return (
    <section className="screenStack">
      <CctvGrid rows={filteredRows} />
      {/* <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />
      <TablePanel
        title={`${DEF.title} 목록`}
        headers={[...DEF.columns, '관리']}
        rows={tableRows}
        totalCount={filteredRows.length}
        onRowClick={(i) => setModalRow(filteredRows[i])}
      />
      <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={handleSave} fields={fields} data={modalRow ?? {}} /> */}
    </section>
  )
}
