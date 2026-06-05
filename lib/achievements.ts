export interface AchievementStats {
  verdicts:    number
  zxp_staked:  number
  claim_streak: number
  zxp_balance: number
  referrals:   number
}

export interface Achievement {
  id:          string
  name:        string
  desc:        string
  icon:        string
  iconColor:   string
  badgeLabel:  string
  check:       (s: AchievementStats) => boolean
  progress?:   (s: AchievementStats) => { current: number; total: number }
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id:         'first_verdict',
    name:       'First Verdict',
    desc:       'Cast your first community verdict',
    icon:       'ph-shield-check',
    iconColor:  '#c9a55a',
    badgeLabel: 'Verdict Rookie',
    check:      s => s.verdicts > 0,
  },
  {
    id:         'first_stake',
    name:       'First Stake',
    desc:       'Lock ZXP in the staking pool',
    icon:       'ph-coin',
    iconColor:  '#6f9be5',
    badgeLabel: 'Staker',
    check:      s => s.zxp_staked > 0,
  },
  {
    id:         'streak_7',
    name:       '7-Day Streak',
    desc:       'Check in every day for 7 days in a row',
    icon:       'ph-calendar-check',
    iconColor:  '#65bf7f',
    badgeLabel: '7-Day Streak',
    check:      s => s.claim_streak >= 7,
    progress:   s => ({ current: Math.min(s.claim_streak, 7), total: 7 }),
  },
  {
    id:         'genesis_tier',
    name:       'Genesis Tier',
    desc:       'Accumulate 50 ZXP total balance',
    icon:       'ph-trophy',
    iconColor:  '#c9a55a',
    badgeLabel: 'Genesis',
    check:      s => s.zxp_balance >= 50,
    progress:   s => ({ current: Math.min(Math.floor(s.zxp_balance), 50), total: 50 }),
  },
  {
    id:         'verdicts_5',
    name:       '5 Verdicts',
    desc:       'Submit 5 community verdicts',
    icon:       'ph-star',
    iconColor:  '#a855f7',
    badgeLabel: '5 Verdicts',
    check:      s => s.verdicts >= 5,
    progress:   s => ({ current: Math.min(s.verdicts, 5), total: 5 }),
  },
  {
    id:         'referrals_5',
    name:       'Recruiter',
    desc:       'Invite 5 people who join Zexus',
    icon:       'ph-users',
    iconColor:  '#22d3ee',
    badgeLabel: 'Recruiter',
    check:      s => s.referrals >= 5,
    progress:   s => ({ current: Math.min(s.referrals, 5), total: 5 }),
  },
]
