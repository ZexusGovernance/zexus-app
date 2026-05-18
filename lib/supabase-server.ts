import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

let _admin: ReturnType<typeof createClient> | null = null
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_admin) _admin = getSupabaseAdmin()
    return (_admin as Record<string | symbol, unknown>)[prop]
  },
})
