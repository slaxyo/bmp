import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import TenantPortal from './pages/TenantPortal'
import OwnerPortal from './pages/OwnerPortal'
import AdminPortal from './pages/AdminPortal'
import DemoSwitcher from './components/DemoSwitcher'
import { ToastContainer } from './components/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/tenant" element={<TenantPortal />} />
        <Route path="/owner" element={<OwnerPortal />} />
        <Route path="/admin" element={<AdminPortal />} />
      </Routes>
      <DemoSwitcher />
      <ToastContainer />
    </BrowserRouter>
  )
}
