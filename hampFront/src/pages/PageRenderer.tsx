import type { ScreenKey } from '../types'
import { DashboardPage } from './dashboard/DashboardPage'
import { MesDemoPage } from './MesDemoPage'

type PageRendererProps = {
  activeScreen: ScreenKey
  setActiveScreen: (key: ScreenKey) => void
}

export function PageRenderer({ activeScreen, setActiveScreen }: PageRendererProps) {
  if (activeScreen === 'dashboard') {
    return <DashboardPage setActiveScreen={setActiveScreen} />
  }

  return <MesDemoPage screen={activeScreen} />
}
