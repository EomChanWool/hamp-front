
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend, 
  // BarChart,
  // Bar,
  // Cell
} from 'recharts';
import { Panel } from '../Panel'


const MOCK_DATA = {
  // 1. 씨드 입고 페이지용 데이터
  seedInbound: {
    time: [
      { time: '09:00', 'A급 씨드': 80, 'B급 씨드': 50, 'C급 씨드': 20 },
      { time: '11:00', 'A급 씨드': 150, 'B급 씨드': 120, 'C급 씨드': 50 },
      { time: '13:00', 'A급 씨드': 100, 'B급 씨드': 80, 'C급 씨드': 20 },
      { time: '15:00', 'A급 씨드': 220, 'B급 씨드': 170, 'C급 씨드': 60 },
      { time: '17:00', 'A급 씨드': 90, 'B급 씨드': 70, 'C급 씨드': 20 },
    ],
    item: [
      { name: 'A급 씨드', value: 640 },
      { name: 'B급 씨드', value: 490 },
      { name: 'C급 씨드', value: 170 },
    ],
    colors: ['#10b981', '#34d399', '#6ee7b7'] 
  },

  // 2. 씨드 출고 페이지용 데이터
  seedOutbound: {
    time: [
      { time: '09:00', '생산 1라인': 40, '생산 2라인': 50 },
      { time: '11:00', '생산 1라인': 100, '생산 2라인': 110 },
      { time: '13:00', '생산 1라인': 150, '생산 2라인': 160 },
      { time: '15:00', '생산 1라인': 120, '생산 2라인': 160 },
      { time: '17:00', '생산 1라인': 180, '생산 2라인': 220 },
    ],
    item: [
      { name: '생산 1라인', value: 590 },
      { name: '생산 2라인', value: 700 },
      { name: '외부 반출', value: 150 },
    ],
    colors: ['#ef4444', '#f87171', '#fca5a5'] 
  },

  // 3. 인피 입고 페이지용 데이터
  inpiInbound: {
    time: [
      { time: '09:00', '인피 원면': 40, '인피 섬유': 30, '인피 매트': 10 },
      { time: '11:00', '인피 원면': 80, '인피 섬유': 50, '인피 매트': 20 },
      { time: '13:00', '인피 원면': 110, '인피 섬유': 90, '인피 매트': 40 },
      { time: '15:00', '인피 원면': 90, '인피 섬유': 70, '인피 매트': 30 },
      { time: '17:00', '인피 원면': 150, '인피 섬유': 110, '인피 매트': 40 },
    ],
    item: [
      { name: '인피 원면', value: 470 },
      { name: '인피 섬유', value: 350 },
      { name: '인피 매트', value: 140 },
    ],
    colors: ['#3b82f6', '#60a5fa', '#93c5fd'] 
  },

  // 4. 인피 출고 페이지용 데이터
  inpiOutbound: {
    time: [
      { time: '09:00', '공정 A': 50, '공정 B': 40 },
      { time: '11:00', '공정 A': 80, '공정 B': 80 },
      { time: '13:00', '공정 A': 60, '공정 B': 70 },
      { time: '15:00', '공정 A': 150, '공정 B': 170 },
      { time: '17:00', '공정 A': 100, '공정 B': 100 },
    ],
    item: [
      { name: '공정 A', value: 440 },
      { name: '공정 B', value: 460 },
    ],
    colors: ['#f59e0b', '#fbbf24', '#fcd34d'] 
  }
};

const ITEM_KEYS = {
  seedInbound: ['A급 씨드', 'B급 씨드', 'C급 씨드'],
  seedOutbound: ['생산 1라인', '생산 2라인'],
  inpiInbound: ['인피 원면', '인피 섬유', '인피 매트'],
  inpiOutbound: ['공정 A', '공정 B']
};

interface DashboardChartsProps {
  pageType: 'seedInbound' | 'seedOutbound' | 'inpiInbound' | 'inpiOutbound';
}

export function DashboardCharts({ pageType }: DashboardChartsProps) {
  const currentData = MOCK_DATA[pageType];
  
  const isInbound = pageType.includes('Inbound');
  const mainTitle = pageType.startsWith('seed') ? '씨드' : '인피';
  const subTitle = isInbound ? '입고' : '출고';
  const keysToDraw = ITEM_KEYS[pageType];

 return (
    <Panel title={`${mainTitle} ${subTitle} 시간대별 현황`}>    
    <div style={{ width: '100%', height: '220px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={currentData.time as any[]} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6', fontSize: '11px' }} />
          
          <Legend 
            verticalAlign="bottom" 
            align="center"
            height={32} 
            iconType="circle" 
            iconSize={7} 
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} 
          />
          
          {keysToDraw.map((itemName, index) => (
            <Line 
              key={itemName}
              type="monotone" 
              dataKey={itemName}
              stroke={currentData.colors[index % currentData.colors.length]} 
              strokeWidth={2.5} 
              dot={{ r: 3, fill: currentData.colors[index % currentData.colors.length], strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  </Panel>
);
}