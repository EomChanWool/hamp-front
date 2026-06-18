import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function AccessPermissionPage() {
  return (
    <ManagementScreen
      title="접근권한"
      filters={['그룹', '사용자', '메뉴', '발송상태']}
      primary="문자 발송"
      table={{
        headers: ['구분', '대상', '관리 항목', '상태', '처리'],
        rows: [
          ['그룹', '운영관리자', '그룹별 문자 발송', <Badge tone="good">가능</Badge>, '발송'],
          ['사용자', 'quality01', '사용자별 문자 발송', <Badge tone="good">가능</Badge>, '발송'],
          ['이력', '최근 30일', '문자 발송 이력관리', <Badge tone="info">조회</Badge>, '상세'],
          ['메뉴', '접근권한관리', '메뉴 정보 관리', <Badge tone="warn">검토</Badge>, '수정'],
        ],
      }}
    >
      <StepFlow steps={['그룹별/사용자별 문자 발송', '문자 발송 이력관리', '메뉴 정보 관리']} />
    </ManagementScreen>
  )
}
