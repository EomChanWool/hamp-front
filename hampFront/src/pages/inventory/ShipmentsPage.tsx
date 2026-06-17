import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function ShipmentsPage() {
  return (
    <ManagementScreen
      title="출고 관리"
      filters={['출고일', '거래처', '상태']}
      primary="출고 요청"
      table={{
        headers: ['출고번호', '제품 LOT', '수량', '거래처', '상태'],
        rows: [
          ['SH-001', 'FIN-001', '80L', '기관A', <Badge tone="warn">대기</Badge>],
          ['SH-002', 'FIN-002', '120kg', '기관B', <Badge tone="good">확정</Badge>],
        ],
      }}
    >
      <StepFlow steps={['출고요청', 'LOT선택', '검수', '출고확정', '재고차감']} />
    </ManagementScreen>
  )
}
