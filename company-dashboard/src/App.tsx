import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Sidebar } from './components/Sidebar'
import { ToastContainer } from './components/Toast'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { ClientList } from './pages/ClientList'
import { ClientDetail } from './pages/ClientDetail'
import { CreatePortal } from './pages/CreatePortal'
import { Invoices } from './pages/Invoices'

function CompanyRoute({ children }: { children: React.ReactNode }) {
  const { user, isCompanyAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !isCompanyAdmin) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <CompanyRoute>
                <Dashboard />
              </CompanyRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <CompanyRoute>
                <ClientList />
              </CompanyRoute>
            }
          />
          <Route
            path="/clients/:id"
            element={
              <CompanyRoute>
                <ClientDetail />
              </CompanyRoute>
            }
          />
          <Route
            path="/create-portal"
            element={
              <CompanyRoute>
                <CreatePortal />
              </CompanyRoute>
            }
          />
          <Route
            path="/invoices"
            element={
              <CompanyRoute>
                <Invoices />
              </CompanyRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </AuthProvider>
  )
}
