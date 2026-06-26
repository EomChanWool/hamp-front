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

/* SVG marker — defs 내부에서는 CSS var() 미지원이므로 고정색 사용 */
const AC = '#9ca3af'
const D  = '3 2'

function Defs() {
  return (
    <defs>
      <marker id="a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M2 1L8 5L2 9" fill="none" stroke={AC} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
      <marker id="aa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M2 1L8 5L2 9" fill="none" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>
  )
}

const A = ({ x1, y1, x2, y2 }: { x1:number;y1:number;x2:number;y2:number }) =>
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={AC} strokeWidth="0.8" markerEnd="url(#a)" />

const L = ({ x1, y1, x2, y2, dash }: { x1:number;y1:number;x2:number;y2:number;dash?:boolean }) =>
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={AC} strokeWidth="0.8" strokeDasharray={dash ? D : undefined} />

const P = ({ d, dash, amber }: { d:string;dash?:boolean;amber?:boolean }) =>
  <path d={d} fill="none" stroke={amber ? '#EF9F27' : AC} strokeWidth="0.8" strokeDasharray={dash ? D : undefined} markerEnd={amber ? 'url(#aa)' : 'url(#a)'} />

/* ── 노드 컴포넌트 ── */
function Box({ x, y, w, h, label, sub, small }: { x:number;y:number;w:number;h:number;label:string;sub?:string;small?:boolean }) {
  const cx = x + w / 2
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} className="hpf__step" />
      {sub ? (
        <>
          <text x={cx} y={y+h*0.33} textAnchor="middle" dominantBaseline="central" className="hpf__lbl">{label}</text>
          <text x={cx} y={y+h*0.70} textAnchor="middle" dominantBaseline="central" className="hpf__sub">{sub}</text>
        </>
      ) : (
        <text x={cx} y={y+h/2} textAnchor="middle" dominantBaseline="central" className={small ? 'hpf__sub' : 'hpf__lbl'}>{label}</text>
      )}
    </>
  )
}

function Pill({ x, y, w, h, label, sub }: { x:number;y:number;w:number;h:number;label:string;sub?:string }) {
  const cx = x + w / 2
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(h/2,12)} className="hpf__pill" />
      {sub ? (
        <>
          <text x={cx} y={y+h*0.32} textAnchor="middle" dominantBaseline="central" className="hpf__pillLbl">{label}</text>
          <text x={cx} y={y+h*0.70} textAnchor="middle" dominantBaseline="central" className="hpf__pillLbl" style={{fontSize:8}}>{sub}</text>
        </>
      ) : (
        <text x={cx} y={y+h/2} textAnchor="middle" dominantBaseline="central" className="hpf__pillLbl">{label}</text>
      )}
    </>
  )
}

function GreenBox({ x, y, w, h, label }: { x:number;y:number;w:number;h:number;label:string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} className="hpf__pill" />
      <text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="central" className="hpf__pillLbl">{label}</text>
    </>
  )
}

function AmberBox({ x, y, w, h, label }: { x:number;y:number;w:number;h:number;label:string }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} className="hpf__amber" />
      <text x={x+w/2} y={y+h/2} textAnchor="middle" dominantBaseline="central" className="hpf__amberLbl">{label}</text>
    </>
  )
}

/* ══════════════════════════════
   식품 가공공정
   viewBox: 380 × 310  ← 실제 콘텐츠 크기에 맞춤
══════════════════════════════ */
function FoodFlow() {
  return (
    <>
      <Legend items={[
        { bg:'#1D9E75', label:'투입 원물 / 최종 제품' },
        { bg:'#f3f4f6', border:'#9ca3af', label:'공정 단계' },
        { bg:'#FAEEDA', border:'#EF9F27', dash:true, label:'부산물 처리' },
      ]} />
      <svg width="100%" viewBox="0 0 380 310" className="hpf__svg" role="img">
        <title>식품 가공공정</title>
        <Defs />

        {/* ROW 1 — 전처리  y=10 */}
        <Pill     x={2}   y={10} w={46} h={24} label="헴프 씨" />
        <Box      x={54}  y={10} w={52} h={24} label="겉피 탈피" />
        <Box      x={112} y={5}  w={52} h={34} label="세척" sub="(탈피/세척)" />
        <Box      x={170} y={10} w={40} h={24} label="건조" />
        <GreenBox x={248} y={10} w={126} h={24} label="전처리 완료된 씨드" />
        <AmberBox x={248} y={40} w={126} h={22} label="슬러지/껍질 신고반납" />

        <A x1={48}  y1={22} x2={52}  y2={22} />
        <A x1={106} y1={22} x2={110} y2={22} />
        <A x1={164} y1={22} x2={168} y2={22} />
        <A x1={210} y1={22} x2={246} y2={22} />
        {/* 건조→슬러지 amber */}
        <path d="M190 10 L190 3 L311 3 L311 38" fill="none" stroke="#EF9F27" strokeWidth="0.8" strokeDasharray={D} markerEnd="url(#aa)" />

        {/* 씨드→분기선 y=74 */}
        <L x1={311} y1={34}  x2={311} y2={74} />
        <L x1={60}  y1={74}  x2={311} y2={74} />

        {/* ROW 2 — 착유/분쇄/선별 */}
        <Box x={38}  y={74} w={44} h={24} label="착유" />
        <Box x={185} y={74} w={44} h={24} label="분쇄" />
        <Box x={286} y={74} w={44} h={24} label="선별" />
        <A x1={60}  y1={74} x2={60}  y2={76} />
        <A x1={207} y1={74} x2={207} y2={76} />
        <A x1={308} y1={74} x2={308} y2={76} />

        {/* 착유 경로 */}
        <path d="M82 86 L94 86 L94 110 L104 110" fill="none" stroke={AC} strokeWidth="0.8" markerEnd="url(#a)" />
        <Box x={104} y={100} w={52} h={24} label="열수 추출" />
        <A x1={130} y1={124} x2={130} y2={144} />
        <Box x={104} y={144} w={44} h={24} label="농축" />
        <A x1={104} y1={156} x2={90}  y2={156} />
        <L x1={60}  y1={98}  x2={60}  y2={144} />
        <Box x={38}  y={144} w={44} h={24} label="필터링" />
        <A x1={60}  y1={168} x2={60}  y2={188} />
        <Box x={36}  y={188} w={48} h={24} label="탱크저장" />

        {/* 분쇄 경로 */}
        <L x1={207} y1={98}  x2={207} y2={200} />
        <A x1={207} y1={200} x2={176} y2={200} />
        <Box x={134} y={188} w={60} h={24} label="초임계 추출" />
        <path d="M84 200 L132 200" fill="none" stroke={AC} strokeWidth="0.8" strokeDasharray={D} markerEnd="url(#a)" />

        {/* 선별→분말저장 */}
        <A x1={308} y1={98}  x2={308} y2={188} />
        <Box x={282} y={188} w={52} h={24} label="분말저장" />

        {/* ROW 4 — 포장 y=232 */}
        <Box x={30}  y={232} w={56} h={24} label="충진 / 포장" />
        <A x1={60}  y1={212} x2={60}  y2={230} />
        <path d="M164 212 L164 222 L58 222 L58 230" fill="none" stroke={AC} strokeWidth="0.8" strokeDasharray={D} markerEnd="url(#a)" />

        <Box x={270} y={232} w={56} h={24} label="계량 / 포장" />
        <A x1={308} y1={212} x2={302} y2={230} />

        {/* ROW 5 — 최종제품 y=272 */}
        <L x1={58}  y1={256} x2={58}  y2={270} />
        <L x1={14}  y1={270} x2={162} y2={270} />
        {([14, 88, 162] as number[]).map(x => <A key={x} x1={x} y1={270} x2={x} y2={274} />)}

        <L x1={298} y1={256} x2={298} y2={270} />
        <L x1={236} y1={270} x2={340} y2={270} />
        {([236, 340] as number[]).map(x => <A key={x} x1={x} y1={270} x2={x} y2={274} />)}

        {[
          { x:2,   w:42,  label:'헴프오일' },
          { x:52,  w:76,  label:'헴프박 농축액' },
          { x:134, w:72,  label:'초임계 추출물' },
          { x:210, w:72,  label:'단백질 파우더' },
          { x:298, w:60,  label:'헴프씨드' },
        ].map(p => <Pill key={p.label} x={p.x} y={274} w={p.w} h={28} label={p.label} />)}
      </svg>
    </>
  )
}

/* ══════════════════════════════
   단섬유 가공공정
   viewBox: 380 × 200
══════════════════════════════ */
function FiberFlow() {
  return (
    <>
      <Legend items={[
        { bg:'#1D9E75', label:'투입 원물 / 최종 제품' },
        { bg:'#f3f4f6', border:'#9ca3af', label:'공정 단계' },
        { bg:'transparent', border:'#9ca3af', dash:true, label:'연결 공정 경로' },
      ]} />
      <svg width="100%" viewBox="0 0 380 200" className="hpf__svg" role="img">
        <title>단섬유 가공공정</title>
        <Defs />

        {/* 줄기(인피) */}
        <Pill x={2} y={70} w={46} h={40} label="줄기" sub="(인피)" />

        {/* 스커칭 */}
        <Box x={54} y={78} w={48} h={24} label="스커칭" />
        <A x1={48} y1={90} x2={52} y2={90} />

        {/* 인피 분기 박스 */}
        <Box x={108} y={82} w={30} h={18} label="인피" small />
        <path d="M102 90 L106 90" fill="none" stroke={AC} strokeWidth="0.8" strokeDasharray={D} markerEnd="url(#a)" />

        {/* 인피→상단(정련/표백) */}
        <L x1={123} y1={82}  x2={123} y2={24} />
        <A x1={123} y1={24}  x2={155} y2={24} />

        {/* 인피→하단(개섬) 점선 */}
        <P d="M123 100 L123 150 L155 150" dash />

        {/* 압축 */}
        <Box x={54} y={138} w={48} h={24} label="압축" />
        <P d="M78 102 L78 136" dash />
        <L x1={102} y1={150} x2={121} y2={150} dash />

        {/* 상단 경로 */}
        <Box x={157} y={12} w={62} h={24} label="정련 / 표백" />
        <Box x={227} y={12} w={40} h={24} label="건조" />
        <Box x={275} y={12} w={40} h={24} label="탈수" />
        <A x1={219} y1={24} x2={225} y2={24} />
        <A x1={267} y1={24} x2={273} y2={24} />

        {/* 탈수→카딩 */}
        <path d="M295 36 L295 86 L275 86 L275 138" fill="none" stroke={AC} strokeWidth="0.8" markerEnd="url(#a)" />

        {/* 하단 경로 */}
        <Box x={157} y={138} w={40} h={24} label="개섬" />
        <Box x={205} y={138} w={40} h={24} label="개면" />
        <Box x={253} y={138} w={40} h={24} label="카딩" />
        <Box x={301} y={138} w={54} h={24} label="압축포장" />
        <A x1={197} y1={150} x2={203} y2={150} />
        <A x1={245} y1={150} x2={251} y2={150} />
        <A x1={293} y1={150} x2={299} y2={150} />

        {/* 헴프솜 */}
        <Pill x={305} y={178} w={52} h={22} label="헴프솜" />
        <A x1={328} y1={162} x2={328} y2={176} />
      </svg>
    </>
  )
}
