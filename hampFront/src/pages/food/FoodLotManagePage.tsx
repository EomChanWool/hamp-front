import { mesScreens, getStatusTone } from '../../data/mesScreens'
import { RowDetailModal } from '../../components/RowDetailModal'
import { Badge } from '../../components/Badge'
import { Panel } from '../../components/Panel'
import { SearchBand } from '../../components/common/SearchBand'
import { TablePanel } from '../../components/table/TablePanel'
import { useTableData } from '../../hooks/useTableData'
import { buildTableRows } from '../../utils/buildTableRows'

const DEF = mesScreens.foodLotManage

export function FoodLotManagePage() {
  const { filteredRows, setKeyword, modalRow, setModalRow, handleDelete, handleSave } = useTableData(DEF.rows)
  const fields = DEF.columns.map((label, i) => ({ label, key: `c${i}` }))
  const tableRows = buildTableRows(filteredRows, DEF.columns.length, setModalRow, handleDelete)
  return (
    <section className="screenStack">
      {DEF.panels?.map((panel) => (
        <Panel key={panel.title} title={panel.title}>
          <div className="timelineList">
            {panel.items.map((item, index) => (
              <div key={item.label} className="timelineItem">
                <span>{index + 1}</span>
                <strong>{item.label}</strong>
                <Badge tone={item.tone ?? getStatusTone(item.value)}>{item.value}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      ))}
      <SearchBand filters={DEF.filters} onSearch={setKeyword} onReset={() => setKeyword('')} />
      <TablePanel title={`${DEF.title} 목록`} headers={[...DEF.columns, '관리']} rows={tableRows} totalCount={filteredRows.length} action="등록" onAction={() => window.alert('mock 동작입니다.')} onRowClick={(i) => setModalRow(filteredRows[i])} />
      <RowDetailModal isOpen={modalRow !== null} onClose={() => setModalRow(null)} onSave={handleSave} fields={fields} data={modalRow ?? {}} />
    </section>
  )
}
