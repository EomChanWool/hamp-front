import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function QualityPage() {
  return (
    <ManagementScreen
      title="품질관리"
      filters={['검사구분', '품목', '판정']}
      primary="검사 등록"
      table={{
        headers: ['항목', '기준', '결과', '판정'],
        rows: [
          ['수분', '≤ 10%', '8.7%', <Badge tone="good">합격</Badge>],
          ['온도', '65~75℃', '76℃', <Badge tone="warn">확인</Badge>],
          ['이물', '없음', '없음', <Badge tone="good">합격</Badge>],
        ],
      }}
    >
      <StepFlow steps={['입고검사', '공정검사', '완제품검사', 'HACCP/CCP', 'CIP']} />
    </ManagementScreen>
  )
}
