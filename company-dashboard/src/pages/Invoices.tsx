import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, ExternalLink, FileText } from 'lucide-react'
import { useInvoices } from '../hooks/useInvoices'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL as string | undefined

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

const STATUS_FILTERS = ['all', 'pending', 'overdue', 'paid', 'void']

export function Invoices() {
  const { invoices, loading, refresh } = useInvoices()
  const [statusFilter, setStatusFilter] = useState('all')
  const [generatingLink, setGeneratingLink] = useState<string | null>(null)

  const filtered = statusFilter === 'all' ? invoices : invoices.filter((i) => i.status === statusFilter)

  const totalPending = invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').reduce((s, i) => s + i.amount, 0)
  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount, 0)

  async function markPaid(invoiceId: string) {
    const { error } = await supabase.from('bmp_invoices').update({
      status: 'paid',
      paid_date: new Date().toISOString().split('T')[0],
    }).eq('id', invoiceId)
    if (error) showToast('Failed to update', 'error')
    else { showToast('Marked as paid'); refresh() }
  }

  async function generatePaymentLink(inv: typeof invoices[0]) {
    if (!FUNCTIONS_URL) { showToast('VITE_FUNCTIONS_URL not configured', 'error'); return }
    setGeneratingLink(inv.id)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch(`${FUNCTIONS_URL}/create-payment-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          invoice_id: inv.id,
          amount: inv.amount,
          description: `BMP Central — ${inv.client_company || inv.client_name}`,
          client_name: inv.client_company || inv.client_name || '',
        }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? 'Failed', 'error'); return }
      showToast('Payment link generated')
      refresh()
    } catch {
      showToast('Network error', 'error')
    } finally {
      setGeneratingLink(null)
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <p className="text-sm text-gray-500 mt-0.5">{invoices.length} total invoices</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{fmtMoney(totalPending)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total collected</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{fmtMoney(totalPaid)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              statusFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
            {s !== 'all' && (
              <span className="ml-1.5 opacity-70">
                ({invoices.filter((i) => i.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No invoices found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Client</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Due</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Payment link</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5">
                    <Link to={`/clients/${inv.client_id}`} className="font-medium text-gray-900 hover:text-blue-600">
                      {inv.client_company || inv.client_name}
                    </Link>
                    {inv.notes && <p className="text-xs text-gray-400">{inv.notes}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-gray-900">{fmtMoney(inv.amount)}</td>
                  <td className="px-4 py-3.5 text-gray-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(inv.status)}`}>
                      {inv.status}
                    </span>
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
                      <button onClick={() => generatePaymentLink(inv)} disabled={generatingLink === inv.id}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50">
                        {generatingLink === inv.id ? 'Generating…' : '+ Generate link'}
                      </button>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {inv.status !== 'paid' && inv.status !== 'void' && (
                      <button onClick={() => markPaid(inv.id)}
                        className="text-xs text-green-600 hover:text-green-700 font-medium">
                        Mark paid
                      </button>
                    )}
                    {inv.status === 'paid' && inv.paid_date && (
                      <span className="text-xs text-gray-400">{new Date(inv.paid_date).toLocaleDateString()}</span>
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
