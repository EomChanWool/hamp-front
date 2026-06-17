export type ScreenKey =
  | 'dashboard'
  | 'users'
  | 'items'
  | 'equipmentMaster'
  | 'receiving'
  | 'inventory'
  | 'shipments'
  | 'plans'
  | 'workOrders'
  | 'field'
  | 'results'
  | 'lotTrace'
  | 'equipmentMonitoring'
  | 'equipmentDetail'
  | 'alarms'
  | 'quality'
  | 'maintenance'
  | 'security'

export type StatusTone = 'good' | 'warn' | 'danger' | 'info' | 'muted'

export type MenuGroup = {
  title: string
  items: Array<{ key: ScreenKey; label: string; accessLabel: string }>
}
