import { mesScreens } from '../../data/mesScreens'
import { RowDetailModal } from '../../components/RowDetailModal'
import { SearchBand } from '../../components/common/SearchBand'
import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildDeliveryTableRows } from '../../utils/buildDeliveryTableRows'

const DEF = mesScreens.deliveryStatus 

export function DeliveryStatusPage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleSave } = useTableData(DEF.rows)
  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildDeliveryTableRows(filteredRows, DEF.columns)   
  return (
    <section className="screenStack">
        <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />
        <TablePanel 
          title={`${DEF.title} 목록`} 
          headers={DEF.columns} 
          rows={tableRows} 
          totalCount={filteredRows.length} 
          action="등록" 
          onAction={() => setModalRow({})} 
          onRowClick={(i) => setModalRow(filteredRows[i])} 
        />       
        <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={handleSave} fields={fields} data={modalRow ?? {}} />
    </section>
  )
}