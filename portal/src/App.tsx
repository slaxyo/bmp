import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import InvitePage from './pages/InvitePage'
import TenantPortal from './pages/TenantPortal'
import OwnerPortal from './pages/OwnerPortal'
import AdminPortal from './pages/AdminPortal'
import { ToastContainer } from './components/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invite" element={<InvitePage />} />
        <Route path="/tenant/*" element={<ProtectedRoute roles={['tenant']}><TenantPortal /></ProtectedRoute>} />
        <Route path="/owner/*" element={<ProtectedRoute roles={['owner']}><OwnerPortal /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute roles={['admin']}><AdminPortal /></ProtectedRoute>} />
        {/* Catch-all: unknown routes fall back to login (avoids blank 404 pages) */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  )
}
