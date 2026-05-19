'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { FeedPost, PostType } from '@/lib/feedData'
import { PROJECTS_FULL } from '@/lib/projects'
import { supabase } from '@/lib/supabase'

interface CreatePostModalProps {
  onClose: () => void
  onPublish: (post: FeedPost) => void
  walletAddress: string
  projectName: string
}

const MAX_BYTES = 2 * 1024 * 1024
const MAX_IMAGES = 3

const TYPES = [
  { type: 'update'  as PostType, label: 'Update',  icon: 'ti-speakerphone',   color: '#5a82c9', desc: 'Announce a development or update' },
  { type: 'verdict' as PostType, label: 'Verdict', icon: 'ti-shield-check',   color: '#4caf7d', desc: 'Community-confirmed milestone' },
  { type: 'alert'   as PostType, label: 'Alert',   icon: 'ti-alert-triangle', color: '#e07070', desc: 'Report a risk or emergency' },
]

interface ImageItem { file: File; preview: string }

export default function CreatePostModal({ onClose, onPublish, walletAddress, projectName }: CreatePostModalProps) {
  const [type, setType]             = useState<PostType>('update')
  const [title, setTitle]           = useState('')
  const [content, setContent]       = useState('')
  const [images, setImages]         = useState<ImageItem[]>([])
  const [imgError, setImgError]     = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [uploadPct, setUploadPct]   = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const meta = TYPES.find(t => t.type === type)!
  const canPublish = title.trim().length > 0 && content.trim().length > 0 && content.length <= 2500 && !publishing

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const addImages = useCallback((files: FileList) => {
    setImgError(null)
    const arr = Array.from(files)
    const valid: ImageItem[] = []
    for (const f of arr) {
      if (!f.type.startsWith('image/')) { setImgError('Only image files allowed'); continue }
      if (f.size > MAX_BYTES) { setImgError(`${f.name} exceeds 2 MB limit`); continue }
      if (images.length + valid.length >= MAX_IMAGES) { setImgError(`Max ${MAX_IMAGES} images`); break }
      valid.push({ file: f, preview: URL.createObjectURL(f) })
    }
    setImages(prev => [...prev, ...valid].slice(0, MAX_IMAGES))
  }, [images])

  const removeImage = (i: number) => {
    setImages(prev => { URL.revokeObjectURL(prev[i].preview); return prev.filter((_, idx) => idx !== i) })
  }

  const handlePublish = async () => {
    if (!canPublish) return
    setPublishing(true); setUploadPct(10)

    try {
      const urls: string[] = []
      for (let i = 0; i < images.length; i++) {
        const { file } = images[i]
        const ext  = file.name.split('.').pop()
        const path = `posts/${Date.now()}-${i}.${ext}`
        const { error } = await supabase.storage.from('post-images').upload(path, file, { cacheControl: '3600' })
        if (error) { console.warn('Image upload skipped:', error.message); continue }
        const { data } = supabase.storage.from('post-images').getPublicUrl(path)
        urls.push(data.publicUrl)
        setUploadPct(10 + Math.round((i + 1) / images.length * 50))
      }
      setUploadPct(65)

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          post_type: type,
          title: title.trim() || null,
          content: content.trim(),
          image_url: urls[0] ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Publish failed')
      }
      const { post: newPost } = await res.json() as {
        post: { id: string; projects: { id: string; slug: string; name: string; category: string | null } }
      }
      setUploadPct(100)

      const pName = newPost.projects?.name ?? projectName
      const proj  = PROJECTS_FULL.find(p => p.name === pName)
      const feedPost: FeedPost = {
        id:          newPost.id,
        type,
        project:     pName,
        projectSlug: newPost.projects?.slug ?? undefined,
        projectId:   newPost.projects?.id   ?? undefined,
        av:          proj?.av ?? 'av-blue',
        letter:      pName[0]?.toUpperCase() ?? '?',
        sub:         newPost.projects?.category ?? 'Protocol',
        title:       title.trim(),
        text:        content.trim(),
        detailText:  content.trim(),
        time:        'Just now',
        comments:    [],
        images:      urls.length > 0 ? urls : undefined,
      }
      onPublish(feedPost)
      onClose()
    } catch (err) {
      console.error(err)
      setImgError(err instanceof Error ? err.message : 'Publish failed. Check console.')
      setPublishing(false); setUploadPct(0)
    }
  }

  return (
    <div className="post-modal-overlay" onClick={onClose}>
      <div className="post-modal create-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>

        {/* ── Header ── */}
        <div className="post-modal-head">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            Create Post · <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{projectName}</span>
          </div>
          <button className="post-modal-close" onClick={onClose}><i className="ph-bold ph-x" /></button>
        </div>

        <div className="post-modal-scroll" style={{ padding: '0 0 4px' }}>

          {/* ── Type selector ── */}
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>Post type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {TYPES.map(t => {
                const active = type === t.type
                return (
                  <button
                    key={t.type}
                    onClick={() => setType(t.type)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '10px 4px 8px', borderRadius: 12, cursor: 'pointer', border: 'none',
                      background: active ? `color-mix(in srgb,${t.color} 12%,var(--surface2))` : 'var(--surface2)',
                      outline: active ? `1.5px solid ${t.color}` : '1px solid var(--border2)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <i className={`ti ${t.icon}`} style={{ fontSize: 18, color: active ? t.color : 'var(--muted)' }} />
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {t.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, paddingBottom: 14, borderBottom: '0.5px solid var(--border)' }}>
              <i className={`ti ${meta.icon}`} style={{ color: meta.color, marginRight: 5 }} />
              {meta.desc}
            </div>
          </div>

          {/* ── Form ── */}
          <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Title */}
            <div className="create-field" style={{ marginBottom: 0 }}>
              <label className="create-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TITLE</span>
                <span style={{ color: 'var(--muted2)', fontWeight: 400 }}>{title.length}/100</span>
              </label>
              <input className="create-input" placeholder="Short, descriptive headline…"
                value={title} onChange={e => setTitle(e.target.value)} maxLength={100} autoFocus />
            </div>

            {/* Content */}
            <div className="create-field" style={{ marginBottom: 0 }}>
              <label className="create-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CONTENT</span>
                <span style={{ color: content.length > 2400 ? 'var(--red)' : 'var(--muted2)', fontWeight: 400 }}>{content.length}/2500</span>
              </label>
              <textarea className="create-textarea" rows={5} style={{ minHeight: 120 }}
                placeholder="Describe the event in detail…"
                maxLength={2500}
                value={content} onChange={e => setContent(e.target.value)} />
            </div>

            {/* ── Images ── */}
            <div className="create-field" style={{ marginBottom: 0 }}>
              <label className="create-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>IMAGES (optional · max {MAX_IMAGES} · 2 MB each)</span>
                <span style={{ color: 'var(--muted2)' }}>{images.length}/{MAX_IMAGES}</span>
              </label>
              {images.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {images.map((img, i) => (
                    <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                      <img src={img.preview} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, display: 'block', border: '0.5px solid var(--border2)' }} />
                      <button onClick={() => removeImage(i)}
                        style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%',
                          background: 'var(--red)', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="ph-bold ph-x" />
                      </button>
                    </div>
                  ))}
                  {images.length < MAX_IMAGES && (
                    <button onClick={() => fileRef.current?.click()}
                      style={{ width: 72, height: 72, borderRadius: 8, border: '1.5px dashed var(--border2)', background: 'var(--surface2)',
                        color: 'var(--muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 3, fontSize: 10 }}>
                      <i className="ph-bold ph-plus" style={{ fontSize: 18 }} />add
                    </button>
                  )}
                </div>
              )}
              {images.length === 0 && (
                <div className="img-upload-zone" onClick={() => fileRef.current?.click()}>
                  <i className="ph-bold ph-image-square" style={{ fontSize: 26, color: 'var(--muted2)', marginBottom: 6, display: 'block' }} />
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Click to upload images</div>
                  <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 3 }}>PNG, JPG, WebP · up to {MAX_IMAGES} images · max 2 MB each</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.length) { addImages(e.target.files); e.target.value = '' } }} />
              {imgError && (
                <div style={{ fontSize: 11, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <i className="ph-bold ph-warning-circle" /> {imgError}
                </div>
              )}
            </div>

            {/* Upload progress */}
            {publishing && uploadPct > 0 && uploadPct < 100 && (
              <div className="upload-bar-wrap">
                <div className="upload-bar-fill" style={{ width: `${uploadPct}%` }} />
              </div>
            )}

            {/* Publish */}
            <button
              className="publish-btn"
              style={{ opacity: canPublish ? 1 : 0.4, cursor: canPublish ? 'pointer' : 'not-allowed', marginTop: 4 }}
              onClick={handlePublish} disabled={!canPublish}>
              {publishing
                ? <><span className="spin"><i className="ph-bold ph-circle-notch" /></span> Publishing…</>
                : <><i className="ph-bold ph-paper-plane-tilt" /> Publish</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
