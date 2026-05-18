import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { Metadata } from 'next'
import Link from 'next/link'

interface PageProps {
  params: Promise<{ id: string }>
}

async function getPost(id: string) {
  const { data } = await supabaseAdmin
    .from('posts_feed')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const post = await getPost(id)
  if (!post) return { title: 'Post not found — Zexus' }
  return {
    title:       `${post.project_name}: ${post.title ?? post.post_type} — Zexus`,
    description: (post.content as string).slice(0, 160),
    openGraph: {
      title:       `${post.project_name} · ${post.title ?? post.post_type}`,
      description: (post.content as string).slice(0, 160),
      type:        'article',
    },
  }
}

const TYPE_COLOR: Record<string, string> = {
  update:  '#5a82c9',
  verdict: '#4caf7d',
  alert:   '#e07070',
}
const TYPE_LABEL: Record<string, string> = {
  update: 'Update', verdict: 'Verdict', alert: 'Alert',
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params
  const post = await getPost(id)

  if (!post) notFound()

  const color = TYPE_COLOR[post.post_type as string] ?? '#5a82c9'
  const time  = new Date(post.created_at as string).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{
      minHeight: '100vh', background: '#0b0a09', color: '#e8e3dc',
      fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '48px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Brand */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '2px', color: '#c9a55a' }}>ZEXUS</span>
          <Link href="/" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>
            Open App →
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: '#13120f', border: `1px solid ${color}33`,
          borderRadius: 16, padding: '24px 28px',
          boxShadow: `0 0 40px ${color}18`,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: `${color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, color,
            }}>
              {(post.project_name as string)[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{post.project_name as string}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{post.project_category as string ?? 'Protocol'}</div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
              background: `${color}18`, color, border: `0.5px solid ${color}50`,
            }}>
              {TYPE_LABEL[post.post_type as string] ?? post.post_type as string}
            </span>
          </div>

          {/* Title */}
          {post.title && (
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, lineHeight: 1.35 }}>
              {post.title as string}
            </h1>
          )}

          {/* Content */}
          <p style={{ fontSize: 14, color: '#aaa', lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 20 }}>
            {post.content as string}
          </p>

          {/* Trust score change */}
          {(post.trust_score_change as number) !== 0 && post.trust_score_change != null && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
              padding: '4px 10px', borderRadius: 6,
              background: (post.trust_score_change as number) > 0 ? 'rgba(76,175,125,0.12)' : 'rgba(224,112,112,0.12)',
              color: (post.trust_score_change as number) > 0 ? '#4caf7d' : '#e07070',
              marginBottom: 20,
            }}>
              {(post.trust_score_change as number) > 0 ? '↑' : '↓'} {(post.trust_score_change as number) > 0 ? '+' : ''}{post.trust_score_change as number} Trust Score
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '0.5px solid #2a2820', paddingTop: 16, fontSize: 11, color: '#666' }}>
            <span>{time}</span>
            <span>{post.likes_count as number} likes · {post.comments_count as number} comments</span>
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            href={`/?post=${id}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px',
              borderRadius: 10, background: '#c9a55a', color: '#0b0a09',
              fontWeight: 600, fontSize: 13, textDecoration: 'none',
            }}
          >
            Open in Zexus App
          </Link>
          <p style={{ marginTop: 12, fontSize: 11, color: '#666' }}>
            Zexus — DeFi governance transparency on Base Mainnet
          </p>
        </div>
      </div>
    </div>
  )
}
