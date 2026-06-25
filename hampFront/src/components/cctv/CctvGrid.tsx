import { useState, useEffect } from 'react'
import { Badge } from '../Badge'
import { getStatusTone } from '../../data/mesScreens'
import type { MesRow } from '../../data/mesScreens'

type Props = {
  rows: MesRow[]
}

function useClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('ko-KR'))
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTime(new Date().toLocaleTimeString('ko-KR'))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])
  return time
}

export function CctvGrid({ rows }: Props) {
  const time = useClock()

  return (
    <section className="cctvGrid">
      {rows.map((row, index) => (
        <div className="cctvCard" key={row.c0}>
          <div className={`cctvFrame ${index % 3 === 2 ? 'offline' : ''}`}>
            <div className="cctvOverlay">
              <span className="recDot" />
              <span className="recText">LIVE</span>
            </div>
            <div className="cameraLabel">{row.c0}</div>
            <div className="cameraTime">{time}</div>
          </div>

          <div className="cctvBody">
            <div className="titleRow">
              <div>
                <h4>{row.c0}</h4>
                <p>{row.c1}</p>
              </div>
              <Badge tone={getStatusTone(row.c2)}>{row.c2}</Badge>
            </div>
            <div className="infoRow">
              <div className="infoItem">
                <span>최근 감지</span>
                <strong>{row.c3}</strong>
              </div>
              <div className="infoItem">
                <span>상태</span>
                <strong>{row.c2}</strong>
              </div>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}