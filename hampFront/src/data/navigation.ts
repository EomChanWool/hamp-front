import type { MenuGroup, ScreenKey } from '../types'

export const menuGroups: MenuGroup[] = [
  {
    title: '대시보드',
    items: [{ key: 'dashboard', label: '메인', accessLabel: 'ADMIN' }],
  },
  {
    title: '시스템',
    items: [
      { key: 'users', label: '사용자/권한', accessLabel: 'SUPER' },
      { key: 'security', label: '감사/보안', accessLabel: 'ADMIN' },
    ],
  },
  {
    title: '기준정보',
    items: [
      { key: 'items', label: '품목/라우팅', accessLabel: '생산' },
      { key: 'equipmentMaster', label: '설비/창고', accessLabel: '설비' },
    ],
  },
  {
    title: '입출고·재고',
    items: [
      { key: 'receiving', label: '원료 입고', accessLabel: '창고' },
      { key: 'inventory', label: '재고 조회', accessLabel: '조회' },
      { key: 'shipments', label: '완제품 출고', accessLabel: '창고' },
    ],
  },
  {
    title: '생산관리',
    items: [
      { key: 'plans', label: '생산계획', accessLabel: '생산' },
      { key: 'workOrders', label: '작업지시', accessLabel: '작업자' },
      { key: 'field', label: '현장 작업', accessLabel: 'WORKER' },
      { key: 'results', label: '공정실적', accessLabel: '생산' },
      { key: 'lotTrace', label: 'LOT 추적', accessLabel: '품질' },
    ],
  },
  {
    title: '품질/설비',
    items: [
      { key: 'quality', label: '품질/HACCP/CIP', accessLabel: '품질' },
      { key: 'equipmentMonitoring', label: '설비 모니터링', accessLabel: '설비' },
      { key: 'equipmentDetail', label: '장비 상세', accessLabel: '설비' },
      { key: 'alarms', label: '알람 관리', accessLabel: '작업자' },
      { key: 'maintenance', label: '장비 보전', accessLabel: '설비' },
    ],
  },
]

export const screenTitles: Record<ScreenKey, string> = {
  dashboard: '메인 대시보드',
  users: '사용자 / 권한 / 메뉴 관리',
  items: '품목 / 공정 / 라우팅 관리',
  equipmentMaster: '설비 / 창고 / 위치 관리',
  receiving: '원료 입고 / LOT 생성',
  inventory: '재고 조회 / 이동 / 조정',
  shipments: '완제품 출고 관리',
  plans: '생산계획 관리',
  workOrders: '작업지시 목록 / 상세',
  field: '현장 작업자 화면',
  results: '공정실적 / 불량 / 폐기 입력',
  lotTrace: 'LOT 추적 화면',
  equipmentMonitoring: '설비 모니터링',
  equipmentDetail: '장비 상세',
  alarms: '알람 관리',
  quality: '품질검사 / HACCP / CIP',
  maintenance: '장비 점검 / 유지보수',
  security: '감사로그 / 보안 이벤트',
}
