import { useState } from 'react'
import styles from './MainDashboardPage.module.css'

// ── 타입 ──────────────────────────────────────────────────────────────────────
type LineStatus = 'on' | 'off' | 'warn'

interface ProductionLine {
  id: string
  name: string
  status: LineStatus
  output: number   // kg
  target: number   // kg
  process: string
}

interface DefectStat {
  type: string
  count: number
  rate: number
  color: string
}

interface ProcessUnit {
  label: string
  status: LineStatus
}

// ── 목업 데이터 ───────────────────────────────────────────────────────────────
const FOOD_LINES: ProductionLine[] = [
  { id: 'F-L1', name: '1라인', status: 'on',   output: 1240, target: 1500, process: '세척→건조→분쇄→포장' },
  { id: 'F-L2', name: '2라인', status: 'warn', output:  820, target: 1200, process: '세척→건조→선별→포장' },
  { id: 'F-L3', name: '3라인', status: 'on',   output:  960, target: 1000, process: '추출→농축→캡슐화' },
  { id: 'F-L4', name: '4라인', status: 'off',  output:    0, target:  800, process: '오일→정제→병입' },
]

const FIBER_LINES: ProductionLine[] = [
  { id: 'I-L1', name: '1라인', status: 'on',   output: 980,  target: 1200, process: '개섬→정렬→압축→포장' },
  { id: 'I-L2', name: '2라인', status: 'on',   output: 1100, target: 1100, process: '투입→개섬→정렬→포장' },
  { id: 'I-L3', name: '3라인', status: 'off',  output:    0, target:  900, process: '압축→성형→검사' },
  { id: 'I-L4', name: '4라인', status: 'warn', output:  430, target:  800, process: '정렬→결속→출하' },
]

const FOOD_DEFECTS: DefectStat[] = [
  { type: '이물',    count: 12, rate: 2.4, color: '#10b981' },
  { type: '중량미달', count: 28, rate: 5.6, color: '#ef4444' },
  { type: '파손',    count:  9, rate: 1.8, color: '#ff8c3a' },
  { type: '색상불량', count: 15, rate: 3.0, color: '#8b5cf6' },
  { type: '포장불량', count: 18, rate: 3.6, color: '#eab308' },
  { type: '기타',    count:  5, rate: 1.0, color: '#64748b' },
]

const FIBER_DEFECTS: DefectStat[] = [
  { type: '이물혼입', count:  8, rate: 1.6, color: '#10b981' },
  { type: '중량미달', count: 22, rate: 4.4, color: '#ef4444' },
  { type: '파손',    count: 14, rate: 2.8, color: '#ff8c3a' },
  { type: '성형불량', count: 19, rate: 3.8, color: '#8b5cf6' },
  { type: '포장불량', count: 11, rate: 2.2, color: '#eab308' },
  { type: '기타',    count:  3, rate: 0.6, color: '#64748b' },
]

const FOOD_PROCESSES: ProcessUnit[] = [
  { label: '원료투입', status: 'on'   },
  { label: '세척',    status: 'on'   },
  { label: '건조',    status: 'warn' },
  { label: '분쇄',    status: 'on'   },
  { label: '선별',    status: 'on'   },
  { label: '포장',    status: 'off'  },
]

const FIBER_PROCESSES: ProcessUnit[] = [
  { label: '원료투입', status: 'on'  },
  { label: '개섬',    status: 'on'  },
  { label: '정렬',    status: 'on'  },
  { label: '압축',    status: 'on'  },
  { label: '성형',    status: 'warn'},
  { label: '포장',    status: 'on'  },
]

// ── 서브 컴포넌트들 ───────────────────────────────────────────────────────────
const statusLabel: Record<LineStatus, string> = { on: '가동중', off: '정지', warn: '주의' }
const statusClass: Record<LineStatus, string> = { on: styles.statusOn, off: styles.statusOff, warn: styles.statusWarn }
const dotClass:    Record<LineStatus, string> = { on: styles.dotOn,    off: styles.dotOff,    warn: styles.dotWarn }
const nodeClass:   Record<LineStatus, string> = { on: styles.nodeOn,   off: styles.nodeOff,   warn: styles.nodeWarn }

// 공정 흐름도
function ProcessFlow({ processes }: { processes: ProcessUnit[] }) {
  return (
    <div className={styles.processFlow}>
      {processes.map((p, i) => (
        <div key={p.label} className={styles.processStep}>
          <div className={`${styles.processNode} ${nodeClass[p.status]}`}>
            <span className={`${styles.processDot} ${dotClass[p.status]}`} />
            <span className={styles.processLabel}>{p.label}</span>
          </div>
          {i < processes.length - 1 && (
            <div className={`${styles.processArrow} ${p.status === 'off' ? styles.arrowOff : ''}`}>
              <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
                <line x1="0" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray={p.status === 'off' ? '4 3' : 'none'} />
                <polyline points="16,2 22,6 16,10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// 생산라인 카드
function LineCard({ line }: { line: ProductionLine }) {
  const pct = line.target > 0 ? Math.round((line.output / line.target) * 100) : 0
  return (
    <div className={`${styles.lineCard} ${statusClass[line.status]}`}>
      <div className={styles.lineTop}>
        <div className={styles.lineInfo}>
          <span className={`${styles.lineDot} ${dotClass[line.status]}`} />
          <span className={styles.lineName}>{line.name}</span>
          <span className={styles.lineProcess}>{line.process}</span>
        </div>
        <span className={styles.lineStatus}>{statusLabel[line.status]}</span>
      </div>
      <div className={styles.lineOutputRow}>
        <span className={styles.lineOutputVal}>{line.output.toLocaleString()} <em>kg</em></span>
        <span className={styles.lineTarget}>/ {line.target.toLocaleString()} kg</span>
        <span className={styles.linePct}>{pct}%</span>
      </div>
      <div className={styles.lineBar}>
        <div
          className={`${styles.lineBarFill} ${line.status === 'warn' ? styles.barWarn : line.status === 'off' ? styles.barOff : styles.barOn}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

// 불량률 패널
function DefectPanel({ defects }: { defects: DefectStat[] }) {
  const total  = defects.reduce((s, d) => s + d.count, 0)
  const maxCnt = Math.max(...defects.map(d => d.count), 1)
  return (
    <div className={styles.defectList}>
      {defects.map(d => (
        <div key={d.type} className={styles.defectRow}>
          <span className={styles.defectDot} style={{ background: d.color }} />
          <span className={styles.defectType}>{d.type}</span>
          <div className={styles.defectBar}>
            <div
              className={styles.defectBarFill}
              style={{
                width: `${(d.count / maxCnt) * 100}%`,
                background: `linear-gradient(90deg, ${d.color}cc, ${d.color}55)`,
              }}
            />
          </div>
          <span className={styles.defectCount} style={{ color: d.color }}>{d.count}건</span>
          <span className={styles.defectRate}>{d.rate}%</span>
        </div>
      ))}
      <div className={styles.defectSummary}>
        <span>총 불량</span>
        <strong>{total}건</strong>
        <span>평균 불량률</span>
        <strong>{(defects.reduce((s, d) => s + d.rate, 0) / defects.length).toFixed(1)}%</strong>
      </div>
    </div>
  )
}

// 공정 패널 (섹션 wrapper)
function ProcessSection({
  title,
  accent,
  lines,
  processes,
  defects,
}: {
  title: string
  accent: string
  lines: ProductionLine[]
  processes: ProcessUnit[]
  defects: DefectStat[]
}) {
  const [tab, setTab] = useState<'line' | 'defect'>('line')
  const onCount  = lines.filter(l => l.status === 'on').length
  const warnCount = lines.filter(l => l.status === 'warn').length
  const totalOut = lines.reduce((s, l) => s + l.output, 0)
  const totalTgt = lines.reduce((s, l) => s + l.target, 0)
  const eff = Math.round((totalOut / totalTgt) * 100)

  return (
    <div className={styles.section}>
      {/* 섹션 헤더 */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitleRow}>
          <span className={styles.sectionAccent} style={{ background: accent }} />
          <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
        <div className={styles.sectionKpis}>
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>가동</span>
            <strong className={styles.kpiVal} style={{ color: '#10b981' }}>{onCount}라인</strong>
          </div>
          <div className={styles.kpiDiv} />
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>주의</span>
            <strong className={styles.kpiVal} style={{ color: '#f59e0b' }}>{warnCount}라인</strong>
          </div>
          <div className={styles.kpiDiv} />
          <div className={styles.kpi}>
            <span className={styles.kpiLabel}>효율</span>
            <strong className={styles.kpiVal} style={{ color: accent }}>{eff}%</strong>
          </div>
        </div>
      </div>

      {/* 공정 흐름도 */}
      <div className={styles.flowCard}>
        <div className={styles.flowCardTitle}>공정 흐름</div>
        <ProcessFlow processes={processes} />
      </div>

      {/* 탭 */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'line' ? styles.tabActive : ''}`} style={tab === 'line' ? { borderColor: accent, color: accent } : {}} onClick={() => setTab('line')}>생산라인</button>
        <button className={`${styles.tab} ${tab === 'defect' ? styles.tabActive : ''}`} style={tab === 'defect' ? { borderColor: accent, color: accent } : {}} onClick={() => setTab('defect')}>불량현황</button>
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'line' ? (
        <div className={styles.lineList}>
          {lines.map(l => <LineCard key={l.id} line={l} />)}
        </div>
      ) : (
        <DefectPanel defects={defects} />
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────
export function MainDashboardPage() {
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>생산 대시보드</h1>
        <span className={styles.pageTime}>실시간 · {new Date().toLocaleString('ko-KR', { hour12: false })}</span>
      </div>
      <div className={styles.grid}>
        <ProcessSection
          title="식품가공공정"
          accent="#10b981"
          lines={FOOD_LINES}
          processes={FOOD_PROCESSES}
          defects={FOOD_DEFECTS}
        />
        <div className={styles.divider} />
        <ProcessSection
          title="단섬유가공공정"
          accent="#818cf8"
          lines={FIBER_LINES}
          processes={FIBER_PROCESSES}
          defects={FIBER_DEFECTS}
        />
      </div>
    </div>
  )
}
