import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function DataManagementPage() {
  return (
    <ManagementScreen
      title="데이터관리"
      filters={['데이터명', '유형', '처리상태', '기간']}
      primary="데이터 저장/출력"
      table={{
        headers: ['관리 항목', '주요 기능', '상태', '처리'],
        rows: [
          ['데이터 목록조회', '수집/가공 데이터 목록 조회', <Badge tone="info">조회</Badge>, '조회'],
          ['데이터 추출/삭제', '조건별 데이터 추출 및 삭제', <Badge tone="warn">관리</Badge>, '실행'],
          ['데이터 시각처리', '차트/그래프 기반 시각 처리', <Badge tone="good">가능</Badge>, '보기'],
          ['데이터 파일변환', '파일 포맷 변환 처리', <Badge tone="good">가능</Badge>, '변환'],
          ['데이터 저장/출력', '데이터 저장 및 출력물 생성', <Badge tone="info">출력</Badge>, '출력'],
        ],
      }}
    >
      <StepFlow steps={['데이터 목록조회', '데이터 추출/삭제', '데이터 시각처리', '데이터 파일변환', '데이터 저장/출력']} />
    </ManagementScreen>
  )
}
