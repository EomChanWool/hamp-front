import { Badge } from '../../components/Badge'
import { ManagementScreen } from '../../components/ManagementScreen'

export function EnvironmentInfoPage() {
  return (
    <ManagementScreen
      title="센터 내외부 환경정보"
      filters={['구역', '센서', '상태', '측정시간']}
      primary="환경 리포트"
      table={{
        headers: ['구역', '온도', '습도', '미세먼지', '상태'],
        rows: [
          ['센터 내부', '23.4℃', '48%', '12㎍/㎥', <Badge tone="good">정상</Badge>],
          ['가공동', '25.1℃', '52%', '18㎍/㎥', <Badge tone="good">정상</Badge>],
          ['센터 외부', '28.0℃', '61%', '34㎍/㎥', <Badge tone="warn">주의</Badge>],
        ],
      }}
    >
      <div className="noteBox">센터 내외부 환경정보를 표출합니다.</div>
    </ManagementScreen>
  )
}
