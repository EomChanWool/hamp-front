export function FieldWorkPage() {
  return (
    <section className="fieldBoard">
      <div className="fieldHero">
        <span>오늘 작업지시</span>
        <h2>WO-001 헴프오일 생산</h2>
        <p>작업자 권한 범위의 작업만 표시됩니다.</p>
      </div>
      <div className="fieldActions">
        {['작업 시작', 'LOT 스캔', '실적 입력', '불량 등록', '작업 종료'].map((action, index) => (
          <button key={action} type="button" className={index === 0 ? 'start' : ''}>
            {action}
          </button>
        ))}
      </div>
    </section>
  )
}
