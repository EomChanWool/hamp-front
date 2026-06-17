import { Panel } from '../../components/Panel'
import { StepFlow } from '../../components/StepFlow'

export function EquipmentDetailPage() {
  return (
    <section className="contentGrid two">
      <Panel title="장비 상세">
        <div className="sensorPanel">
          {[
            ['온도', '72℃'],
            ['압력', '1.8bar'],
            ['전류', '14.2A'],
            ['진동', '0.04mm/s'],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="운영 상태">
        <StepFlow steps={['화면진입', '권한확인', '상태조회', '센서표시', '알람확인']} />
        <div className="noteBox">장비별 세부 데이터는 사용자 권한 확인 후 조회됩니다.</div>
      </Panel>
    </section>
  )
}
