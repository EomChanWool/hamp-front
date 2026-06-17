import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function PlansPage() {
  return (
    <ManagementScreen
      title="생산계획"
      filters={['계획일', '품목', '상태']}
      primary="계획작성"
      table={{
        headers: ['일자', '품목', '목표', '라우팅', '상태'],
        rows: [
          ['06-16', '헴프오일', '200L', '추출/포장', <Badge tone="good">확정</Badge>],
          ['06-17', '섬유', '400kg', '개섬/정렬', <Badge tone="info">작성</Badge>],
        ],
      }}
    >
      <StepFlow steps={['계획작성', '계획확정', '작업지시 생성', '실적비교']} />
    </ManagementScreen>
  )
}
