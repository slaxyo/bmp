import { useNavigate, useLocation } from 'react-router-dom'

const roles = [
  { label: 'Tenant', path: '/tenant', key: 'bmp_last_tenant', color: 'bg-green-600' },
  { label: 'Owner', path: '/owner', key: 'bmp_last_owner', color: 'bg-purple-600' },
  { label: 'Admin', path: '/admin', key: 'bmp_last_admin', color: 'bg-blue-600' },
]

export default function DemoSwitcher() {
  const navigate = useNavigate()
  const location = useLocation()

  const current = roles.find((r) => location.pathname.startsWith(r.path))

  function handleSwitch(r: typeof roles[number]) {
    // Save current path for the current role
    if (current) {
      try { sessionStorage.setItem(current.key, location.pathname) } catch {}
    }
    // Navigate to last saved path for target role, or default
    let dest = r.path
    try {
      const saved = sessionStorage.getItem(r.key)
      if (saved) dest = saved
    } catch {}
    navigate(dest)
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5 bg-gray-900/95 backdrop-blur-sm text-white rounded-2xl px-3 py-2 shadow-2xl border border-gray-700">
        <div className="flex flex-col mr-2">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest leading-none">Mock Data Demo</span>
          {current && (
            <span className="text-xs font-semibold text-gray-200 mt-0.5 leading-none">
              Viewing as <span className="text-white font-bold">{current.label}</span>
            </span>
          )}
        </div>
        <div className="w-px h-7 bg-gray-700 mx-1" />
        {roles.map((r) => (
          <button
            key={r.path}
            onClick={() => handleSwitch(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              current?.path === r.path
                ? `${r.color} text-white shadow-sm`
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {r.label}
          </button>
        ))}
        <div className="w-px h-7 bg-gray-700 mx-1" />
        <button
          onClick={() => navigate('/login')}
          className="text-xs text-gray-500 hover:text-gray-300 font-medium transition-colors whitespace-nowrap"
        >
          ← Login
        </button>
      </div>
    </div>
  )
}
