import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export interface ProfileData {
  full_name: string
  email: string
  phone: string
  title: string
  company: string
  bio: string
  avatar_url: string | null
  notification_preferences: Record<string, boolean> | null
  user_preferences: Record<string, unknown> | null
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase
      .from('profiles')
      .select('full_name, email, phone, title, company, bio, avatar_url, notification_preferences, user_preferences')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as ProfileData)
        setLoading(false)
      })
  }, [user?.id])

  async function saveProfile(updates: Partial<ProfileData>): Promise<string | null> {
    if (!user) return 'Not authenticated'
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)
    if (!error) setProfile(prev => prev ? { ...prev, ...updates } : null)
    return error?.message ?? null
  }

  async function uploadAvatar(file: File): Promise<{ url: string | null; error: string | null }> {
    if (!user) return { url: null, error: 'Not authenticated' }
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) return { url: null, error: upErr.message }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    await saveProfile({ avatar_url: data.publicUrl })
    return { url: data.publicUrl, error: null }
  }

  return { profile, loading, saveProfile, uploadAvatar, setProfile }
}
