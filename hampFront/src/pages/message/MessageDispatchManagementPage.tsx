import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

export function MessageDispatchManagementPage() {
  return (
    <ManagementScreen
      title="문자발송관리"
      filters={['수신자', '발송구분', '발송상태', '기간']}
      primary="문자이력 조회"
      table={{
        headers: ['발송시간', '수신자', '발송구분', '내용', '상태'],
        rows: [
          ['2026-06-18 09:20', '운영관리자 그룹', '장비 이상 알림', '설비 이상 유무 확인 요청', <Badge tone="good">성공</Badge>],
          ['2026-06-18 09:05', 'quality01', '품질 알림', '검사 대기 건 확인 요청', <Badge tone="good">성공</Badge>],
          ['2026-06-18 08:48', 'manager01', '출입 알림', '원료 반입구 열림 상태 지속', <Badge tone="warn">재시도</Badge>],
        ],
      }}
    >
      <div className="noteBox">발송한 문자이력 목록을 표출합니다.</div>
    </ManagementScreen>
  )
}
