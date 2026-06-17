import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

export function AlarmsPage() {
  return (
    <ManagementScreen
      title="알람 관리"
      filters={['등급', '설비', '발생시간', '상태']}
      primary="선택 확인"
      table={{
        headers: ['등급', '설비', '내용', '상태', '조치'],
        rows: [
          ['HIGH', '카딩기', '모터 과부하', <Badge tone="danger">미확인</Badge>, '확인'],
          ['MED', '추출기', '온도 상한', <Badge tone="warn">조치중</Badge>, '상세'],
          ['LOW', '포장기', '필름 부족', <Badge tone="muted">해제</Badge>, '보기'],
        ],
      }}
    />
  )
}
