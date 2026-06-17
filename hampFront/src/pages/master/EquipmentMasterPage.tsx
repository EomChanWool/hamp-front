import { DataTable } from '../../components/DataTable'
import { Panel } from '../../components/Panel'

export function EquipmentMasterPage() {
  return (
    <section className="contentGrid two">
      <Panel title="설비 기준정보" action="설비 등록">
        <DataTable
          headers={['설비코드', '공정', '라인', '상태']}
          rows={[
            ['EQ-WASH-001', '세척', 'A', '사용'],
            ['EQ-DRY-001', '건조', 'A', '사용'],
            ['EQ-EXT-001', '추출', 'B', '사용'],
            ['EQ-CARD-001', '카딩', 'C', '점검'],
          ]}
        />
      </Panel>
      <Panel title="창고/위치" action="위치 등록">
        <div className="locationGrid">
          {['원료창고 A-01', '반제품 B-02', '완제품 C-01', '부적합 Z-01'].map((place) => (
            <span key={place}>{place}</span>
          ))}
        </div>
      </Panel>
    </section>
  )
}
