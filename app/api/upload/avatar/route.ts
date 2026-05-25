import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const BUCKET       = 'avatars'
const MAX_BYTES    = 2 * 1024 * 1024 // 2 MB
const SUPER_ADMIN  = (process.env.SUPER_ADMIN_WALLET ?? '').toLowerCase()
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function POST(req: NextRequest) {
  try {
    const form   = await req.formData()
    const file   = form.get('file')   as File   | null
    const wallet = (form.get('wallet') as string | null)?.toLowerCase() ?? ''
    const slug   = form.get('slug')   as string | null

    if (!file || !wallet || !slug) {
      return NextResponse.json({ error: 'file, wallet and slug are required' }, { status: 400 })
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP or GIF allowed' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Max file size is 2 MB' }, { status: 400 })
    }

    // Auth: super-admin can upload for any project; project admin only for their own
    let projectId:   string
    let oldAvatarUrl: string | null = null

    if (wallet === SUPER_ADMIN) {
      const { data: proj } = await supabaseAdmin
        .from('projects').select('id, avatar_url').eq('slug', slug).maybeSingle()
      if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      projectId    = proj.id
      oldAvatarUrl = proj.avatar_url
    } else {
      const { data: proj } = await supabaseAdmin
        .from('projects').select('id, avatar_url')
        .eq('slug', slug).eq('admin_wallet', wallet).maybeSingle()
      if (!proj) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      projectId    = proj.id
      oldAvatarUrl = proj.avatar_url
    }

    // Delete old avatar if it lives in our bucket
    if (oldAvatarUrl) {
      const marker = `/object/public/${BUCKET}/`
      const idx    = oldAvatarUrl.indexOf(marker)
      if (idx !== -1) {
        const oldPath = oldAvatarUrl.slice(idx + marker.length)
        await supabaseAdmin.storage.from(BUCKET).remove([oldPath])
      }
    }

    // Upload new file
    const ext      = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
    const path     = `projects/${slug}/avatar.${ext}`
    const buffer   = Buffer.from(await file.arrayBuffer())

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    // Build public URL (add cache-busting so browsers pick up the change)
    const { data: { publicUrl } } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const urlWithBust = `${publicUrl}?t=${Date.now()}`

    // Persist in DB
    await supabaseAdmin
      .from('projects')
      .update({ avatar_url: urlWithBust, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    return NextResponse.json({ url: urlWithBust })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
