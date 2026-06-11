import { useNavigate, useLocation } from 'react-router-dom'

const roles = [
  { label: 'Tenant', path: '/tenant' },
  { label: 'Owner', path: '/owner' },
  { label: 'Admin', path: '/admin' },
]

export default function DemoSwitcher() {
  const navigate = useNavigate()
  const location = useLocation()

  const current = roles.find((r) => location.pathname.startsWith(r.path))

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-gray-900 text-white rounded-full px-3 py-1.5 shadow-xl border border-gray-700 text-sm">
      <span className="text-gray-400 text-xs mr-1.5 font-medium">Demo:</span>
      {roles.map((r) => (
        <button
          key={r.path}
          onClick={() => navigate(r.path)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            current?.path === r.path
              ? 'bg-blue-600 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-700'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
