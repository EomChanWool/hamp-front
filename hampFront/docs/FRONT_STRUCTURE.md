# HEMP-MES Frontend Structure

이 문서는 현재 React 퍼블리싱 초안의 파일 구조와 각 TypeScript 파일의 역할을 설명합니다.

현재 구현은 백엔드 연동 전 단계입니다. 로그인, 권한, 메뉴, API, MQTT는 실제 동작이 아니라 화면 퍼블리싱과 더미 데이터 표시를 위한 구조만 잡혀 있습니다.

## 전체 실행 흐름

1. `src/main.tsx`
   React 앱을 브라우저의 `#root`에 마운트합니다.

2. `src/App.tsx`
   로그인 여부와 현재 선택된 화면 상태를 관리합니다.

3. `src/pages/auth/LoginPage.tsx`
   로그인 화면을 표시합니다. 현재는 백엔드가 없기 때문에 로그인 버튼을 누르면 바로 대시보드로 이동합니다.

4. `src/components/AppShell.tsx`
   로그인 이후 공통 관리자 레이아웃을 표시합니다. 사이드바, 상단 헤더, 사용자 정보, 로그아웃 버튼이 여기에 있습니다.

5. `src/pages/PageRenderer.tsx`
   현재 선택된 화면 키인 `activeScreen` 값에 따라 실제 화면 컴포넌트를 렌더링합니다.

## `src/App.tsx`

앱의 최상위 상태를 관리합니다.

```ts
const [isLoggedIn, setIsLoggedIn] = useState(false)
const [activeScreen, setActiveScreen] = useState<ScreenKey>('dashboard')
```

`isLoggedIn`은 로그인 화면을 보여줄지, 관리자 화면을 보여줄지 결정합니다.

`activeScreen`은 현재 선택된 메뉴 화면을 의미합니다. 예를 들어 `dashboard`, `users`, `inventory`, `workOrders` 같은 값이 들어갑니다.

현재는 `react-router-dom`을 사용하지 않고 hash 기반으로 화면을 전환합니다. 예를 들어 `#/inventory`처럼 현재 화면 키를 브라우저 hash에 저장합니다.

임시 로그인 상태는 `localStorage`에 저장합니다. 백엔드 로그인 API가 붙기 전까지 새로고침 시 로그인 화면으로 되돌아가는 문제를 막기 위한 퍼블리싱용 처리입니다.

## `src/types.ts`

프로젝트에서 공통으로 쓰는 타입을 모아둔 파일입니다.

### `ScreenKey`

```ts
export type ScreenKey =
  | 'dashboard'
  | 'users'
  | 'items'
  ...
```

화면을 구분하는 고유 키입니다.

예를 들어 메뉴에서 `key: 'inventory'`를 클릭하면 `activeScreen`이 `inventory`로 바뀌고, `PageRenderer.tsx`에서 재고 조회 화면을 렌더링합니다.

즉, `ScreenKey`는 "어떤 화면을 보여줄지" 결정하는 기준값입니다.

### `StatusTone`

```ts
export type StatusTone = 'good' | 'warn' | 'danger' | 'info' | 'muted'
```

상태 배지나 카드의 색상 톤을 정하는 타입입니다.

예:

```tsx
<Badge tone="good">정상</Badge>
<Badge tone="danger">미확인</Badge>
```

### `MenuGroup`

사이드바 메뉴 그룹 타입입니다.

```ts
export type MenuGroup = {
  title: string
  items: Array<{ key: ScreenKey; label: string; accessLabel: string }>
}
```

메뉴 그룹 하나는 `대시보드`, `시스템`, `기준정보` 같은 큰 묶음입니다. 그 안에 실제 메뉴 항목들이 들어갑니다.

## `src/data/navigation.ts`

메뉴 구조와 화면 메타 정보를 관리하는 파일입니다.

### `menuGroups`

사이드바에 표시할 메뉴 목록입니다.

예:

```ts
{
  title: '입출고·재고',
  items: [
    { key: 'receiving', label: '원료 입고', accessLabel: '창고' },
    { key: 'inventory', label: '재고 조회', accessLabel: '조회' },
    { key: 'shipments', label: '완제품 출고', accessLabel: '창고' },
  ],
}
```

### `key`

`key`는 메뉴를 클릭했을 때 어떤 화면을 열지 결정하는 값입니다.

예:

```ts
{ key: 'inventory', label: '재고 조회', accessLabel: '조회' }
```

이 메뉴를 누르면 `activeScreen` 값이 `inventory`가 됩니다.

그 다음 `src/pages/PageRenderer.tsx`의 `PageRenderer`에서 아래 분기가 실행됩니다.

```tsx
case 'inventory':
  return <Inventory />
```

정리하면 `key`는 다음 세 곳을 연결합니다.

1. 사이드바 메뉴 항목
2. 현재 선택된 화면 상태인 `activeScreen`
3. 실제 렌더링할 화면 컴포넌트

그래서 `key` 값은 반드시 `src/types.ts`의 `ScreenKey`에 정의된 값 중 하나여야 합니다.

### `label`

`label`은 사용자에게 보이는 메뉴 이름입니다.

예:

```ts
label: '재고 조회'
```

사이드바 버튼의 본문 텍스트로 표시됩니다.

### `accessLabel`

`accessLabel`은 실제 권한 체크용 값이 아닙니다. 사이드바에 표시하는 접근 구분 라벨입니다.

예:

```ts
{ key: 'field', label: '현장 작업', accessLabel: 'WORKER' }
```

현재 화면에서는 메뉴 오른쪽에 `WORKER`, `ADMIN`, `창고`, `품질` 같은 작은 텍스트로 표시됩니다.

중요한 점은 `accessLabel`이 보안 권한이 아니라는 것입니다. 브라우저에 포함된 프론트 코드는 사용자가 조작할 수 있으므로, 실제 권한 검증은 반드시 백엔드 API와 MQTT ACL에서 처리해야 합니다.

따라서 `accessLabel`로 메뉴를 숨기거나 접근을 막는 방식은 보안 수단이 아닙니다. 나중에 백엔드가 붙으면 서버에서 내려준 사용자 권한 또는 메뉴 목록을 기준으로 렌더링해야 합니다.

예상 확장 형태:

```ts
items: [
  {
    key: 'inventory',
    label: '재고 조회',
    accessLabel: '창고',
    requiredPermissions: ['INVENTORY_READ'],
  },
]
```

이때도 `requiredPermissions`는 프론트 UX용 힌트일 뿐이며, 최종 접근 제어는 백엔드에서 해야 합니다.

### `screenTitles`

각 화면의 제목만 담고 있습니다.

예:

```ts
inventory: '재고 조회 / 이동 / 조정'
```

운영 화면에는 URL, API 경로, MQTT Topic 같은 내부 정보를 표시하지 않습니다. 이런 값은 프론트 화면 정의 데이터에 두지 않고, 나중에 API 레이어나 백엔드 설정에서 관리하는 편이 안전합니다.

## `src/data/mockData.ts`

백엔드가 없을 때 화면에 표시할 더미 데이터를 모아둔 파일입니다.

현재 포함된 데이터:

- 대시보드 카드 데이터
- 작업지시 진행률 데이터
- 설비 상태 데이터

예:

```ts
export const dashboardCards = [
  { label: '금일 생산', value: '1,240 kg', tone: 'good' },
  { label: '설비 가동률', value: '87%', tone: 'info' },
]
```

나중에 API를 붙이면 `mockData.ts`에 있던 데이터를 서비스/API 호출 결과로 교체하면 됩니다.

## `src/components`

여러 화면에서 공통으로 재사용하는 UI 컴포넌트 폴더입니다.

### `AppShell.tsx`

로그인 이후 전체 관리자 레이아웃입니다.

담당:

- 좌측 사이드바 메뉴
- 상단 제목/브레드크럼
- 알림 버튼
- 사용자 표시
- 로그아웃 버튼

메뉴 클릭 시 `onScreenChange(item.key)`를 호출해서 현재 화면을 바꿉니다.

### `LoginPage.tsx`

로그인 화면입니다.

현재는 백엔드가 없기 때문에 아이디/비밀번호 값을 검증하지 않습니다. 로그인 버튼 클릭 시 `onLogin()`만 호출합니다.

### `Panel.tsx`

제목과 선택적 액션 버튼이 있는 공통 박스입니다.

예:

```tsx
<Panel title="작업지시" action="작업 시작">
  ...
</Panel>
```

### `DataTable.tsx`

공통 테이블 컴포넌트입니다.

현재는 단순히 `headers`, `rows`를 받아 렌더링합니다. 정렬, 페이지네이션, 체크박스 선택 같은 기능은 아직 없습니다.

### `Badge.tsx`

상태 표시 배지입니다.

`tone` 값에 따라 색상이 달라집니다.

### `StepFlow.tsx`

공정 흐름, LOT 흐름, 작업 단계 같은 것을 칩 형태로 보여주는 컴포넌트입니다.

### `ManagementScreen.tsx`

검색 조건 영역, 테이블, 선택적 흐름 표시를 묶은 공통 관리 화면 템플릿입니다.

입고, 재고, 생산계획, 알람, 품질, 보전, 감사로그처럼 비슷한 패턴의 화면에서 사용합니다.

## `src/pages`

현재 메뉴별 화면 컴포넌트를 도메인별 폴더로 분리해 둔 영역입니다.

중심 컴포넌트는 `PageRenderer.tsx`입니다.

```tsx
export function PageRenderer({ activeScreen, setActiveScreen }: PageRendererProps) {
  switch (activeScreen) {
    case 'dashboard':
      return <DashboardPage setActiveScreen={setActiveScreen} />
    case 'inventory':
      return <InventoryPage />
    ...
  }
}
```

`activeScreen` 값에 따라 어떤 화면을 보여줄지 결정합니다.

현재 페이지 구조는 아래처럼 도메인별로 나누어져 있습니다.

```txt
src/pages/
  auth/
    LoginPage.tsx
  PageRenderer.tsx
  dashboard/
    DashboardPage.tsx
  inventory/
    ReceivingPage.tsx
    InventoryBalancePage.tsx
    ShipmentPage.tsx
  production/
    PlanPage.tsx
    WorkOrderPage.tsx
    FieldWorkPage.tsx
    ProcessResultPage.tsx
  equipment/
    EquipmentMonitoringPage.tsx
    EquipmentDetailPage.tsx
    AlarmPage.tsx
    MaintenancePage.tsx
  system/
    UsersPage.tsx
    SecurityLogPage.tsx
```

## 현재 구조의 한계

현재 구조는 1차 퍼블리싱용입니다.

아직 없는 것:

- 실제 URL 라우팅
- 로그인 API 연동
- 권한별 메뉴 숨김
- 실제 API 호출
- 폼 검증
- 테이블 페이지네이션
- 상세/등록 모달
- MQTT 연결
- 화면별 상태 관리

즉, 지금은 "메뉴를 누르면 해당 업무 화면처럼 보이는 더미 UI가 나오는 상태"입니다.

## 보안 기준

프론트에 있는 값은 보안 기준이 될 수 없습니다.

프론트에서 할 수 있는 것은 UX 개선입니다.

- 메뉴 숨김
- 버튼 숨김
- 접근 불가 안내
- 화면 이동 제한

하지만 사용자는 브라우저에서 프론트 코드를 조작할 수 있습니다. 따라서 실제 보안은 반드시 아래 계층에서 처리해야 합니다.

- REST API: Spring Security 또는 백엔드 권한 체크
- MQTT: Spring Boot가 발급한 임시 계정과 Mosquitto ACL
- 세션/토큰: 서버 검증
- 감사로그: 서버 저장

`accessLabel`은 이 보안 기준과 무관한 표시용 라벨입니다.

운영 UI에는 내부 URL, API 경로, MQTT Topic을 그대로 표시하지 않습니다. 화면정의서에는 개발 참고용으로 존재할 수 있지만, 배포되는 프론트 화면에서는 노출하지 않는 것을 기본 원칙으로 둡니다.

## 다음 단계 제안

1. `react-router-dom` 추가
   현재 hash 기반 화면 전환을 실제 라우터 기반 URL 구조로 바꿉니다.

2. 페이지 파일 도메인별 분리
   현재 1차 분리는 완료되었습니다. 다음 단계에서는 각 페이지 내부의 목록, 상세, 등록 폼까지 컴포넌트로 더 나눕니다.

3. API 레이어 추가
   `src/services` 또는 `src/api` 폴더를 만들고 백엔드 API 호출 함수를 분리합니다.

4. 권한 구조 정리
   `accessLabel`은 계속 표시용으로 두고, 실제 메뉴 접근과 API 권한은 서버 응답 기준으로 처리합니다.

5. 화면별 상세 퍼블리싱
   PPTX 기준으로 목록, 상세, 등록, 수정, 승인, 확인 버튼 흐름을 화면별로 더 구체화합니다.
