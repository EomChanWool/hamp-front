import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function SecurityPage() {
  return (
    <ManagementScreen
      title="감사로그"
      filters={['기간', '사용자', '행위', '결과']}
      primary="보안 이벤트 조회"
      table={{
        headers: ['시간', '사용자', '행위', '대상', '결과'],
        rows: [
          ['09:12', 'admin', '권한변경', 'user12', <Badge tone="good">성공</Badge>],
          ['09:20', 'kim', '로그인실패', '-', <Badge tone="danger">잠금</Badge>],
          ['09:31', 'park', '장비접근요청', 'EQ-001', <Badge tone="info">허용</Badge>],
        ],
      }}
    >
      <StepFlow steps={['탐지', '기록', '조회', '알림', '대응']} />
    </ManagementScreen>
  )
}
