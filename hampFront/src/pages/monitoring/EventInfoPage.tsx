import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

export function EventInfoPage() {
  return (
    <ManagementScreen
      title="이벤트 발생 이력"
      filters={['이벤트', '등급', '발생위치', '기간']}
      primary="이력 내보내기"
      table={{
        headers: ['발생시간', '등급', '위치', '내용', '상태'],
        rows: [
          ['2026-06-18 09:15', 'INFO', '센터 내부', '환경정보 수집 완료', <Badge tone="good">완료</Badge>],
          ['2026-06-18 09:08', 'WARN', '원료 반입구', '출입구 열림 상태 지속', <Badge tone="warn">확인중</Badge>],
          ['2026-06-18 08:42', 'INFO', '가공동', '설비 데이터 동기화', <Badge tone="muted">기록</Badge>],
        ],
      }}
    >
      <div className="noteBox">이벤트 발생 이력을 표출합니다.</div>
    </ManagementScreen>
  )
}
