import { mesScreens } from '../../data/mesScreens'
import { RowDetailModal } from '../../components/RowDetailModal'
import { SearchBand } from '../../components/common/SearchBand'
import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildTableRows } from '../../utils/buildTableRows'

const DEF = mesScreens.inpiDefectManage

export function InpiDefectManagePage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } = useTableData(DEF.rows)
  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete, DEF.columns)
  return (
    <section className="screenStack">
      <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />
      <TablePanel title={`${DEF.title} 목록`} headers={[...DEF.columns, '관리']} rows={tableRows} totalCount={filteredRows.length} action="등록" onAction={() => window.alert('mock 동작입니다.')} onRowClick={(i) => setModalRow(filteredRows[i])} />
      <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={handleSave} fields={fields} data={modalRow ?? {}} />
    </section>
  )
}
