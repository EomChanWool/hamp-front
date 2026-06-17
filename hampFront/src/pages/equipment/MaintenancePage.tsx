import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function MaintenancePage() {
  return (
    <ManagementScreen
      title="장비 보전"
      filters={['설비', '유형', '상태', '담당자']}
      primary="점검 등록"
      table={{
        headers: ['설비', '유형', '상태', '담당자'],
        rows: [
          ['EQ-EXT-001', '정기점검', <Badge tone="info">예정</Badge>, '이설비'],
          ['EQ-CARD-001', '고장', <Badge tone="warn">진행</Badge>, '박보전'],
        ],
      }}
    >
      <StepFlow steps={['점검계획', '점검등록', '고장접수', '수리진행', '완료']} />
    </ManagementScreen>
  )
}
