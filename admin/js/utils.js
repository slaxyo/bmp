function fmt$(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0)
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateShort(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDateShort(d)
}

function toast(msg, type = 'success') {
  const t = document.createElement('div')
  t.className = `toast toast--${type}`
  t.textContent = msg
  document.body.appendChild(t)
  requestAnimationFrame(() => t.classList.add('toast--show'))
  setTimeout(() => {
    t.classList.remove('toast--show')
    setTimeout(() => t.remove(), 300)
  }, 3200)
}

function btnLoad(btn, on) {
  if (on) { btn._txt = btn.textContent; btn.textContent = 'Saving…'; btn.disabled = true }
  else { btn.textContent = btn._txt || btn.textContent; btn.disabled = false }
}

function statusBadge(s) {
  const m = {
    active: ['g', 'Active'], late: ['r', 'Late'], notice: ['y', 'Notice'], past: ['gray', 'Past'],
    paid: ['g', 'Paid'], pending: ['y', 'Pending'], partial: ['o', 'Partial'],
    open: ['r', 'Open'], in_progress: ['b', 'In Progress'], resolved: ['g', 'Resolved'],
    occupied: ['g', 'Occupied'], vacant: ['gray', 'Vacant'], maintenance: ['y', 'Maintenance'],
    urgent: ['r', 'Urgent'], high: ['o', 'High'], medium: ['y', 'Medium'], low: ['gray', 'Low'],
  }
  const [c, l] = m[s] || ['gray', s]
  return `<span class="badge badge--${c}">${l}</span>`
}

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarColor(name) {
  const colors = ['#2563eb','#7c3aed','#0891b2','#059669','#d97706','#dc2626','#db2777']
  let hash = 0
  for (const c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

async function requireAuth() {
  const { data: { user } } = await db.auth.getUser()
  if (!user) { window.location.href = 'index.html'; return null }
  return user
}

async function seedDemoData(pmId) {
  const { count } = await db.from('properties').select('*', { count: 'exact', head: true }).eq('pm_id', pmId)
  if (count > 0) { toast('Demo data already loaded', 'info'); return }

  const { data: owners } = await db.from('owners').insert([
    { pm_id: pmId, name: 'John Mitchell', email: 'john@mitchellholdings.com', phone: '(602) 555-0142' },
    { pm_id: pmId, name: 'Rachel Torres', email: 'rachel@torresre.com', phone: '(480) 555-0198' },
  ]).select()

  const { data: properties } = await db.from('properties').insert([
    { pm_id: pmId, owner_id: owners[0].id, name: 'Skyline Apartments', address: '2400 N Central Ave', city: 'Phoenix', state: 'AZ', zip: '85004' },
    { pm_id: pmId, owner_id: owners[0].id, name: 'Oak Street Duplexes', address: '814 Oak St', city: 'Tempe', state: 'AZ', zip: '85281' },
    { pm_id: pmId, owner_id: owners[1].id, name: 'Riverside Condos', address: '150 River Dr', city: 'Scottsdale', state: 'AZ', zip: '85251' },
  ]).select()

  const { data: units } = await db.from('units').insert([
    { property_id: properties[0].id, unit_number: '1A', bedrooms: 1, bathrooms: 1, sqft: 680, rent_amount: 1250, status: 'occupied' },
    { property_id: properties[0].id, unit_number: '1B', bedrooms: 2, bathrooms: 1, sqft: 890, rent_amount: 1550, status: 'occupied' },
    { property_id: properties[0].id, unit_number: '2A', bedrooms: 1, bathrooms: 1, sqft: 680, rent_amount: 1250, status: 'occupied' },
    { property_id: properties[0].id, unit_number: '2B', bedrooms: 2, bathrooms: 2, sqft: 960, rent_amount: 1650, status: 'vacant' },
    { property_id: properties[1].id, unit_number: 'Unit 1', bedrooms: 3, bathrooms: 2, sqft: 1200, rent_amount: 1950, status: 'occupied' },
    { property_id: properties[1].id, unit_number: 'Unit 2', bedrooms: 3, bathrooms: 2, sqft: 1200, rent_amount: 1950, status: 'occupied' },
    { property_id: properties[2].id, unit_number: '101', bedrooms: 2, bathrooms: 2, sqft: 1050, rent_amount: 1800, status: 'occupied' },
    { property_id: properties[2].id, unit_number: '102', bedrooms: 2, bathrooms: 2, sqft: 1050, rent_amount: 1800, status: 'occupied' },
    { property_id: properties[2].id, unit_number: '103', bedrooms: 2, bathrooms: 1, sqft: 920, rent_amount: 1600, status: 'occupied' },
  ]).select()

  const today = new Date()
  const { data: tenants } = await db.from('tenants').insert([
    { pm_id: pmId, unit_id: units[0].id, name: 'James Rivera', email: 'james.rivera@gmail.com', phone: '(602) 555-0211', lease_start: '2024-02-01', lease_end: '2025-01-31', monthly_rent: 1250, status: 'active' },
    { pm_id: pmId, unit_id: units[1].id, name: 'Maya Patel', email: 'maya.patel@gmail.com', phone: '(602) 555-0334', lease_start: '2024-05-01', lease_end: '2025-04-30', monthly_rent: 1550, status: 'active' },
    { pm_id: pmId, unit_id: units[2].id, name: 'David Lee', email: 'd.lee@outlook.com', phone: '(602) 555-0456', lease_start: '2023-09-01', lease_end: '2024-08-31', monthly_rent: 1250, status: 'late' },
    { pm_id: pmId, unit_id: units[4].id, name: 'Sarah Johnson', email: 'sarah.j@gmail.com', phone: '(480) 555-0127', lease_start: '2024-01-01', lease_end: '2024-12-31', monthly_rent: 1950, status: 'notice' },
    { pm_id: pmId, unit_id: units[5].id, name: 'Tom Walsh', email: 'twalsh@icloud.com', phone: '(480) 555-0088', lease_start: '2024-03-01', lease_end: '2025-02-28', monthly_rent: 1950, status: 'active' },
    { pm_id: pmId, unit_id: units[6].id, name: 'Aisha Khan', email: 'aisha.khan@gmail.com', phone: '(480) 555-0312', lease_start: '2024-06-01', lease_end: '2025-05-31', monthly_rent: 1800, status: 'active' },
    { pm_id: pmId, unit_id: units[7].id, name: 'Marcus Webb', email: 'mwebb@gmail.com', phone: '(480) 555-0561', lease_start: '2024-04-01', lease_end: '2025-03-31', monthly_rent: 1800, status: 'active' },
    { pm_id: pmId, unit_id: units[8].id, name: 'Elena Vasquez', email: 'elena.v@gmail.com', phone: '(480) 555-0743', lease_start: '2024-07-01', lease_end: '2025-06-30', monthly_rent: 1600, status: 'active' },
  ]).select()

  await db.from('maintenance_requests').insert([
    { pm_id: pmId, tenant_id: tenants[0].id, unit_id: units[0].id, title: 'AC not cooling properly', description: 'AC runs but room stays above 80°F even set to 72°F. Worst in the bedroom.', priority: 'urgent', status: 'open' },
    { pm_id: pmId, tenant_id: tenants[1].id, unit_id: units[1].id, title: 'Kitchen faucet dripping', description: 'Hot water faucet drips constantly when off. Getting worse over last week.', priority: 'medium', status: 'in_progress' },
    { pm_id: pmId, tenant_id: tenants[5].id, unit_id: units[6].id, title: 'Bathroom exhaust fan broken', description: 'Fan makes loud rattling noise and barely moves air.', priority: 'low', status: 'open' },
    { pm_id: pmId, tenant_id: tenants[2].id, unit_id: units[2].id, title: 'Front door lock sticking', description: 'Dead bolt sticks and requires two hands to lock. Key gets stuck occasionally.', priority: 'high', status: 'resolved' },
  ])

  const msgs = [
    [tenants[0].id, 'tenant', "Hey, the AC in 1A is still not working. It's been 2 days and it's really hot."],
    [tenants[0].id, 'pm', "Hi James, I've got an HVAC tech scheduled for tomorrow between 10am-2pm. You'll need to be home."],
    [tenants[0].id, 'tenant', "Ok I'll be here. What time exactly?"],
    [tenants[1].id, 'tenant', "Hi, just wanted to confirm my rent payment went through for this month?"],
    [tenants[1].id, 'pm', "Yes, received! You're all set Maya. Thanks for the heads up."],
    [tenants[1].id, 'tenant', "Great, thanks! Also the faucet drip seems to be getting worse..."],
    [tenants[2].id, 'pm', "David, rent was due on the 1st and we haven't received payment. Please reach out."],
    [tenants[2].id, 'tenant', "I know, I'm sorry. Can I pay half now and the rest by the 15th?"],
    [tenants[3].id, 'tenant', "Hi, this is to formally give my 30-day notice. My last day will be end of the month."],
    [tenants[3].id, 'pm', "Received Sarah, thanks for letting us know. I'll send you the move-out checklist."],
    [tenants[4].id, 'tenant', "Quick question — is parking spot 14 supposed to be mine? Someone else has been using it."],
    [tenants[5].id, 'tenant', "The exhaust fan in the bathroom is making a terrible noise. Submitted a ticket too."],
    [tenants[5].id, 'pm', "Got it Aisha, I'll get someone to look at it this week."],
  ]

  const messageRows = msgs.map(([tid, sender, body]) => ({
    pm_id: pmId, tenant_id: tid, sender, body,
    read: sender === 'pm',
    created_at: new Date(Date.now() - Math.random() * 72 * 3600000).toISOString()
  }))
  await db.from('messages').insert(messageRows)

  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = today.getFullYear()
  const dueDate = `${year}-${month}-01`
  const rentRows = tenants.map(t => ({
    pm_id: pmId,
    tenant_id: t.id,
    amount: t.monthly_rent,
    due_date: dueDate,
    status: t.status === 'late' ? 'late' : (Math.random() > 0.4 ? 'paid' : 'pending'),
    paid_date: t.status === 'late' ? null : (Math.random() > 0.4 ? dueDate : null),
  }))
  rentRows[2].status = 'late'
  rentRows[2].paid_date = null
  await db.from('rent_payments').insert(rentRows)

  toast('Demo data loaded! Refreshing…', 'success')
  setTimeout(() => window.location.reload(), 1200)
}
