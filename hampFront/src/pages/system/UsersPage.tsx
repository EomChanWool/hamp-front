import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function UsersPage() {
  return (
    <ManagementScreen
      title="사용자 관리"
      filters={['권한구분', '상태', '사용자명']}
      primary="사용자 생성"
      table={{
        headers: ['사용자', '접근그룹', '상태', '관리'],
        rows: [
          ['kim', 'WORKER', <Badge tone="good">정상</Badge>, '수정'],
          ['park', 'QUALITY', <Badge tone="danger">잠금</Badge>, '해제'],
          ['admin', 'SUPER', <Badge tone="info">보호</Badge>, '보호'],
        ],
      }}
    >
      <StepFlow steps={['사용자 생성', '임시 PW', '접근그룹 부여', '최초변경', '감사로그']} />
    </ManagementScreen>
  )
}
