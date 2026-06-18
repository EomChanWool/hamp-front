import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function UsersPage() {
  return (
    <ManagementScreen
      title="관리자관리"
      filters={['관리자명', '권한구분', '상태']}
      primary="관리자 등록"
      table={{
        headers: ['관리자 ID', '관리자명', '권한', '상태', '관리'],
        rows: [
          ['admin', '시스템 관리자', 'SUPER', <Badge tone="info">보호</Badge>, '상세'],
          ['manager01', '운영 관리자', 'ADMIN', <Badge tone="good">정상</Badge>, '수정'],
          ['quality01', '품질 관리자', 'QUALITY', <Badge tone="good">정상</Badge>, '삭제'],
        ],
      }}
    >
      <StepFlow steps={['관리자 정보 목록 조회', '관리자 정보 등록/수정/삭제', '관리자 정보 상세보기']} />
    </ManagementScreen>
  )
}
