import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function FacilityManagementPage() {
  return (
    <ManagementScreen
      title="시설관리"
      filters={['가공동', '정보구분', '기간', '권한']}
      primary="시설 데이터 관리"
      table={{
        headers: ['구분', '대상', '관리 정보', '상태', '처리'],
        rows: [
          ['실시간', '가공동별 출입', '출입 실시간 정보 표출', <Badge tone="good">표출중</Badge>, '상세'],
          ['실시간', '가공동별 환경', '환경 실시간 정보 표출', <Badge tone="good">표출중</Badge>, '상세'],
          ['이력', '출입/환경', '출입 및 환경 이력 조회', <Badge tone="info">조회</Badge>, '조회'],
          ['권한', '데이터 다운로드/열람', '데이터 다운 및 열람 권한 부여', <Badge tone="warn">관리</Badge>, '수정'],
          ['지도', '설비 가동현황 실시간 정보', '가동현황 실시간 정보 표출', <Badge tone="good">표출중</Badge>, '보기'],
          ['CCTV', '전체/상세 영상', 'CCTV 전체 영상 및 상세 표출', <Badge tone="info">연결</Badge>, '보기'],
        ],
      }}
    >
      <StepFlow
        steps={[
          '가공동별 출입 실시간 정보 표출',
          '가공동별 환경 실시간 정보 표출',
          '가공동별 출입/환경 이력 조회',
          '데이터 다운 및 열람 권한 부여',
          '설비 가동현황 실시간 정보 표출',
          'CCTV 전체/상세 영상 표출',
        ]}
      />
    </ManagementScreen>
  )
}
