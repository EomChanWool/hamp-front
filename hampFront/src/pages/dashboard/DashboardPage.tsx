import { Badge } from '../../components/Badge'
import { DataTable } from '../../components/DataTable'
import { Panel } from '../../components/Panel'
import { dashboardCards, progressOrders } from '../../data/mockData'
import type { ScreenKey } from '../../types'

type DashboardPageProps = {
  setActiveScreen: (key: ScreenKey) => void
}

export function DashboardPage({ setActiveScreen }: DashboardPageProps) {
  return (
    <div className="screenStack">
      <section className="metricGrid">
        {dashboardCards.map((card) => (
          <article key={card.label} className={`metricCard ${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="contentGrid two">
        <Panel title="생산 진행률" action="작업지시 보기" onAction={() => setActiveScreen('productionWorkOrders')}>
          <div className="progressList">
            {progressOrders.map((order) => (
              <div key={order.code} className="progressRow">
                <div>
                  <strong>{order.code}</strong>
                  <span>{order.item}</span>
                </div>
                <div className="progressBar">
                  <i style={{ width: `${order.rate}%` }} />
                </div>
                <em>{order.status}</em>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="실시간 알림" action="이상 알림 보기" onAction={() => setActiveScreen('equipmentAlerts')}>
          <DataTable
            headers={['등급', '설비', '내용', '상태']}
            rows={[
              ['HIGH', '추출기', '온도 상한', <Badge tone="danger">미확인</Badge>],
              ['MED', '카딩기', '모터 과부하', <Badge tone="warn">조치중</Badge>],
              ['LOW', '원료창고', '재고 부족', <Badge tone="info">알림</Badge>],
            ]}
          />
        </Panel>
      </section>
    </div>
  )
}
