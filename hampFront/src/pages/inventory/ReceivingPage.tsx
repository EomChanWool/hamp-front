import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function ReceivingPage() {
  return (
    <ManagementScreen
      title="원료 입고"
      filters={['입고일', '검수상태', '품목']}
      primary="입고 등록"
      table={{
        headers: ['입고번호', '품목', '수량', '검수', 'LOT'],
        rows: [
          ['IN-001', '헴프 원료', '500kg', <Badge tone="warn">대기</Badge>, '-'],
          ['IN-002', '단섬유 원료', '300kg', <Badge tone="good">합격</Badge>, 'LOT-002'],
        ],
      }}
    >
      <StepFlow steps={['입고등록', '검수', 'LOT생성', '재고등록', '라벨출력']} />
    </ManagementScreen>
  )
}
