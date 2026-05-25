export type PageName = 'feed' | 'projects' | 'alerts' | 'staking' | 'profile' | 'predict'

export interface Project {
  id: string
  name: string
  av: string
  letter: string
  cat: string
  sub: string
  tags: { label: string; variant?: string }[]
  score: number | null
  scoreClass: string
  trend: string
  trendClass: string
}

export interface FeedCard {
  id: string
  type: 'c-alert' | 'c-verdict' | 'c-update' | 'c-new'
  project: string
  projectAv: string
  projectLetter: string
  projectSub: string
  title: string
  text: string
  time: string
}
