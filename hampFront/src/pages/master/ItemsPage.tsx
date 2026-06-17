import { ManagementScreen } from '../../components/ManagementScreen'
import { StepFlow } from '../../components/StepFlow'

export function ItemsPage() {
  return (
    <ManagementScreen
      title="품목/라우팅"
      filters={['품목구분', '라우팅', '사용여부']}
      primary="품목 등록"
      table={{
        headers: ['품목코드', '구분', '기본단위', '라우팅'],
        rows: [
          ['RAW-HEMP', '원료', 'kg', '식품가공'],
          ['OIL-001', '완제품', 'L', '추출/포장'],
          ['FIBER-001', '반제품', 'kg', '섬유가공'],
        ],
      }}
    >
      <StepFlow steps={['원료', '세척', '건조', '추출', '포장', '완제품']} />
    </ManagementScreen>
  )
}
