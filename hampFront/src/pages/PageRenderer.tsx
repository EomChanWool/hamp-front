import type { ScreenKey } from '../types'
import { DashboardPage } from './dashboard/DashboardPage'
import { AlarmsPage } from './equipment/AlarmsPage'
import { EquipmentDetailPage } from './equipment/EquipmentDetailPage'
import { EquipmentMonitoringPage } from './equipment/EquipmentMonitoringPage'
import { MaintenancePage } from './equipment/MaintenancePage'
import { InventoryPage } from './inventory/InventoryPage'
import { ReceivingPage } from './inventory/ReceivingPage'
import { ShipmentsPage } from './inventory/ShipmentsPage'
import { EquipmentMasterPage } from './master/EquipmentMasterPage'
import { ItemsPage } from './master/ItemsPage'
import { FieldWorkPage } from './production/FieldWorkPage'
import { LotTracePage } from './production/LotTracePage'
import { PlansPage } from './production/PlansPage'
import { ResultsPage } from './production/ResultsPage'
import { WorkOrdersPage } from './production/WorkOrdersPage'
import { QualityPage } from './quality/QualityPage'
import { SecurityPage } from './system/SecurityPage'
import { UsersPage } from './system/UsersPage'

type PageRendererProps = {
  activeScreen: ScreenKey
  setActiveScreen: (key: ScreenKey) => void
}

export function PageRenderer({ activeScreen, setActiveScreen }: PageRendererProps) {
  switch (activeScreen) {
    case 'dashboard':
      return <DashboardPage setActiveScreen={setActiveScreen} />
    case 'users':
      return <UsersPage />
    case 'items':
      return <ItemsPage />
    case 'equipmentMaster':
      return <EquipmentMasterPage />
    case 'receiving':
      return <ReceivingPage />
    case 'inventory':
      return <InventoryPage />
    case 'shipments':
      return <ShipmentsPage />
    case 'plans':
      return <PlansPage />
    case 'workOrders':
      return <WorkOrdersPage />
    case 'field':
      return <FieldWorkPage />
    case 'results':
      return <ResultsPage />
    case 'lotTrace':
      return <LotTracePage />
    case 'equipmentMonitoring':
      return <EquipmentMonitoringPage />
    case 'equipmentDetail':
      return <EquipmentDetailPage />
    case 'alarms':
      return <AlarmsPage />
    case 'quality':
      return <QualityPage />
    case 'maintenance':
      return <MaintenancePage />
    case 'security':
      return <SecurityPage />
  }
}
