import { mesScreens } from '@/data/mesScreens'
// import { RowDetailModal } from '@components/common/RowDetailModal'
import { CctvGrid } from '@components/cctv/CctvGrid'
// import { SearchBand } from '@components/search/SearchBand'
// import { useSearchFields } from '@/hooks/useSearchFields'
// import { TablePanel } from '@components/table/TablePanel'
import { useTableData } from '@/hooks/useTableData'
import { buildTableRows } from '@/utils/buildTableRows'

const DEF = mesScreens.facilityCctv

export function FacilityCctvPage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } =
    useTableData(DEF.rows)
  // const { fields: searchFields, getValue, resetFields } = useSearchFields(DEF.filters)

  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete, DEF.columns)

  return (
    <section className="screenStack">
      <CctvGrid rows={filteredRows} />
      {/* <SearchBand fields={searchFields} onSearch={() => setKeyword(getValue())} onReset={() => { resetFields(); setKeyword('') }} />
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
