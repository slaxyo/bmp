import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Copy, ExternalLink, Pencil, Save, X,
  Mail, Phone, Building2, DollarSign, FileText, Trash2, Send,
} from 'lucide-react'
import { useClientDetail } from '../hooks/useClientDetail'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL as string | undefined
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL as string | undefined

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    void: 'bg-gray-100 text-gray-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

function clientStatusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-blue-100 text-blue-600',
    overdue: 'bg-red-100 text-red-700',
    suspended: 'bg-orange-100 text-orange-700',
    canceled: 'bg-gray-100 text-gray-400',
  }
  return map[status] ?? 'bg-gray-100 text-gray-500'
}

const PLAN_OPTIONS = ['basic', 'pro', 'enterprise', 'custom']
const STATUS_OPTIONS = ['pending', 'active', 'overdue', 'suspended', 'canceled']

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { detail, loading, refresh } = useClientDetail(id ?? '')
  const { client, invoices } = detail

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Add invoice form
  const [showAddInvoice, setShowAddInvoice] = useState(false)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceDue, setInvoiceDue] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0])
  const [invoiceNotes, setInvoiceNotes] = useState('')
  const [addingInvoice, setAddingInvoice] = useState(false)

  const [generatingLink, setGeneratingLink] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  function startEdit() {
    if (!client) return
    setEditForm({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      company_name: client.company_name,
      plan: client.plan,
      monthly_fee: String(client.monthly_fee),
      status: client.status,
      notes: client.notes ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!client) return
    setSaving(true)
    const { error } = await supabase.from('bmp_clients').update({
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone || null,
      company_name: editForm.company_name,
      plan: editForm.plan,
      monthly_fee: parseFloat(editForm.monthly_fee),
      status: editForm.status,
      notes: editForm.notes || null,
    }).eq('id', client.id)
    if (error) {
      showToast('Failed to save changes', 'error')
    } else {
      showToast('Client updated')
      setEditing(false)
      refresh()
    }
    setSaving(false)
  }

  async function addInvoice() {
    if (!client || !invoiceAmount || !invoiceDue) return
    setAddingInvoice(true)
    const { error } = await supabase.from('bmp_invoices').insert({
      client_id: client.id,
      amount: parseFloat(invoiceAmount),
      due_date: invoiceDue,
      status: 'pending',
      notes: invoiceNotes || null,
    })
    if (error) {
      showToast('Failed to create invoice', 'error')
    } else {
      showToast('Invoice created')
      setShowAddInvoice(false)
      setInvoiceAmount('')
      setInvoiceNotes('')
      refresh()
    }
    setAddingInvoice(false)
  }

  async function markPaid(invoiceId: string) {
    const { error } = await supabase.from('bmp_invoices').update({
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
    }).eq('id', invoiceId)
    if (error) showToast('Failed to update invoice', 'error')
    else { showToast('Marked as paid'); refresh() }
  }

  async function voidInvoice(invoiceId: string) {
    const { error } = await supabase.from('bmp_invoices').update({ status: 'void' }).eq('id', invoiceId)
    if (error) showToast('Failed to void invoice', 'error')
    else { showToast('Invoice voided'); refresh() }
  }

  async function generatePaymentLink(invoiceId: string, amount: number) {
    if (!FUNCTIONS_URL) { showToast('VITE_FUNCTIONS_URL not configured', 'error'); return }
    setGeneratingLink(invoiceId)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch(`${FUNCTIONS_URL}/create-payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount,
          description: `BMP Central — ${client?.company_name} — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          client_name: client?.company_name ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Failed to generate link', 'error'); return }
      showToast('Payment link generated')
      refresh()
    } catch {
      showToast('Network error', 'error')
    } finally {
      setGeneratingLink(null)
    }
  }

  async function resendInvite() {
    if (!client || !FUNCTIONS_URL) {
      showToast('VITE_FUNCTIONS_URL not configured', 'error')
      return
    }
    setResending(true)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      if (!client.portal_pm_id) {
        // Portal never provisioned — create auth user + branding + sends Supabase invite email
        const res = await fetch(`${FUNCTIONS_URL}/create-portal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ email: client.email, full_name: client.name, company_name: client.company_name, portal_url: PORTAL_URL }),
        })
        const json = await res.json()
        if (!res.ok) { showToast(json.error ?? 'Failed to send invite', 'error'); return }
        await supabase.from('bmp_clients').update({ portal_pm_id: json.pm_id, status: 'active' }).eq('id', client.id)
        showToast('Portal provisioned & invite sent to ' + client.email)
        refresh()
      } else {
        // Portal exists — send a direct welcome email via send-notification
        const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;background:#f3f4f6;padding:24px">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
            <div style="background:#2563EB;padding:20px 24px"><h1 style="margin:0;color:#fff;font-size:16px">Your BMP Central portal</h1></div>
            <div style="padding:24px">
              <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Hi ${client.name},<br/><br/>Here's a reminder that your property management portal is ready. Log in any time to manage your properties, tenants, and more.</p>
            </div>
          </div>
        </body></html>`
        const res = await fetch(`${FUNCTIONS_URL}/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ to: client.email, subject: 'Your BMP Central portal', html }),
        })
        const json = await res.json()
        if (!res.ok) { showToast(json.error ?? 'Failed to send email', 'error'); return }
        showToast('Invite email resent to ' + client.email)
      }
    } catch {
      showToast('Network error — could not send invite', 'error')
    } finally {
      setResending(false)
    }
  }

  async function deleteClient() {
    if (!client) return
    if (!confirm(`Delete ${client.company_name}? This cannot be undone.`)) return
    const { error } = await supabase.from('bmp_clients').delete().eq('id', client.id)
    if (error) showToast('Failed to delete client', 'error')
    else { showToast('Client deleted'); navigate('/clients') }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Client not found.</p>
        <Link to="/clients" className="text-blue-600 text-sm mt-2 inline-block">Back to clients</Link>
      </div>
    )
  }

  const totalOwed = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" />
        Back to clients
      </Link>

      {/* Client card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500">Company name</label>
                    <input value={editForm.company_name} onChange={(e) => setEditForm((f) => ({ ...f, company_name: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Contact name</label>
                    <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Email</label>
                    <input value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Phone</label>
                    <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Plan</label>
                    <select value={editForm.plan} onChange={(e) => setEditForm((f) => ({ ...f, plan: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {PLAN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Monthly fee ($)</label>
                    <input type="number" value={editForm.monthly_fee} onChange={(e) => setEditForm((f) => ({ ...f, monthly_fee: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Status</label>
                    <select value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Notes</label>
                  <textarea value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={3} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                    <Save className="w-4 h-4" />{saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                    <X className="w-4 h-4" />Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">{client.company_name}</h1>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${clientStatusBadge(client.status)}`}>
                    {client.status}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{client.plan}</span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" />{client.name}</span>
                  <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" />{client.email}</span>
                  {client.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{client.phone}</span>}
                  <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" />{fmtMoney(client.monthly_fee)}/mo</span>
                </div>
                {client.notes && (
                  <p className="mt-3 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{client.notes}</p>
                )}
                <div className="flex gap-3 mt-3">
                  <span className="text-xs text-gray-400">Portal: {client.portal_pm_id ? <span className="text-green-600 font-medium">Active</span> : <span className="text-gray-400">Not provisioned</span>}</span>
                  <span className="text-xs text-gray-400">· Client since {new Date(client.created_at).toLocaleDateString()}</span>
                </div>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex gap-2 shrink-0">
              {FUNCTIONS_URL && (
                <button
                  onClick={resendInvite}
                  disabled={resending}
                  title={client.portal_pm_id ? 'Resend portal invite email' : 'Provision portal & send invite'}
                  className="flex items-center gap-1.5 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {resending ? 'Sending…' : client.portal_pm_id ? 'Resend invite' : 'Send invite'}
                </button>
              )}
              <button onClick={startEdit}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
                <Pencil className="w-3.5 h-3.5" />Edit
              </button>
              <button onClick={deleteClient}
                className="flex items-center gap-1.5 border border-red-200 text-red-500 px-3 py-1.5 rounded-lg text-sm hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Billing summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Total paid</p>
          <p className="text-xl font-bold text-green-600 mt-1">{fmtMoney(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-xl font-bold text-yellow-600 mt-1">{fmtMoney(totalOwed)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-xs text-gray-500">Monthly rate</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{fmtMoney(client.monthly_fee)}</p>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Invoices</h2>
          <button
            onClick={() => setShowAddInvoice(true)}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />New invoice
          </button>
        </div>

        {/* Add invoice form */}
        {showAddInvoice && (
          <div className="px-5 py-4 border-b border-blue-50 bg-blue-50/40">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs font-medium text-gray-600">Amount ($)</label>
                <input
                  type="number"
                  placeholder={String(client.monthly_fee)}
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="mt-1 w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Due date</label>
                <input
                  type="date"
                  value={invoiceDue}
                  onChange={(e) => setInvoiceDue(e.target.value)}
                  className="mt-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-40">
                <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
                <input
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="e.g. April 2025 subscription"
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button onClick={addInvoice} disabled={addingInvoice || !invoiceAmount}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {addingInvoice ? 'Adding…' : 'Add'}
              </button>
              <button onClick={() => setShowAddInvoice(false)}
                className="text-gray-400 hover:text-gray-600 px-2 py-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {invoices.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">No invoices yet. Create one to start billing.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payment link</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{fmtMoney(inv.amount)}</td>
                  <td className="px-4 py-3.5 text-gray-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-400 text-xs hidden md:table-cell max-w-xs truncate">
                    {inv.notes || '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    {inv.stripe_payment_link ? (
                      <div className="flex items-center gap-1.5">
                        <a href={inv.stripe_payment_link} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1">
                          Open <ExternalLink className="w-3 h-3" />
                        </a>
                        <button onClick={() => { navigator.clipboard.writeText(inv.stripe_payment_link!); showToast('Link copied') }}
                          className="text-gray-400 hover:text-gray-600">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : inv.status !== 'paid' && inv.status !== 'void' ? (
                      <button
                        onClick={() => generatePaymentLink(inv.id, inv.amount)}
                        disabled={generatingLink === inv.id}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                      >
                        {generatingLink === inv.id ? 'Generating…' : '+ Generate link'}
                      </button>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5">
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <div className="flex gap-2">
                        <button onClick={() => markPaid(inv.id)}
                          className="text-xs text-green-600 hover:text-green-700 font-medium">
                          Mark paid
                        </button>
                        <button onClick={() => voidInvoice(inv.id)}
                          className="text-xs text-gray-400 hover:text-gray-600">
                          Void
                        </button>
                      </div>
                    )}
                    {inv.status === 'paid' && inv.paid_date && (
                      <span className="text-xs text-gray-400">Paid {new Date(inv.paid_date).toLocaleDateString()}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
