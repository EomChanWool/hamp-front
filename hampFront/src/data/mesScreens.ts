import type { ScreenKey, StatusTone } from '../types'

export type MesRow = Record<string, string>

export type MesScreenKind = 'list' | 'dashboard' | 'realtime' | 'permission' | 'cctv' | 'lot'

export type MesScreenDefinition = {
  kind: MesScreenKind
  title: string
  filters: string[]
  columns: string[]
  rows: MesRow[]
  kpis?: { label: string; value: string; tone: StatusTone }[]
  chart?: { title: string; items: { label: string; value: number; tone?: StatusTone }[] }
  panels?: { title: string; items: { label: string; value: string; tone?: StatusTone }[] }[]
}

const names = ['김민준', '이서연', '박지훈', '최유진', '정도윤', '한수아', '오현우', '임하린', '강태오', '윤지아', '서준호', '문채원']
const areas = ['A동 원료실', 'B동 생산실', 'C동 포장실', '품질검사실', '저온창고', '출하장']
const equipment = ['추출기-01', '건조기-02', '세척기-03', '분쇄기-01', '포장기-04', '압축기-02']
const foodItems = ['헴프 오일', '헴프 분말', '단백질 바', '헴프 음료', '씨드 그래놀라', '헴프 캡슐']
const inpiItems = ['인피 원면', '인피 섬유', '인피 매트', '인피 패드', '인피 롤', '인피 보드']
const orderItems = ['헴프 오일 500ml', '헴프 분말 1kg', '프리미엄 단백질 바', '유기농 헴프 음료', '씨드 그래놀라 300g', '고농축 헴프 캡슐'];
const deliveryItems = ['헴프 오일 출고분', '헴프 분말 출고분', '단백질 바 세트', '헴프 음료 박스', '씨드 그래놀라 벌크', '헴프 캡슐 완제품'];

const row = (values: string[]) => Object.fromEntries(values.map((value, index) => [`c${index}`, value]))
const rows = (data: string[][]) => data.map(row)

function dated(index: number, hour = 8) {
  return `2026-06-${String(22 - (index % 9)).padStart(2, '0')} ${String(hour + (index % 9)).padStart(2, '0')}:20`
}

function list(title: string, filters: string[], columns: string[], data: string[][]): MesScreenDefinition {
  return { kind: 'list', title, filters, columns, rows: rows(data) }
}

function inventoryStatus(title: string, itemPrefix: '씨드' | '인피', itemNames: string[]): MesScreenDefinition {
  return {
    kind: 'dashboard',
    title,
    filters: ['기간 시작일', '기간 종료일', '품목명', '창고위치'],
    columns: ['품목코드', '품목명', '현재고', '안전재고', '입고량', '출고량', '창고위치', '상태'],
    rows: rows(itemNames.map((item, index) => [`${itemPrefix}-${index + 101}`, item, `${420 + index * 68} kg`, `${240 + index * 20} kg`, `${32 + index * 3} kg`, `${18 + index * 2} kg`, areas[index % areas.length], index === 2 ? '안전재고미달' : '정상'])),
    kpis: [
      { label: '총 재고량', value: '4,820 kg', tone: 'good' },
      { label: itemPrefix === '씨드' ? '금일 입고량' : '입고량', value: '426 kg', tone: 'info' },
      { label: itemPrefix === '씨드' ? '금일 출고량' : '출고량', value: '238 kg', tone: 'warn' },
      { label: '안전재고 미달 건수', value: '2건', tone: 'danger' },
    ],
    chart: { title: `${itemPrefix} 품목별 재고`, items: itemNames.map((item, index) => ({ label: item, value: 55 + index * 7, tone: index === 2 ? 'warn' : 'good' })) },
  }
}

function productionSet(prefix: '식품' | '인피', itemNames: string[], processes: string[]): Partial<Record<ScreenKey, MesScreenDefinition>> {
  const keyPrefix = prefix === '식품' ? 'food' : 'inpi'
  return {
    [`${keyPrefix}WorkOrders`]: list(`${prefix} 작업지시관리`, ['작업일자 시작일', '작업일자 종료일', '품목명', '상태'], ['작업지시번호', '품목명', '지시수량', '단위', '작업일자', '공정', '상태', '관리'], itemNames.map((item, i) => [`WO-${prefix === '식품' ? 'F' : 'I'}-${2400 + i}`, item, `${900 + i * 120}`, 'kg', `2026-06-${22 - i}`, processes[i % processes.length], ['대기', '진행중', '완료', '보류'][i % 4], '수정/삭제'])),
    [`${keyPrefix}ProductionResults`]: {
      ...list(`${prefix} 생산실적관리`, ['등록 시작일', '등록 종료일', '작업지시번호', '품목명'], ['실적번호', '작업지시번호', '품목명', '생산수량', '불량수량', '양품률', '등록일시', '관리'], itemNames.map((item, i) => [`PR-${prefix === '식품' ? 'F' : 'I'}-${3100 + i}`, `WO-${prefix === '식품' ? 'F' : 'I'}-${2400 + i}`, item, `${820 + i * 96} kg`, `${8 + i} kg`, `${98 - i * 0.4}%`, dated(i, 9), '상세'])),
      kind: 'dashboard',
      kpis: [
        { label: '금일 생산량', value: '3,420 kg', tone: 'good' },
        { label: '금일 불량률', value: '1.8%', tone: 'warn' },
        { label: '목표달성률', value: '92%', tone: 'info' },
      ],
      chart: { title: `${prefix} 실적 추이`, items: processes.map((process, index) => ({ label: process, value: 45 + index * 8, tone: 'info' })) },
    } as MesScreenDefinition,
    [`${keyPrefix}ProductionStatus`]: {
      kind: 'dashboard',
      title: `${prefix} 생산현황`,
      filters: ['기간 시작일', '기간 종료일', '공정', '품목명'],
      columns: ['작업지시번호', '품목명', '공정', '진행률', '생산량', '담당자', '상태', '시작일시'],
      rows: rows(itemNames.map((item, i) => [`WO-${prefix === '식품' ? 'F' : 'I'}-${2500 + i}`, item, processes[i % processes.length], `${42 + i * 9}%`, `${520 + i * 70} kg`, names[i], ['대기', '진행중', '완료'][i % 3], dated(i, 7)])),
      kpis: [
        { label: '진행 작업', value: '12건', tone: 'info' },
        { label: '완료 작업', value: '8건', tone: 'good' },
        { label: '지연 작업', value: '2건', tone: 'warn' },
        { label: '라인 효율', value: '86%', tone: 'good' },
      ],
      chart: { title: '공정별 진행률', items: processes.map((process, index) => ({ label: process, value: 36 + index * 10, tone: index === 1 ? 'warn' : 'good' })) },
    } as MesScreenDefinition,
    [`${keyPrefix}LotManage`]: {
      kind: 'lot',
      title: `${prefix} LOT관리`,
      filters: ['생산 시작일', '생산 종료일', 'LOT번호', '출고여부'],
      columns: ['LOT번호', '품목명', '생산일자', '원료LOT', '생산수량', '현재상태', '출고여부', '관리'],
      rows: rows(itemNames.map((item, i) => [`LOT-${prefix === '식품' ? 'F' : 'I'}-2606-${i + 11}`, item, `2026-06-${20 - i}`, `RM-${8100 + i}`, `${700 + i * 80} kg`, ['생산완료', '검사대기', '검사완료', '출고완료'][i % 4], i % 3 === 0 ? '출고완료' : '미출고', '상세'])),
      panels: [{ title: 'LOT 흐름', items: ['원료 투입', '생산', '검사', '출고'].map((label, i) => ({ label, value: i < 3 ? '완료' : '대기', tone: i < 3 ? 'good' : 'muted' })) }],
    } as MesScreenDefinition,
  } as Partial<Record<ScreenKey, MesScreenDefinition>>
}

function qualitySet(prefix: '식품' | '인피', itemNames: string[]): Partial<Record<ScreenKey, MesScreenDefinition>> {
  const keyPrefix = prefix === '식품' ? 'food' : 'inpi'
  return {
    [`${keyPrefix}InspectionStandards`]: list(`${prefix} 검사기준서`, ['품목명', '검사유형', '사용여부', '적용 시작일'], ['기준서번호', '품목명', '검사유형', '검사 항목 수', '적용일자', '사용여부', '판정기준', '관리'], itemNames.map((item, i) => [`QS-${prefix === '식품' ? 'F' : 'I'}-${100 + i}`, item, ['입고검사', '공정검사', '출하검사'][i % 3], `${5 + i}개`, `2026-05-${10 + i}`, i === 4 ? '미사용' : '사용', '기준값/단위/허용오차', '상세'])),
    [`${keyPrefix}DefectManage`]: list(`${prefix} 불량관리`, ['발생 시작일', '발생 종료일', '품목명', '처리상태'], ['불량번호', '발생일시', '품목명', 'LOT번호', '공정', '불량유형', '수량', '처리상태'], itemNames.map((item, i) => [`DF-${prefix === '식품' ? 'F' : 'I'}-${5100 + i}`, dated(i, 10), item, `LOT-${7000 + i}`, ['세척', '건조', '포장', '압축'][i % 4], ['이물', '중량미달', '파손', '색상불량'][i % 4], `${4 + i} kg`, ['접수', '원인분석중', '조치완료', '폐기'][i % 4]])),
    [`${keyPrefix}DefectStatus`]: {
      kind: 'dashboard',
      title: `${prefix} 불량현황`,
      filters: ['기간 시작일', '기간 종료일', '공정', '불량유형'],
      columns: ['발생일시', '품목명', 'LOT번호', '공정', '불량유형', '수량', '처리상태', '담당자'],
      rows: rows(itemNames.map((item, i) => [dated(i, 11), item, `LOT-${7100 + i}`, ['세척', '건조', '포장', '압축'][i % 4], ['이물', '중량미달', '파손', '색상불량'][i % 4], `${3 + i} kg`, ['접수', '원인분석중', '조치완료', '폐기'][i % 4], names[i]])),
      kpis: [
        { label: '금일 불량건수', value: '14건', tone: 'warn' },
        { label: '불량수량', value: '82 kg', tone: 'danger' },
        { label: '불량률', value: '1.9%', tone: 'warn' },
        { label: '조치완료율', value: '76%', tone: 'good' },
      ],
      chart: { title: '불량유형별 현황', items: ['이물', '중량미달', '파손', '색상불량'].map((label, i) => ({ label, value: 28 + i * 12, tone: i === 3 ? 'danger' : 'warn' })) },
    } as MesScreenDefinition,
  } as Partial<Record<ScreenKey, MesScreenDefinition>>
}

export const mesScreens = {
  systemUsers: list('사용자관리', ['사용자ID', '이름', '권한', '사용여부'], ['사용자ID', '이름', '부서', '직책', '권한', '사용여부', '최근접속일시', '관리'], names.map((name, i) => [`user${String(i + 1).padStart(3, '0')}`, name, ['생산팀', '품질팀', '설비팀', '시스템팀'][i % 4], ['팀장', '매니저', '작업자', '관리자'][i % 4], ['시스템관리자', '생산관리자', '품질관리자', '설비관리자', '일반작업자'][i % 5], i === 8 ? '미사용' : '사용', dated(i, 8), '수정/삭제'])),
  systemUserPermissions: {
    kind: 'permission',
    title: '사용자 권한관리',
    filters: ['권한그룹', '사용자ID', '메뉴명', '사용여부'],
    columns: ['권한그룹', '설명', '사용자수', '조회', '등록', '수정', '삭제', '승인'],
    rows: rows(['시스템관리자', '생산관리자', '품질관리자', '설비관리자', '일반작업자'].map((role, i) => [role, `${role} 메뉴 접근 권한`, `${12 - i}명`, '허용', i < 4 ? '허용' : '제한', i < 4 ? '허용' : '제한', i < 2 ? '허용' : '제한', i < 3 ? '허용' : '제한'])),
  },
  systemAccessLogs: list('사용자접속기록', ['시작일', '종료일', '사용자ID', '접속상태'], ['접속일시', '사용자ID', '이름', 'IP', '접속브라우저', '접속상태', '로그아웃일시', '비고'], names.slice(0, 10).map((name, i) => [dated(i, 7), `user${String(i + 1).padStart(3, '0')}`, name, `10.10.1.${24 + i}`, ['Chrome', 'Edge', 'Whale'][i % 3], i === 3 ? '실패' : '성공', i === 3 ? '-' : dated(i, 8), i === 3 ? '비밀번호 오류' : '정상 로그아웃'])),
  facilityAccessManage: list('출입 관리', ['출입자명', '구분', '출입구역', '승인상태'], ['출입자명', '소속', '출입구역', '출입목적', '승인상태', '출입예정일시', '구분', '관리'], names.slice(0, 8).map((name, i) => [name, ['협력사', '생산팀', '품질팀', '운송사'][i % 4], areas[i % areas.length], ['정기점검', '원료납품', '품질확인', '출하'][i % 4], ['승인완료', '승인대기', '반려'][i % 3], dated(i, 9), ['작업자', '방문자', '차량'][i % 3], '등록/수정'])),
  facilityAccessRealtime: {
    kind: 'realtime',
    title: '출입 실시간 현황',
    filters: ['구역', '구분', '상태', '담당자'],
    columns: ['발생일시', '출입자명', '구분', '출입구역', '상태', '승인자', '게이트', '비고'],
    rows: rows(names.slice(0, 8).map((name, i) => [dated(i, 8), name, ['작업자', '방문자', '차량'][i % 3], areas[i % areas.length], ['정상출입', '승인대기', '출입거부', '퇴실완료'][i % 4], names[(i + 2) % names.length], `G-${i + 1}`, 'mock event'])),
    kpis: [
      { label: '현재 출입 중인 인원', value: '38명', tone: 'info' },
      { label: '금일 출입 건수', value: '126건', tone: 'good' },
      { label: '승인대기 건수', value: '7건', tone: 'warn' },
      { label: '비인가 시도 건수', value: '2건', tone: 'danger' },
    ],
    chart: { title: '구역별 출입 현황', items: areas.slice(0, 5).map((area, i) => ({ label: area, value: 42 + i * 9, tone: i === 3 ? 'warn' : 'good' })) },
  },
  facilityAccessHistory: list('출입 이력 조회', ['시작일', '종료일', '출입자명', '출입상태'], ['출입일시', '출입자명', '구분', '출입구역', '출입상태', '승인자', '비고', '관리'], names.slice(0, 9).map((name, i) => [dated(i, 6), name, ['작업자', '방문자', '차량'][i % 3], areas[i % areas.length], ['정상출입', '출입거부', '퇴실완료'][i % 3], names[(i + 4) % names.length], '일일 출입 이력', '상세'])),
  facilityEnvironmentRealtime: {
    kind: 'realtime',
    title: '환경 데이터 실시간 현황',
    filters: ['구역', '센서유형', '상태', '수집장비'],
    columns: ['측정일시', '구역', '센서명', '온도', '습도', 'CO2', '미세먼지', '상태'],
    rows: rows(areas.map((area, i) => [dated(i, 10), area, `SEN-${i + 1}`, `${22 + i}.5℃`, `${48 + i}%`, `${430 + i * 35}ppm`, `${18 + i * 4}㎍/㎥`, ['정상', '주의', '경고'][i % 3]])),
    kpis: [
      { label: '온도', value: '23.8℃', tone: 'good' },
      { label: '습도', value: '52%', tone: 'info' },
      { label: 'CO2', value: '620ppm', tone: 'warn' },
      { label: '미세먼지', value: '28㎍/㎥', tone: 'good' },
    ],
    chart: { title: '구역별 환경 현황', items: areas.map((area, i) => ({ label: area, value: 36 + i * 10, tone: i === 4 ? 'danger' : i === 2 ? 'warn' : 'good' })) },
  },
  facilityEnvironmentHistory: {
    kind: 'dashboard',
    title: '환경 데이터 이력 조회',
    filters: ['시작일', '종료일', '구역', '센서유형'],
    columns: ['측정일시', '구역', '센서명', '온도', '습도', 'CO2', '상태', '수집장비'],
    rows: rows(areas.map((area, i) => [dated(i, 5), area, `환경센서-${i + 1}`, `${21 + i}.2℃`, `${45 + i}%`, `${420 + i * 40}ppm`, ['정상', '주의', '경고'][i % 3], equipment[i % equipment.length]])),
    chart: { title: '환경 수집 추이', items: areas.map((area, i) => ({ label: area, value: 30 + i * 11, tone: 'info' })) },
  },
  facilityCctv: {
    kind: 'cctv',
    title: 'CCTV 현황',
    filters: ['카메라명', '설치위치', '연결상태', '최근감지시간'],
    columns: ['카메라명', '설치위치', '연결상태', '최근감지시간', '녹화상태', '담당자', 'IP', '관리'],
    rows: rows(areas.map((area, i) => [`CAM-${String(i + 1).padStart(2, '0')}`, area, ['정상', '점검중', '연결끊김'][i % 3], dated(i, 12), i === 2 ? '중지' : '녹화중', names[i], `192.168.10.${40 + i}`, '상세'])),
  },
  facilityDataManage: list('데이터 관리', ['데이터유형', '수집장비', '사용여부', '수집주기'], ['데이터ID', '데이터유형', '수집장비', '수집주기', '최종수집일시', '사용여부', '담당자', '관리'], ['출입로그', '환경센서', 'CCTV이벤트', '설비상태', '알림데이터', '품질데이터'].map((type, i) => [`DATA-${100 + i}`, type, equipment[i % equipment.length], ['1초', '10초', '1분', '5분'][i % 4], dated(i, 13), i === 5 ? '미사용' : '사용', names[i], '수정/삭제'])),
  masterFactories: list('공장관리', ['공장코드', '공장명', '담당자', '사용여부'], ['공장코드', '공장명', '위치', '담당자', '사용여부', '등록일자', '비고', '관리'], areas.map((area, i) => [`FAC-${i + 1}`, area, `충북 음성 ${i + 1}구역`, names[i], i === 5 ? '미사용' : '사용', `2026-01-${10 + i}`, '생산/보관 구역', '수정/삭제'])),
  masterEquipment: list('장비관리', ['장비코드', '장비명', '장비유형', '사용여부'], ['장비코드', '장비명', '장비유형', '설치공정', '제조사', '사용여부', '검교정일', '관리'], equipment.map((eq, i) => [`EQ-${100 + i}`, eq, ['생산설비', '검사설비', '물류설비'][i % 3], ['원료투입', '세척', '건조', '포장'][i % 4], ['HMP Tech', 'MES Korea', 'Green Fab'][i % 3], i === 4 ? '미사용' : '사용', `2026-04-${10 + i}`, '수정/삭제'])),
  masterProcesses: list('공정관리', ['공정코드', '공정명', '적용품목', '사용여부'], ['공정코드', '공정명', '공정순서', '적용품목', '사용여부', '표준시간', '담당부서', '관리'], ['원료투입', '세척', '건조', '분쇄', '선별', '포장'].map((process, i) => [`PROC-${i + 1}`, process, `${i + 1}`, foodItems[i % foodItems.length], '사용', `${30 + i * 15}분`, '생산팀', '수정/삭제'])),
  masterItems: list('품목관리', ['품목코드', '품목명', '품목구분', '사용여부'], ['품목코드', '품목명', '품목구분', '단위', '규격', '사용여부', '안전재고', '관리'], [...foodItems, ...inpiItems].slice(0, 8).map((item, i) => [`ITEM-${1000 + i}`, item, ['원료', '반제품', '완제품'][i % 3], 'kg', `${10 + i}kg/box`, i === 7 ? '미사용' : '사용', `${200 + i * 20}`, '수정/삭제'])),
  masterDefects: list('불량관리', ['불량코드', '불량명', '불량유형', '사용여부'], ['불량코드', '불량명', '불량유형', '적용공정', '심각도', '사용여부', '등록일자', '관리'], ['이물혼입', '중량미달', '외관불량', '포장불량', '수분초과', '파손'].map((defect, i) => [`DEF-${i + 1}`, defect, ['공정불량', '검사불량', '출하불량'][i % 3], ['세척', '건조', '포장'][i % 3], ['낮음', '보통', '높음'][i % 3], '사용', `2026-03-${10 + i}`, '수정/삭제'])),
  equipmentList: list('설비목록', ['설비명', '설비유형', '현재상태', '설치위치'], ['설비코드', '설비명', '설비유형', '설치위치', '현재상태', '가동률', '담당자', '관리'], equipment.map((eq, i) => [`EQL-${210 + i}`, eq, ['추출', '건조', '세척', '분쇄', '포장'][i % 5], areas[i % areas.length], ['가동중', '대기중', '점검중', '고장'][i % 4], `${91 - i * 8}%`, names[i], '상세'])),
  equipmentOperationStatus: {
    kind: 'realtime',
    title: '설비가동현황',
    filters: ['설비명', '상태', '설치위치', '담당자'],
    columns: ['설비명', '현재상태', '가동률', '금일가동시간', '작업지시번호', '담당자', '최근갱신', '비고'],
    rows: rows(equipment.map((eq, i) => [eq, ['가동중', '대기중', '점검중', '고장'][i % 4], `${92 - i * 7}%`, `${6 + i}h`, `WO-${2400 + i}`, names[i], dated(i, 14), 'mock realtime'])),
    kpis: [
      { label: '전체 설비 수', value: '24대', tone: 'info' },
      { label: '가동중', value: '17대', tone: 'good' },
      { label: '점검중', value: '4대', tone: 'warn' },
      { label: '고장', value: '1대', tone: 'danger' },
      { label: '평균가동률', value: '86%', tone: 'good' },
    ],
    chart: { title: '설비별 가동률', items: equipment.map((eq, i) => ({ label: eq, value: 92 - i * 7, tone: i > 3 ? 'warn' : 'good' })) },
  },
  equipmentOperationHistory: list('설비가동이력', ['시작일', '종료일', '설비명', '상태'], ['설비명', '가동시작', '가동종료', '가동시간', '상태', '작업지시번호', '담당자', '관리'], equipment.map((eq, i) => [eq, dated(i, 7), dated(i, 15), `${6 + i}h`, ['정상종료', '점검종료', '비상정지'][i % 3], `WO-${3000 + i}`, names[i], '상세'])),
  equipmentAlarmSystem: list('설비알림시스템', ['알림 시작일', '알림 종료일', '설비명', '처리상태'], ['알림일시', '설비명', '알림유형', '알림등급', '처리상태', '담당자', '조치내용', '관리'], equipment.map((eq, i) => [dated(i, 12), eq, ['온도상승', '진동감지', '전류이상', '통신지연'][i % 4], ['정보', '주의', '경고', '위험'][i % 4], ['미처리', '처리중', '조치완료'][i % 3], names[i], i % 3 === 2 ? '센서 교체 완료' : '현장 확인 중', '처리'])),
  equipmentRepairHistory: list('수리이력관리', ['수리 시작일', '수리 종료일', '설비명', '완료상태'], ['수리일자', '설비명', '고장내용', '조치내용', '수리담당자', '비용', '완료상태', '관리'], equipment.map((eq, i) => [`2026-06-${12 + i}`, eq, ['벨트 마모', '센서 불량', '모터 과열'][i % 3], ['부품교체', '캘리브레이션', '윤활작업'][i % 3], names[i], `${30 + i * 12}만원`, i === 1 ? '진행중' : '완료', '상세'])),
  seedInventoryStatus: inventoryStatus('씨드 재고현황', '씨드', foodItems),
  seedReportReturnManage: list('신고반납관리', ['신고번호', '품목명', '처리상태', '담당자'], ['신고번호', '품목명', '수량', '신고일자', '반납예정일', '처리상태', '담당자', '관리'], foodItems.map((item, i) => [`SR-${4000 + i}`, item, `${40 + i * 8} kg`, `2026-06-${10 + i}`, `2026-06-${18 + i}`, ['신고접수', '반납대기', '반납완료', '취소'][i % 4], names[i], '수정/삭제'])),
  seedInventoryManage: list('씨드 재고관리', ['처리 시작일', '처리 종료일', '처리구분', '품목명'], ['처리일자', '처리구분', '품목명', '수량', '단위', '담당자', '비고', '관리'], foodItems.map((item, i) => [`2026-06-${14 + i}`, ['입고', '출고', '조정'][i % 3], item, `${80 + i * 15}`, 'kg', names[i], 'mock 재고 처리', '수정/삭제'])),
  ...productionSet('식품', foodItems, ['원료투입', '세척', '건조', '분쇄', '선별', '포장']),
  ...qualitySet('식품', foodItems),
  inpiInventoryStatus: inventoryStatus('인피 재고현황', '인피', inpiItems),
  inpiInventoryManage: list('인피 재고관리', ['처리 시작일', '처리 종료일', '처리구분', '품목명'], ['처리일자', '처리구분', '품목명', '수량', '단위', '창고위치', '담당자', '비고'], inpiItems.map((item, i) => [`2026-06-${14 + i}`, ['입고', '출고', '조정'][i % 3], item, `${60 + i * 18}`, 'kg', areas[i % areas.length], names[i], 'mock 재고 처리'])),
  ...productionSet('인피', inpiItems, ['투입', '개섬', '정렬', '압축', '포장']),
  ...qualitySet('인피', inpiItems),
  //씨드,인피 입출고
  seedInboundManage: list('씨드 입고관리', ['입고번호', '품명', '담당자', '입고처'], ['입고번호', '품명', '입고수량', '불량수량', '양품수량', '담당자', '입고처', '입고시간', '등록일시', '관리'], foodItems.map((item, i) => [`IN-${5000 + i}`, item, `${100 + i * 20} kg`, `${i % 5 === 1 ? 5 : 0} kg`, `${(100 + i * 20) - (i % 5 === 1 ? 5 : 0)} kg`, names[i], '씨드유통(주)', `10:${30 + i}:00`, dated(i, 15), '상세'])),
  seedOutboundManage: list('씨드 출고관리', ['출고번호', '품명', 'Lot번호', '담당자'], ['출고번호', '품명', 'Lot번호', '출고량', '출고목적지', '담당자', '출고시간', '등록일시', '관리'], foodItems.map((item, i) => [`OUT-${5000 + i}`, item, `LOT-SEED-202606-${10 + i}`, `${80 + i * 15} kg`, '제 1 가공라인', names[i], `14:${10 + i}:00`, dated(i, 15), '상세'])),
  inpiInboundManage: list('인피 입고관리', ['입고번호', '품명', '담당자', '입고처'], ['입고번호', '품명', '입고수량', '불량수량', '양품수량', '담당자', '입고처', '입고시간', '등록일시', '관리'], inpiItems.map((item, i) => [`IN-${6000 + i}`, item, `${150 + i * 30} kg`, `${i % 4 === 1 ? 8 : 0} kg`, `${(150 + i * 30) - (i % 4 === 1 ? 8 : 0)} kg`, names[i], '(주)인피테크', `09:${15 + i}:00`, dated(i, 15), '상세'])), 
  inpiOutboundManage: list('인피 출고관리', ['출고번호', '품명', 'Lot번호', '담당자'], ['출고번호', '품명', 'Lot번호', '출고량', '출고목적지', '담당자', '출고시간', '등록일시', '관리'], inpiItems.map((item, i) => [`OUT-${6000 + i}`, item, `LOT-INPI-202606-${10 + i}`, `${100 + i * 20} kg`, '제 2 생산라인', names[i], `16:${20 + i}:00`, dated(i, 15), '상세'])),
  //영업관리
  orderManage: list('수주관리', ['거래처', '수주번호', '거래처담당자', '생산품목', '생산량', '수주금액', '납기일', '상태', '담당자', '비고'], ['거래처', '수주번호', '거래처담당자', '생산품목', '생산량', '수주금액', '납기일', '상태', '담당자', '비고'],orderItems.map((item, i) => ['(주)거래처A', `ORD-${2026001 + i}`, '김영업', item, '1000', '5000000', '2026-07-30', '진행중', '이수주', '-'])),
  deliveryManage: list('납품관리', ['수주번호', '거래처', '거래처담당자', '납품품목', '납품량', '납품장소', '담당자', '상태', '비고'], ['수주번호', '거래처', '거래처담당자', '납품품목', '납품량', '납품장소', '담당자', '상태', '비고'],deliveryItems.map((item, i) => [`ORD-${2026001 + i}`, '(주)거래처A', '김영업', item, '1000', '본사창고', '박납품', '완료', '-'])),
  orderStatus: list('수주현황', ['거래처', '수주번호', '거래처담당자', '생산품목', '생산량', '수주금액', '납기일', '담당자'], ['거래처', '수주번호', '거래처담당자', '생산품목', '생산량', '수주금액', '납기일', '담당자'],orderItems.map((item, i) => ['(주)거래처A', `ORD-${2026001 + i}`, '김영업', item, '1000', '5000000', '2026-07-30', '이수주'])),
  deliveryStatus: list('납품현황', ['수주번호', '거래처', '거래처담당자', '납품품목', '납품량', '납품장소', '담당자'], ['수주번호', '거래처', '거래처담당자', '납품품목', '납품량', '납품장소', '담당자'],deliveryItems.map((item, i) => [`ORD-${2026001 + i}`, '(주)거래처A', '김영업', item, '1000', '본사창고', '박납품'])),
} as Record<ScreenKey, MesScreenDefinition>

export function getStatusTone(status: string): StatusTone {
  if (/(위험|고장|거부|끊김|경고|실패|미달|폐기|반려|중지)/.test(status)) return 'danger'
  if (/(제한)/.test(status)) return 'limits'
  if (/(주의|대기|점검|진행중|원인분석|보류|미처리|처리중|미사용)/.test(status)) return 'warn'
  if (/(완료|승인|사용|정상|가동|성공|허용|녹화중)/.test(status)) return 'good'
  if (/(정보|조회|출고|접수)/.test(status)) return 'info'
  return 'muted'
}
