const NAV = [
  { id: 'dashboard',    label: 'Dashboard',    href: 'dashboard.html',    icon: '<path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>' },
  { id: 'tenants',      label: 'Tenants',      href: 'tenants.html',      icon: '<path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>' },
  { id: 'maintenance',  label: 'Maintenance',  href: 'maintenance.html',  icon: '<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>' },
  { id: 'messages',     label: 'Messages',     href: 'messages.html',     icon: '<path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>' },
  { id: 'rent',         label: 'Rent',         href: 'rent.html',         icon: '<path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
  { id: 'owners',       label: 'Owners',       href: 'owners.html',       icon: '<path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>' },
]

async function renderLayout(activeId, pageTitle) {
  const user = await requireAuth()
  if (!user) return

  const name = user.user_metadata?.name || user.email?.split('@')[0] || 'PM'

  let unread = 0
  try {
    const { count } = await db.from('messages').select('*', { count: 'exact', head: true }).eq('pm_id', user.id).eq('read', false).eq('sender', 'tenant')
    unread = count || 0
  } catch (_) {}

  const navHTML = NAV.map(n => `
    <a href="${n.href}" class="nav-item ${n.id === activeId ? 'active' : ''}">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${n.icon}</svg>
      <span>${n.label}</span>
      ${n.id === 'messages' && unread > 0 ? `<span class="nav-badge">${unread}</span>` : ''}
    </a>`).join('')

  const sidebarHTML = `
    <div class="sidebar-logo">
      <a href="../index.html" class="s-logo-mark">BMP</a>
      <span class="s-logo-text">Central</span>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div class="sidebar-bottom">
      <div class="sidebar-user">
        <div class="s-avatar" style="background:${avatarColor(name)}">${initials(name)}</div>
        <div class="s-user-info">
          <div class="s-user-name">${name}</div>
          <div class="s-user-role">Property Manager</div>
        </div>
      </div>
      <button class="btn-logout" onclick="handleLogout()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        Log out
      </button>
    </div>`

  const topbarHTML = `
    <h1 class="topbar-title">${pageTitle}</h1>
    <div class="topbar-right">
      <span class="topbar-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
    </div>`

  document.getElementById('sidebar').innerHTML = sidebarHTML
  document.getElementById('topbar').innerHTML = topbarHTML
}

async function handleLogout() {
  await db.auth.signOut()
  window.location.href = 'index.html'
}
