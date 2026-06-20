// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  unit: string
  property: string
  propertyId?: string
  rent: number
  leaseEnd: string
  status: 'active' | 'late' | 'notice' | 'past' | 'invited'
  email: string
  phone: string
  moveIn: string
}

export interface MaintenanceTicket {
  id: string
  tenantId: string
  tenantName: string
  unit: string
  property: string
  category: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'emergency'
  status: 'open' | 'in_progress' | 'resolved'
  createdAt: string
  updatedAt: string
  cost?: number
}

export interface Property {
  id: string
  name: string
  address: string
  city: string
  units: number
  occupied: number
  monthlyIncome: number
  openTickets: number
  tenants: {
    id: string
    name: string
    unit: string
    rent: number
    leaseEnd: string
  }[]
}

export interface RentRecord {
  id: string
  tenantId: string
  month: string
  amount: number
  datePaid: string
  method: string
  status: 'paid' | 'late' | 'pending'
}

export interface ChatMessage {
  id: string
  threadId: string
  senderId: 'tenant' | 'pm'
  senderName: string
  text: string
  timestamp: string
  sentAt: number
  edited: boolean
  originalText?: string
  unsent: boolean
}

export interface Thread {
  id: string
  tenantId: string
  tenantName: string
  tenantUnit: string
  unread: number
  lastMessage: string
  lastTime: string
}

// ─── Properties ──────────────────────────────────────────────────────────────

export const properties: Property[] = [
  {
    id: 'prop-1',
    name: '14 Oakwood Drive',
    address: '14 Oakwood Drive',
    city: 'Austin, TX',
    units: 4,
    occupied: 4,
    monthlyIncome: 5800,
    openTickets: 1,
    tenants: [
      { id: 't-1', name: 'Sarah Mitchell', unit: '1A', rent: 1450, leaseEnd: 'Dec 31, 2026' },
      { id: 't-2', name: 'Robert Kim', unit: '1B', rent: 1450, leaseEnd: 'Nov 30, 2026' },
      { id: 't-3', name: 'Emily Chen', unit: '2A', rent: 1500, leaseEnd: 'Oct 31, 2026' },
      { id: 't-4', name: 'Marcus Johnson', unit: '2B', rent: 1400, leaseEnd: 'Jan 31, 2027' },
    ],
  },
  {
    id: 'prop-2',
    name: '7 Maple Lane',
    address: '7 Maple Lane',
    city: 'Austin, TX',
    units: 4,
    occupied: 4,
    monthlyIncome: 5900,
    openTickets: 1,
    tenants: [
      { id: 't-5', name: 'Priya Sharma', unit: '3A', rent: 1500, leaseEnd: 'Feb 28, 2027' },
      { id: 't-6', name: 'David Park', unit: '3B', rent: 1450, leaseEnd: 'Sep 30, 2026' },
      { id: 't-7', name: 'Jessica Park', unit: '2A', rent: 1500, leaseEnd: 'Aug 31, 2026' },
      { id: 't-8', name: 'Tom Webb', unit: '4A', rent: 1450, leaseEnd: 'Mar 31, 2027' },
    ],
  },
  {
    id: 'prop-3',
    name: '12 Elmwood Court',
    address: '12 Elmwood Court',
    city: 'Austin, TX',
    units: 4,
    occupied: 3,
    monthlyIncome: 4200,
    openTickets: 0,
    tenants: [
      { id: 't-9', name: 'Ana Torres', unit: '1A', rent: 1400, leaseEnd: 'Dec 31, 2026' },
      { id: 't-10', name: 'Kevin Brooks', unit: '1B', rent: 1400, leaseEnd: 'Nov 30, 2026' },
      { id: 't-11', name: 'Nina Patel', unit: '3A', rent: 1400, leaseEnd: 'Oct 31, 2026' },
    ],
  },
]

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const tenants: Tenant[] = [
  {
    id: 't-1',
    name: 'Sarah Mitchell',
    unit: '1A',
    property: '14 Oakwood Drive',
    rent: 1450,
    leaseEnd: 'Dec 31, 2026',
    status: 'active',
    email: 'sarah.mitchell@email.com',
    phone: '+1 (512) 555-0101',
    moveIn: 'Jan 1, 2026',
  },
  {
    id: 't-2',
    name: 'Robert Kim',
    unit: '1B',
    property: '14 Oakwood Drive',
    rent: 1450,
    leaseEnd: 'Nov 30, 2026',
    status: 'active',
    email: 'r.kim@email.com',
    phone: '+1 (512) 555-0102',
    moveIn: 'Dec 1, 2025',
  },
  {
    id: 't-3',
    name: 'Emily Chen',
    unit: '2A',
    property: '14 Oakwood Drive',
    rent: 1500,
    leaseEnd: 'Oct 31, 2026',
    status: 'active',
    email: 'emily.chen@email.com',
    phone: '+1 (512) 555-0103',
    moveIn: 'Nov 1, 2025',
  },
  {
    id: 't-4',
    name: 'Marcus Johnson',
    unit: '2B',
    property: '14 Oakwood Drive',
    rent: 1400,
    leaseEnd: 'Jan 31, 2027',
    status: 'active',
    email: 'm.johnson@email.com',
    phone: '+1 (512) 555-0104',
    moveIn: 'Feb 1, 2026',
  },
  {
    id: 't-5',
    name: 'Priya Sharma',
    unit: '3A',
    property: '7 Maple Lane',
    rent: 1500,
    leaseEnd: 'Feb 28, 2027',
    status: 'active',
    email: 'priya.s@email.com',
    phone: '+1 (512) 555-0105',
    moveIn: 'Mar 1, 2026',
  },
  {
    id: 't-6',
    name: 'David Park',
    unit: '3B',
    property: '7 Maple Lane',
    rent: 1450,
    leaseEnd: 'Sep 30, 2026',
    status: 'active',
    email: 'd.park@email.com',
    phone: '+1 (512) 555-0106',
    moveIn: 'Oct 1, 2025',
  },
  {
    id: 't-7',
    name: 'Jessica Park',
    unit: '2A',
    property: '7 Maple Lane',
    rent: 1500,
    leaseEnd: 'Aug 31, 2026',
    status: 'notice',
    email: 'j.park@email.com',
    phone: '+1 (512) 555-0107',
    moveIn: 'Sep 1, 2025',
  },
  {
    id: 't-8',
    name: 'Tom Webb',
    unit: '4A',
    property: '7 Maple Lane',
    rent: 1450,
    leaseEnd: 'Mar 31, 2027',
    status: 'active',
    email: 't.webb@email.com',
    phone: '+1 (512) 555-0108',
    moveIn: 'Apr 1, 2026',
  },
  {
    id: 't-9',
    name: 'Ana Torres',
    unit: '1A',
    property: '12 Elmwood Court',
    rent: 1400,
    leaseEnd: 'Dec 31, 2026',
    status: 'active',
    email: 'a.torres@email.com',
    phone: '+1 (512) 555-0109',
    moveIn: 'Jan 1, 2026',
  },
  {
    id: 't-10',
    name: 'Kevin Brooks',
    unit: '1B',
    property: '12 Elmwood Court',
    rent: 1400,
    leaseEnd: 'Nov 30, 2026',
    status: 'active',
    email: 'k.brooks@email.com',
    phone: '+1 (512) 555-0110',
    moveIn: 'Dec 1, 2025',
  },
  {
    id: 't-11',
    name: 'Nina Patel',
    unit: '3A',
    property: '12 Elmwood Court',
    rent: 1400,
    leaseEnd: 'Oct 31, 2026',
    status: 'active',
    email: 'n.patel@email.com',
    phone: '+1 (512) 555-0111',
    moveIn: 'Nov 1, 2025',
  },
]

// ─── Maintenance Tickets ──────────────────────────────────────────────────────

export const maintenanceTickets: MaintenanceTicket[] = [
  {
    id: 'MT-001',
    tenantId: 't-1',
    tenantName: 'Sarah Mitchell',
    unit: '1A',
    property: '14 Oakwood Drive',
    category: 'Plumbing',
    title: 'Kitchen faucet leaking',
    description: 'The kitchen faucet has been dripping constantly for the past two days. Water is pooling under the sink.',
    priority: 'medium',
    status: 'open',
    createdAt: 'Jun 8, 2026',
    updatedAt: 'Jun 8, 2026',
    cost: 120,
  },
  {
    id: 'MT-002',
    tenantId: 't-6',
    tenantName: 'David Park',
    unit: '3B',
    property: '7 Maple Lane',
    category: 'HVAC',
    title: 'AC not cooling properly',
    description: 'The air conditioning unit is running but not bringing the temperature below 80°F even on the lowest setting.',
    priority: 'high',
    status: 'in_progress',
    createdAt: 'Jun 5, 2026',
    updatedAt: 'Jun 7, 2026',
    cost: 220,
  },
  {
    id: 'MT-003',
    tenantId: 't-3',
    tenantName: 'Emily Chen',
    unit: '2A',
    property: '14 Oakwood Drive',
    category: 'Electrical',
    title: 'Bedroom outlet not working',
    description: 'The outlet on the north wall of the master bedroom stopped working. Nothing plugged in receives power.',
    priority: 'medium',
    status: 'resolved',
    createdAt: 'May 28, 2026',
    updatedAt: 'Jun 1, 2026',
    cost: 85,
  },
]

// ─── Maintenance Analytics ────────────────────────────────────────────────────

export const ticketsByMonth = [
  { month: 'Jan', count: 3 },
  { month: 'Feb', count: 2 },
  { month: 'Mar', count: 4 },
  { month: 'Apr', count: 2 },
  { month: 'May', count: 4 },
  { month: 'Jun', count: 1 },
]

export const ticketsByType = [
  { name: 'Plumbing', value: 3, fill: '#2563EB' },
  { name: 'Electrical', value: 2, fill: '#7C3AED' },
  { name: 'HVAC', value: 2, fill: '#EA580C' },
  { name: 'Appliance', value: 1, fill: '#16A34A' },
  { name: 'Other', value: 1, fill: '#6B7280' },
]

// ─── Revenue Data ─────────────────────────────────────────────────────────────

export const revenueData = [
  { month: 'Jan', revenue: 14000, expenses: 1100 },
  { month: 'Feb', revenue: 14000, expenses: 980 },
  { month: 'Mar', revenue: 14000, expenses: 1350 },
  { month: 'Apr', revenue: 14000, expenses: 890 },
  { month: 'May', revenue: 14000, expenses: 1150 },
  { month: 'Jun', revenue: 14400, expenses: 1204 },
]

export const occupancyData = [
  { month: 'Jan', rate: 91.7 },
  { month: 'Feb', rate: 91.7 },
  { month: 'Mar', rate: 91.7 },
  { month: 'Apr', rate: 91.7 },
  { month: 'May', rate: 83.3 },
  { month: 'Jun', rate: 91.7 },
]

export const expenseBreakdown = [
  { name: 'Maintenance', value: 340, color: '#3B82F6' },
  { name: 'Insurance', value: 420, color: '#8B5CF6' },
  { name: 'Property Tax', value: 290, color: '#10B981' },
  { name: 'Management Fee', value: 144, color: '#F59E0B' },
  { name: 'Other', value: 10, color: '#6B7280' },
]

// ─── Rent Records ─────────────────────────────────────────────────────────────

export const rentRecords: RentRecord[] = [
  // Sarah Mitchell (t-1)
  { id: 'rr-1', tenantId: 't-1', month: 'June 2026', amount: 1450, datePaid: 'Jun 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-2', tenantId: 't-1', month: 'May 2026', amount: 1450, datePaid: 'May 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-3', tenantId: 't-1', month: 'April 2026', amount: 1450, datePaid: 'Apr 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-4', tenantId: 't-1', month: 'March 2026', amount: 1450, datePaid: 'Mar 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-5', tenantId: 't-1', month: 'February 2026', amount: 1450, datePaid: 'Feb 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-6', tenantId: 't-1', month: 'January 2026', amount: 1450, datePaid: 'Jan 2, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-7', tenantId: 't-1', month: 'December 2025', amount: 1450, datePaid: 'Dec 1, 2025', method: 'ACH', status: 'paid' },
  { id: 'rr-8', tenantId: 't-1', month: 'November 2025', amount: 1450, datePaid: 'Nov 1, 2025', method: 'ACH', status: 'paid' },
  // Robert Kim (t-2)
  { id: 'rr-9', tenantId: 't-2', month: 'June 2026', amount: 1450, datePaid: 'Jun 2, 2026', method: 'Check', status: 'paid' },
  { id: 'rr-10', tenantId: 't-2', month: 'May 2026', amount: 1450, datePaid: 'May 3, 2026', method: 'Check', status: 'paid' },
  { id: 'rr-11', tenantId: 't-2', month: 'April 2026', amount: 1450, datePaid: 'Apr 2, 2026', method: 'Check', status: 'paid' },
  // Emily Chen (t-3)
  { id: 'rr-12', tenantId: 't-3', month: 'June 2026', amount: 1500, datePaid: 'Jun 1, 2026', method: 'Zelle', status: 'paid' },
  { id: 'rr-13', tenantId: 't-3', month: 'May 2026', amount: 1500, datePaid: 'May 1, 2026', method: 'Zelle', status: 'paid' },
  // Marcus Johnson (t-4)
  { id: 'rr-14', tenantId: 't-4', month: 'June 2026', amount: 1400, datePaid: 'Jun 3, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-15', tenantId: 't-4', month: 'May 2026', amount: 1400, datePaid: 'May 2, 2026', method: 'ACH', status: 'paid' },
  // Priya Sharma (t-5)
  { id: 'rr-16', tenantId: 't-5', month: 'June 2026', amount: 1500, datePaid: 'Jun 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-17', tenantId: 't-5', month: 'May 2026', amount: 1500, datePaid: 'May 1, 2026', method: 'ACH', status: 'paid' },
  // David Park (t-6)
  { id: 'rr-18', tenantId: 't-6', month: 'June 2026', amount: 1450, datePaid: 'Jun 2, 2026', method: 'Venmo', status: 'paid' },
  // Jessica Park (t-7) — no June payment (on notice, overdue)
  { id: 'rr-19', tenantId: 't-7', month: 'May 2026', amount: 1500, datePaid: 'May 8, 2026', method: 'Check', status: 'late' },
  { id: 'rr-20', tenantId: 't-7', month: 'April 2026', amount: 1500, datePaid: 'Apr 3, 2026', method: 'Check', status: 'paid' },
  // Tom Webb (t-8) — no June payment (overdue)
  { id: 'rr-21', tenantId: 't-8', month: 'May 2026', amount: 1450, datePaid: 'May 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-22', tenantId: 't-8', month: 'April 2026', amount: 1450, datePaid: 'Apr 1, 2026', method: 'ACH', status: 'paid' },
  // Ana Torres (t-9)
  { id: 'rr-23', tenantId: 't-9', month: 'June 2026', amount: 1400, datePaid: 'Jun 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-24', tenantId: 't-9', month: 'May 2026', amount: 1400, datePaid: 'May 1, 2026', method: 'ACH', status: 'paid' },
  // Kevin Brooks (t-10)
  { id: 'rr-25', tenantId: 't-10', month: 'June 2026', amount: 1400, datePaid: 'Jun 4, 2026', method: 'Venmo', status: 'paid' },
  // Nina Patel (t-11)
  { id: 'rr-26', tenantId: 't-11', month: 'June 2026', amount: 1400, datePaid: 'Jun 1, 2026', method: 'ACH', status: 'paid' },
  { id: 'rr-27', tenantId: 't-11', month: 'May 2026', amount: 1400, datePaid: 'May 2, 2026', method: 'ACH', status: 'paid' },
]

// ─── Activity Feed ────────────────────────────────────────────────────────────

export const activityFeed = [
  { id: 'act-1', type: 'payment', text: 'Sarah Mitchell paid June rent — $1,450', time: '2 hours ago', icon: 'dollar' },
  { id: 'act-2', type: 'ticket', text: 'New maintenance request: Kitchen faucet leaking — Unit 1A', time: '5 hours ago', icon: 'wrench' },
  { id: 'act-3', type: 'payment', text: 'Robert Kim paid June rent — $1,450', time: '6 hours ago', icon: 'dollar' },
  { id: 'act-4', type: 'payment', text: 'Emily Chen paid June rent — $1,500', time: '8 hours ago', icon: 'dollar' },
  { id: 'act-5', type: 'ticket', text: 'MT-002 updated: AC repair scheduled for Jun 10', time: 'Yesterday', icon: 'wrench' },
  { id: 'act-6', type: 'lease', text: 'Lease renewal sent to Marcus Johnson — Unit 2B', time: 'Yesterday', icon: 'file' },
]

// ─── Message Threads ──────────────────────────────────────────────────────────

export const messageThreads: Thread[] = [
  {
    id: 'thread-1',
    tenantId: 't-1',
    tenantName: 'Sarah Mitchell',
    tenantUnit: '14 Oakwood Dr · Unit 1A',
    unread: 2,
    lastMessage: "Thanks for the update! I'll be home all day.",
    lastTime: '10:42 AM',
  },
  {
    id: 'thread-2',
    tenantId: 't-2',
    tenantName: 'Robert Kim',
    tenantUnit: '14 Oakwood Dr · Unit 1B',
    unread: 0,
    lastMessage: 'Sounds good, see you then.',
    lastTime: 'Yesterday',
  },
]

// Base time anchored to Jun 11 2026 (demo date) — offsets in ms
const _d = new Date('2026-06-11T12:00:00').getTime()
const _day = 86400000

export const chatMessages: ChatMessage[] = [
  // Sarah Mitchell thread
  {
    id: 'msg-1',
    threadId: 'thread-1',
    senderId: 'tenant',
    senderName: 'Sarah Mitchell',
    text: 'Hi! Just wanted to follow up on the kitchen faucet issue I reported. Any update on when someone can come by?',
    timestamp: 'Jun 8, 2026 · 9:15 AM',
    sentAt: _d - 3 * _day - 165 * 60000,
    edited: false,
    unsent: false,
  },
  {
    id: 'msg-2',
    threadId: 'thread-1',
    senderId: 'pm',
    senderName: 'BMP Central',
    text: 'Hi Sarah! We have a plumber scheduled for Thursday June 12 between 9am and 12pm. Does that work for you?',
    timestamp: 'Jun 8, 2026 · 9:58 AM',
    sentAt: _d - 3 * _day - 122 * 60000,
    edited: true,
    originalText: 'Hi Sarah! We have a plumber scheduled for Thursday June 13. Does that work for you?',
    unsent: false,
  },
  {
    id: 'msg-3',
    threadId: 'thread-1',
    senderId: 'tenant',
    senderName: 'Sarah Mitchell',
    text: "Thanks for the update! I'll be home all day.",
    timestamp: 'Jun 8, 2026 · 10:42 AM',
    sentAt: _d - 3 * _day - 78 * 60000,
    edited: false,
    unsent: false,
  },
  {
    id: 'msg-4',
    threadId: 'thread-1',
    senderId: 'pm',
    senderName: 'BMP Central',
    text: 'Great! The plumber will call 30 minutes before arrival.',
    timestamp: 'Jun 8, 2026 · 10:45 AM',
    sentAt: _d - 3 * _day - 75 * 60000,
    edited: false,
    unsent: true,
  },
  // Robert Kim thread
  {
    id: 'msg-5',
    threadId: 'thread-2',
    senderId: 'pm',
    senderName: 'BMP Central',
    text: 'Hi Robert, just a reminder that your lease renewal is due by June 30. Would you like to schedule a time to discuss?',
    timestamp: 'Jun 5, 2026 · 2:00 PM',
    sentAt: _d - 6 * _day - 600 * 60000,
    edited: false,
    unsent: false,
  },
  {
    id: 'msg-6',
    threadId: 'thread-2',
    senderId: 'tenant',
    senderName: 'Robert Kim',
    text: "Hi! Yes, I'm planning to renew. Can we chat next week?",
    timestamp: 'Jun 5, 2026 · 3:22 PM',
    sentAt: _d - 6 * _day - 518 * 60000,
    edited: false,
    unsent: false,
  },
  {
    id: 'msg-7',
    threadId: 'thread-2',
    senderId: 'pm',
    senderName: 'BMP Central',
    text: 'Absolutely! How does Tuesday June 11 at 10am work for a call?',
    timestamp: 'Jun 5, 2026 · 3:45 PM',
    sentAt: _d - 6 * _day - 495 * 60000,
    edited: false,
    unsent: false,
  },
  {
    id: 'msg-8',
    threadId: 'thread-2',
    senderId: 'tenant',
    senderName: 'Robert Kim',
    text: 'Sounds good, see you then.',
    timestamp: 'Jun 5, 2026 · 4:01 PM',
    sentAt: _d - 6 * _day - 479 * 60000,
    edited: false,
    unsent: false,
  },
]
