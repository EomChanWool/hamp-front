import { useState } from 'react'
import './Equipment.css'

type TabId = 'food' | 'fiber'

export function EquipmentOperationStatusPage() {
  const [tab, setTab] = useState<TabId>('food')
  return (
    <section className="screenStack">
      <div className="hpf">
        <div className="hpf__tabbar">
          <button className={`hpf__tab${tab === 'food' ? ' hpf__tab--on' : ''}`} onClick={() => setTab('food')}>식품 가공공정</button>
          <button className={`hpf__tab${tab === 'fiber' ? ' hpf__tab--on' : ''}`} onClick={() => setTab('fiber')}>단섬유 가공공정</button>
        </div>
        <div className="hpf__panel">
          {tab === 'food' ? <FoodFlow /> : <FiberFlow />}
        </div>
      </div>
    </section>
  )
}

function Legend({ items }: { items: { bg: string; border?: string; dash?: boolean; label: string }[] }) {
  return (
    <div className="hpf__legend">
      {items.map((it, i) => (
        <div key={i} className="hpf__leg">
          <span className="hpf__legDot" style={{ background: it.bg, border: it.border ? `1px ${it.dash ? 'dashed' : 'solid'} ${it.border}` : undefined }} />
          {it.label}
        </div>
      ))}
    </div>
  )
}

const Box = ({ label, sub }: { label: string; sub?: string }) => (
  <div className="flow__node flow__box">
    <span>{label}</span>
    {sub && <span className="flow__sub">{sub}</span>}
  </div>
)
const Pill = ({ label }: { label: string }) => (
  <div className="flow__node flow__pill">{label}</div>
)
const Amber = ({ label }: { label: string }) => (
  <div className="flow__node flow__amber">{label}</div>
)
const Arr = () => <span className="flow__arr">→</span>
const ArrD = () => <div className="flow__arrD">↓</div>
const ArrDash = () => <span className="flow__arr flow__arr--dash">⇢</span>

/* ══════════════════════════════
   식품 가공공정
══════════════════════════════ */
function FoodFlow() {
  return (
    <div className="flow">
      <Legend items={[
        { bg: '#1D9E75', label: '투입 원물 / 최종 제품' },
        { bg: 'var(--bg-surface, #f9fafb)', border: '#9ca3af', label: '공정 단계' },
        { bg: '#FAEEDA', border: '#EF9F27', dash: true, label: '부산물 처리' },
      ]} />

      {/* ── 1행: 전처리 ── */}
      <div className="flow__row">
        <Pill label="헴프 씨" />
        <Arr />
        <Box label="겉피 탈피" />
        <Arr />
        <Box label="세척" sub="(탈피/세척)" />
        <Arr />
        <Box label="건조" />
        <Arr />
        <div className="flow__node flow__pill" style={{ flex: 1, maxWidth: 200 }}>전처리 완료된 씨드</div>
        <div style={{ marginLeft: 12 }}>
          <Amber label="슬러지/껍질 신고반납" />
        </div>
      </div>

      {/* ── 2행: 착유/분쇄/선별 분기 ── */}
      <div className="flow__midSection">
        {/* 착유 계열 */}
        <div className="flow__col">
          <ArrD />
          <Box label="착유" />
          <div className="flow__col__branch">
            <div className="flow__col">
              <ArrD />
              <Box label="필터링" />
              <ArrD />
              <Box label="탱크저장" />
              <ArrD />
              <Box label="충진 / 포장" />
            </div>
            <div className="flow__col" style={{ marginLeft: 8 }}>
              <ArrD />
              <Box label="열수 추출" />
              <ArrD />
              <Box label="농축" />
              <div style={{ height: 42 }} />
            </div>
          </div>
        </div>

        <div className="flow__midSep" />

        {/* 분쇄 계열 */}
        <div className="flow__col">
          <ArrD />
          <Box label="분쇄" />
          <ArrD />
          <Box label="초임계 추출" />
          <ArrD />
          <Box label="계량 / 포장" />
        </div>

        <div className="flow__midSep" />

        {/* 선별 계열 */}
        <div className="flow__col">
          <ArrD />
          <Box label="선별" />
          <ArrD />
          <Box label="분말저장" />
          <ArrD />
          <Box label="계량 / 포장" />
        </div>
      </div>

      {/* ── 3행: 최종 제품 ── */}
      <div style={{ marginTop: 8 }}>
        <div className="flow__products">
          {['헴프오일', '헴프박 농축액', '초임계 추출물', '단백질 파우더', '헴프씨드'].map(p => (
            <Pill key={p} label={p} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════
   단섬유 가공공정
══════════════════════════════ */
function FiberFlow() {
  return (
    <div className="flow">
      <Legend items={[
        { bg: '#1D9E75', label: '투입 원물 / 최종 제품' },
        { bg: 'var(--bg-surface, #f9fafb)', border: '#9ca3af', label: '공정 단계' },
        { bg: 'transparent', border: '#9ca3af', dash: true, label: '연결 공정 경로' },
      ]} />

      <div className="flow__fiberWrap">
        {/* 왼쪽 원물 */}
        <div className="flow__fiberLeft">
          <Pill label="줄기 (인피)" />
        </div>

        <Arr />

        {/* 오른쪽 공정 */}
        <div className="flow__fiberRight">
          {/* 상단 경로: 스커칭 → 정련/표백 → 건조 → 탈수 */}
          <div className="flow__row" style={{ marginBottom: 8 }}>
            <Box label="스커칭" />
            <ArrDash />
            <Box label="정련 / 표백" />
            <Arr />
            <Box label="건조" />
            <Arr />
            <Box label="탈수" />
          </div>

          {/* 하단 경로: 인피 분기 → 개섬 → 개면 → 카딩 → 압축포장 → 헴프솜 */}
          <div className="flow__row">
            <Box label="압축" />
            <ArrDash />
            <div className="flow__node flow__box" style={{ fontSize: 11, padding: '4px 10px' }}>인피</div>
            <ArrDash />
            <Box label="개섬" />
            <Arr />
            <Box label="개면" />
            <Arr />
            <Box label="카딩" />
            <Arr />
            <Box label="압축포장" />
            <Arr />
            <Pill label="헴프솜" />
          </div>
        </div>
      </div>
    </div>
  )
}
