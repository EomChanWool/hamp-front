import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function MenuInfoManagementPage() {
  return (
    <ManagementScreen
      title="메뉴 정보 관리"
      filters={['메뉴명', '권한', '사용자', '시스템 코드']}
      primary="메뉴 정보 저장"
      table={{
        headers: ['관리 항목', '대상', '상태', '처리'],
        rows: [
          ['메뉴 정보 관리', '대메뉴/하위메뉴 구성', <Badge tone="good">관리중</Badge>, '수정'],
          ['메뉴 접근 권한 관리', '메뉴별 접근 권한', <Badge tone="warn">검토</Badge>, '권한 설정'],
          ['사용자 권한 정보 관리', '사용자별 권한 매핑', <Badge tone="good">관리중</Badge>, '수정'],
          ['시스템 코드 정보 관리', '공통 코드/상태 코드', <Badge tone="info">조회</Badge>, '관리'],
        ],
      }}
    >
      <StepFlow steps={['메뉴 정보 관리', '메뉴 접근 권한 관리', '사용자 권한 정보 관리', '시스템 코드 정보 관리']} />
    </ManagementScreen>
  )
}
