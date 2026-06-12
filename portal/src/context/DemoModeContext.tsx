import { createContext, useContext, useState, type ReactNode } from 'react'

interface DemoModeContextValue {
  demoMode: boolean
  setDemoMode: (v: boolean) => void
}

const DemoModeContext = createContext<DemoModeContextValue>({ demoMode: false, setDemoMode: () => {} })

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoModeState] = useState(() => localStorage.getItem('bmp_demoMode') === 'true')

  function setDemoMode(v: boolean) {
    localStorage.setItem('bmp_demoMode', String(v))
    setDemoModeState(v)
  }

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  return useContext(DemoModeContext)
}
