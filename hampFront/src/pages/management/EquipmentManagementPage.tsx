import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function EquipmentManagementPage() {
  return (
    <ManagementScreen
      title="장비관리"
      filters={['장비', '운행상태', '장애상태', '기간']}
      primary="장비 정보 관리"
      table={{
        headers: ['장비', '관리 항목', '현재 상태', '최근 갱신', '처리'],
        rows: [
          ['추출기 EX-01', '장비 정보 관리', <Badge tone="good">정상</Badge>, '2026-06-18 09:20', '수정'],
          ['건조기 DR-02', '장비 운행정보 관리', <Badge tone="warn">점검</Badge>, '2026-06-18 09:12', '상세'],
          ['포장기 PK-01', '장애 및 수리정보 관리', <Badge tone="good">정상</Badge>, '2026-06-18 09:05', '이력'],
          ['혼합기 MX-01', '장비별 가동현황 표출', <Badge tone="info">집계</Badge>, '2026-06-18 09:00', '그래프'],
          ['압축기 CP-01', '장비별 가동률 표출', <Badge tone="info">집계</Badge>, '2026-06-18 08:58', '그래프'],
          ['CCTV 모듈', '설비 및 장비 이상 유무 알림', <Badge tone="danger">알림</Badge>, '2026-06-18 08:51', '확인'],
        ],
      }}
    >
      <StepFlow
        steps={[
          '장비 정보 관리',
          '장비 운행정보 관리',
          '장애 및 수리정보 관리',
          '장비별 가동현황 표출(표/그래프)',
          '장비별 가동률 표출(표/그래프)',
          '설비 및 장비 이상 유무 알림',
        ]}
      />
    </ManagementScreen>
  )
}
