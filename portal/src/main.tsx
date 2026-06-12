import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { DemoModeProvider } from './context/DemoModeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoModeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DemoModeProvider>
  </StrictMode>,
)
