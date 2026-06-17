import { Panel } from '../../components/Panel'
import { StepFlow } from '../../components/StepFlow'

export function LotTracePage() {
  return (
    <section className="contentGrid two">
      <Panel title="LOT 추적">
        <StepFlow steps={['RAW-001', 'WO-001', '세척', '건조', '추출', 'FIN-001']} />
      </Panel>
      <Panel title="추적 상세">
        <div className="summaryList">
          {['투입 원료 LOT 2건', '작업자 1명 / 설비 3대', '품질검사 합격 / 알람 없음', '출고 이력 1건'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </Panel>
    </section>
  )
}
