import { Badge } from '../../components/Badge'
import { DataTable } from '../../components/DataTable'
import { Panel } from '../../components/Panel'

export function WorkOrdersPage() {
  return (
    <section className="contentGrid two">
      <Panel title="작업지시">
        <DataTable
          headers={['WO', '품목', '상태', '설비', '작업자']}
          rows={[
            ['WO-001', '헴프오일', <Badge tone="warn">대기</Badge>, 'EQ-EXT-001', '김작업'],
            ['WO-002', '섬유', <Badge tone="good">진행</Badge>, 'EQ-CARD-001', '박작업'],
          ]}
        />
      </Panel>
      <Panel title="작업지시 상세" action="작업 시작">
        <div className="detailList">
          <div>
            <span>원료 LOT</span>
            <strong>RAW-001, RAW-002</strong>
          </div>
          <div>
            <span>라우팅</span>
            <strong>세척 → 건조 → 추출 → 포장</strong>
          </div>
          <div>
            <span>상태변경</span>
            <strong>시작 / 일시정지 / 완료</strong>
          </div>
        </div>
      </Panel>
    </section>
  )
}
