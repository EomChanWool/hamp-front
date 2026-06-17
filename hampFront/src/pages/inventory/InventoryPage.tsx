import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function InventoryPage() {
  return (
    <ManagementScreen
      title="재고 조회"
      filters={['LOT', '품목', '창고/위치', '상태']}
      primary="재고 조정 요청"
      table={{
        headers: ['LOT', '품목', '위치', '현재고', '상태'],
        rows: [
          ['LOT-RAW-001', '헴프 원료', 'A-01', '120kg', <Badge tone="good">정상</Badge>],
          ['LOT-OIL-003', '추출물', 'B-02', '18L', <Badge tone="warn">부족</Badge>],
          ['LOT-FIB-010', '섬유', 'C-01', '80kg', <Badge tone="good">정상</Badge>],
        ],
      }}
    >
      <StepFlow steps={['입고', '투입', '생산', '이동', '조정', '출고']} />
    </ManagementScreen>
  )
}
