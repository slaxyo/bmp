// Mirrors the actual Supabase schema. The 7 core tables (properties, units,
// owners, tenants, maintenance_requests, rent_payments, messages) pre-exist
// and are scoped by pm_id; profiles/documents/activity_log are added by
// supabase/migrations/002_portal_extensions.sql.
export type Database = {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
    Tables: {
      profiles: {
        Row: { id: string; role: string; full_name: string; email: string; phone: string | null; avatar_url: string | null; title: string | null; company: string | null; bio: string | null; notification_preferences: Record<string, unknown> | null; user_preferences: Record<string, unknown> | null; created_at: string }
        Insert: { id: string; role?: string; full_name?: string; email?: string; phone?: string | null; avatar_url?: string | null; title?: string | null; company?: string | null; bio?: string | null }
        Update: { role?: string; full_name?: string; email?: string; phone?: string | null; avatar_url?: string | null; title?: string | null; company?: string | null; bio?: string | null; notification_preferences?: Record<string, unknown> | null; user_preferences?: Record<string, unknown> | null }
        Relationships: []
      }
      properties: {
        Row: { id: string; pm_id: string; owner_id: string | null; name: string; address: string | null; city: string | null; state: string | null; zip: string | null; mortgage_payment: number | null; insurance_monthly: number | null; tax_monthly: number | null; created_at: string | null }
        Insert: { id?: string; pm_id: string; owner_id?: string | null; name: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; mortgage_payment?: number | null; insurance_monthly?: number | null; tax_monthly?: number | null }
        Update: { owner_id?: string | null; name?: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; mortgage_payment?: number | null; insurance_monthly?: number | null; tax_monthly?: number | null }
        Relationships: []
      }
      units: {
        Row: { id: string; property_id: string; pm_id: string | null; unit_number: string; bedrooms: number | null; bathrooms: number | null; sqft: number | null; rent_amount: number | null; status: string | null; created_at: string | null }
        Insert: { id?: string; property_id: string; pm_id?: string | null; unit_number: string; bedrooms?: number | null; bathrooms?: number | null; sqft?: number | null; rent_amount?: number | null; status?: string | null }
        Update: { pm_id?: string | null; unit_number?: string; bedrooms?: number | null; bathrooms?: number | null; sqft?: number | null; rent_amount?: number | null; status?: string | null }
        Relationships: []
      }
      owners: {
        Row: { id: string; pm_id: string; name: string; email: string | null; phone: string | null; notes: string | null; created_at: string | null }
        Insert: { id?: string; pm_id: string; name: string; email?: string | null; phone?: string | null; notes?: string | null }
        Update: { name?: string; email?: string | null; phone?: string | null; notes?: string | null }
        Relationships: []
      }
      tenants: {
        Row: { id: string; pm_id: string; unit_id: string | null; name: string; email: string | null; phone: string | null; lease_start: string | null; lease_end: string | null; monthly_rent: number | null; status: string | null; notes: string | null; created_at: string | null }
        Insert: { id?: string; pm_id: string; unit_id?: string | null; name: string; email?: string | null; phone?: string | null; lease_start?: string | null; lease_end?: string | null; monthly_rent?: number | null; status?: string | null; notes?: string | null }
        Update: { unit_id?: string | null; name?: string; email?: string | null; phone?: string | null; lease_start?: string | null; lease_end?: string | null; monthly_rent?: number | null; status?: string | null; notes?: string | null }
        Relationships: []
      }
      maintenance_requests: {
        Row: { id: string; pm_id: string; tenant_id: string | null; unit_id: string | null; title: string; description: string | null; priority: string | null; status: string | null; created_at: string | null; updated_at: string | null }
        Insert: { id?: string; pm_id: string; tenant_id?: string | null; unit_id?: string | null; title: string; description?: string | null; priority?: string | null; status?: string | null }
        Update: { title?: string; description?: string | null; priority?: string | null; status?: string | null; updated_at?: string | null }
        Relationships: []
      }
      rent_payments: {
        Row: { id: string; pm_id: string; tenant_id: string; amount: number; due_date: string; paid_date: string | null; status: string | null; note: string | null; created_at: string | null }
        Insert: { id?: string; pm_id: string; tenant_id: string; amount: number; due_date: string; paid_date?: string | null; status?: string | null; note?: string | null }
        Update: { amount?: number; due_date?: string; paid_date?: string | null; status?: string | null; note?: string | null }
        Relationships: []
      }
      messages: {
        Row: { id: string; pm_id: string; tenant_id: string; sender: string; body: string; read: boolean | null; created_at: string | null }
        Insert: { id?: string; pm_id: string; tenant_id: string; sender: string; body: string; read?: boolean | null }
        Update: { body?: string; read?: boolean | null }
        Relationships: []
      }
      documents: {
        Row: { id: string; name: string; type: string; storage_path: string | null; size_bytes: number | null; property_id: string | null; tenant_id: string | null; uploaded_by: string | null; created_at: string }
        Insert: { name: string; type: string; storage_path?: string | null; size_bytes?: number | null; property_id?: string | null; tenant_id?: string | null; uploaded_by?: string | null }
        Update: { name?: string; type?: string; storage_path?: string | null }
        Relationships: []
      }
      activity_log: {
        Row: { id: string; admin_id: string | null; type: string; text: string; created_at: string }
        Insert: { admin_id?: string | null; type: string; text: string }
        Update: Record<string, never>
        Relationships: []
      }
      notifications: {
        Row: { id: string; user_id: string; type: string; title: string; body: string; link: string | null; read: boolean; created_at: string }
        Insert: { user_id: string; type?: string; title: string; body?: string; link?: string | null; read?: boolean }
        Update: { read?: boolean }
        Relationships: []
      }
      branding: {
        Row: { pm_id: string; company_name: string; tagline: string | null; logo_url: string | null; primary_color: string; updated_at: string }
        Insert: { pm_id: string; company_name?: string; tagline?: string | null; logo_url?: string | null; primary_color?: string; updated_at?: string }
        Update: { company_name?: string; tagline?: string | null; logo_url?: string | null; primary_color?: string; updated_at?: string }
        Relationships: []
      }
      company_admins: {
        Row: { id: string; user_id: string; created_at: string }
        Insert: { id?: string; user_id: string; created_at?: string }
        Update: Record<string, never>
        Relationships: []
      }
    }
  }
}
