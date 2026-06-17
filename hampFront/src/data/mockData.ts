import type { StatusTone } from '../types'

export const dashboardCards = [
  { label: '금일 생산', value: '1,240 kg', tone: 'good' },
  { label: '설비 가동률', value: '87%', tone: 'info' },
  { label: '알람', value: '3건', tone: 'danger' },
  { label: '재고부족', value: '5품목', tone: 'warn' },
] satisfies Array<{ label: string; value: string; tone: StatusTone }>

export const progressOrders = [
  { code: 'WO-001', item: '헴프오일', rate: 72, status: '진행' },
  { code: 'WO-002', item: '섬유', rate: 48, status: '진행' },
  { code: 'WO-003', item: '완제품 포장', rate: 92, status: '마감중' },
  { code: 'WO-004', item: '원료 세척', rate: 18, status: '대기' },
]

export const equipmentStatus = [
  { name: '추출기', code: 'EQ-EXT-001', status: 'RUN', rate: '91%', tone: 'good' },
  { name: '건조기', code: 'EQ-DRY-001', status: 'RUN', rate: '88%', tone: 'good' },
  { name: '카딩기', code: 'EQ-CARD-001', status: 'ERROR', rate: '12%', tone: 'danger' },
  { name: '포장기', code: 'EQ-PACK-001', status: 'STOP', rate: '0%', tone: 'muted' },
  { name: '세척기', code: 'EQ-WASH-001', status: 'RUN', rate: '84%', tone: 'good' },
  { name: '분쇄기', code: 'EQ-MILL-001', status: 'RUN', rate: '79%', tone: 'good' },
] satisfies Array<{ name: string; code: string; status: string; rate: string; tone: StatusTone }>
