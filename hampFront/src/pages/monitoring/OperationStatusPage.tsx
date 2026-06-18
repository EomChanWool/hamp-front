import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

export function OperationStatusPage() {
  return (
    <ManagementScreen
      title="가공설비 가동 현황"
      filters={['설비', '가동상태', '가동기간', '라인']}
      primary="가동 기간 리포트"
      table={{
        headers: ['설비', '라인', '가동상태', '가동시간', '가동률'],
        rows: [
          ['추출기 EX-01', '가공 1라인', <Badge tone="good">가동</Badge>, '06:42', '94%'],
          ['건조기 DR-02', '가공 2라인', <Badge tone="warn">대기</Badge>, '03:18', '62%'],
          ['포장기 PK-01', '포장 라인', <Badge tone="good">가동</Badge>, '07:05', '97%'],
        ],
      }}
    >
      <div className="noteBox">가공설비 가동 현황 정보와 가공설비 가동 기간을 표출합니다.</div>
    </ManagementScreen>
  )
}
