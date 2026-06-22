import type { ScreenKey } from '../types'
import { MesDemoPage } from './MesDemoPage'

type PageRendererProps = {
  activeScreen: ScreenKey
  setActiveScreen: (key: ScreenKey) => void
}

export function PageRenderer({ activeScreen, setActiveScreen }: PageRendererProps) {
  void setActiveScreen

  return <MesDemoPage screen={activeScreen} />
}
