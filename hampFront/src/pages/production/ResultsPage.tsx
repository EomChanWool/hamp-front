import { Panel } from '../../components/Panel'

export function ResultsPage() {
  return (
    <Panel title="공정실적 등록" action="실적 저장">
      <div className="formGrid">
        {['공정', '시작시간', '종료시간', '양품수량', '불량수량', '폐기수량', '불량코드', '비고'].map((field) => (
          <label key={field}>
            {field}
            <input placeholder={`${field} 입력`} />
          </label>
        ))}
      </div>
    </Panel>
  )
}
