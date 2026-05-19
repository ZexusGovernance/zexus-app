import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export interface DbPost {
  id: string
  project_id: string
  author_wallet: string
  post_type: string
  title: string | null
  content: string
  image_url: string | null
  trust_score_change: number | null
  is_pinned: boolean
  created_at: string
  updated_at: string
  project_name: string
  project_slug: string
  project_category: string | null
  project_avatar_url: string | null
  project_trust_score: number
  likes_count: number
  dislikes_count: number
  comments_count: number
  views_count: number
}

export interface DbComment {
  id: string
  post_id: string
  author_wallet: string
  content: string
  created_at: string
}
