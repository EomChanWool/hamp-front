import { mesScreens } from '../../data/mesScreens'
import { RowDetailModal } from '../../components/RowDetailModal'
import { PermissionBoard } from '../../components/permission/PermissionBoard'
import { SearchBand } from '../../components/common/SearchBand'
import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildTableRows } from '../../utils/buildTableRows'

const DEF = mesScreens.systemUserPermissions

export function SystemUserPermissionsPage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } =
    useTableData(DEF.rows)

  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete)

  return (
    <section className="screenStack">
      <PermissionBoard />

      <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />

      <TablePanel
        title={`${DEF.title} 목록`}
        headers={[...DEF.columns, '관리']}
        rows={tableRows}
        totalCount={filteredRows.length}
        onRowClick={(i) => setModalRow(filteredRows[i])}
      />

      <RowDetailModal
        isOpen={modalRow !== null}
        onClose={() => setModalRow(null)}
        onSave={handleSave}
        fields={fields}
        data={modalRow ?? {}}
      />
    </section>
  )
}
