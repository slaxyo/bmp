// supabase/functions/create-payment-link/index.ts
//
// Creates a Stripe Payment Link for a BMP Central invoice.
// Only callable by company admins.
//
// Request body: { invoice_id, amount, description, client_name }
// Returns: { url, payment_link_id }
//
// Deploy:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_xxx
//   supabase functions deploy create-payment-link

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Verify company admin
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: isAdmin } = await callerClient.rpc('is_company_admin')
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let body: { invoice_id: string; amount: number; description: string; client_name: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const { invoice_id, amount, description, client_name } = body
  if (!invoice_id || !amount || !description) {
    return new Response(JSON.stringify({ error: 'invoice_id, amount, and description are required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  if (!STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY not configured' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 1: Create a Stripe Price (one-off, inline product)
  const priceBody = new URLSearchParams({
    'unit_amount': String(Math.round(amount * 100)),
    'currency': 'usd',
    'product_data[name]': description,
    'product_data[metadata][client]': client_name,
  })

  const priceRes = await fetch('https://api.stripe.com/v1/prices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: priceBody.toString(),
  })
  const price = await priceRes.json()
  if (!priceRes.ok) {
    return new Response(JSON.stringify({ error: price.error?.message ?? 'Stripe price creation failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 2: Create the Payment Link
  const linkBody = new URLSearchParams({
    'line_items[0][price]': price.id,
    'line_items[0][quantity]': '1',
    'metadata[invoice_id]': invoice_id,
    'metadata[client_name]': client_name,
  })

  const linkRes = await fetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: linkBody.toString(),
  })
  const link = await linkRes.json()
  if (!linkRes.ok) {
    return new Response(JSON.stringify({ error: link.error?.message ?? 'Stripe payment link creation failed' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Step 3: Persist the link to the invoice row
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  await adminClient.from('bmp_invoices').update({
    stripe_payment_link: link.url,
    stripe_payment_link_id: link.id,
  }).eq('id', invoice_id)

  return new Response(
    JSON.stringify({ url: link.url, payment_link_id: link.id }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
