type Props = {
  updatedAt: Date
}

/** 실시간(mock) 갱신 상태와 마지막 갱신 시각을 보여주는 얇은 상태 바 */
export function RealtimeStrip({ updatedAt }: Props) {
  return (
    <div className="realtimeStrip">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="liveDot" />
        <strong>실시간 mock 갱신</strong>
      </div>
      <span className="finalTime">최종 갱신시간 {updatedAt.toLocaleTimeString('ko-KR')}</span>
    </div>
  )
}