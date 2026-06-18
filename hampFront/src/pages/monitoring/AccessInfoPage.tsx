import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

export function AccessInfoPage() {
  return (
    <ManagementScreen
      title="가공동 출입구 개폐 여부"
      filters={['출입구', '상태', '발생시간', '확인여부']}
      primary="출입 이력 내보내기"
      table={{
        headers: ['출입구', '상태', '최종 변경', '확인'],
        rows: [
          ['가공동 정문', <Badge tone="good">닫힘</Badge>, '2026-06-18 09:12', '정상'],
          ['원료 반입구', <Badge tone="warn">열림</Badge>, '2026-06-18 09:08', '확인 필요'],
          ['비상 출입구', <Badge tone="good">닫힘</Badge>, '2026-06-18 08:55', '정상'],
        ],
      }}
    >
      <div className="noteBox">가공동 출입구 개폐 여부를 표출합니다.</div>
    </ManagementScreen>
  )
}
