export interface TimelineEvent {
  date: string
  title: string
  status: string
  votes: string
  impact: string
  type: 'verified' | 'risk' | 'voting' | 'important' | 'none'
}

export interface Milestone {
  name: string
  date: string
  status: string
  statusClass: string
  impact: string
}

export interface Vote {
  title: string
  status: string
  statusClass: string
  yes: number
  no: number
  ends: string
}

export interface Holder {
  letter: string
  address: string
  amount: string
  pct: string
}

export interface Verifier {
  letter: string
  address: string
  pts: string
}

export interface ProjectFull {
  id: string
  name: string
  av: string
  letter: string
  cat: string
  sub: string
  chain: string
  tags: { label: string; variant?: string }[]
  score: number | null
  scoreClass: string
  trend: string
  trendClass: string
  trustLabel: string
  holders: string
  verdicts: number
  activeSince: string
  overview: string
  milestones: Milestone[]
  votes: Vote[]
  topHolders: Holder[]
  timelineEvents: Record<number, TimelineEvent>
  verifiers: Verifier[]
}

export const PROJECTS_FULL: ProjectFull[] = [
  {
    id: 'umia',
    name: 'Umia Protocol',
    av: 'av-blue',
    letter: 'U',
    cat: 'DeFi · Base Mainnet',
    sub: 'DeFi · Base Mainnet · 12.4k followers',
    chain: 'Base Mainnet',
    tags: [
      { label: 'Verified', variant: 'verified' },
      { label: 'DeFi' },
      { label: 'Genesis T2' },
    ],
    score: 72,
    scoreClass: 'hi',
    trend: '+12',
    trendClass: 'plt-up',
    trustLabel: 'Good · Rising',
    holders: '1,240',
    verdicts: 3,
    activeSince: 'Mar 2024',
    overview:
      'Umia Protocol is a decentralized liquidity layer on Base Mainnet enabling permissionless lending, borrowing, and yield optimization. The protocol has undergone two external audits and maintains an open governance forum where ZXP holders vote on key parameters.',
    timelineEvents: {
      4: { date: 'May 04', title: 'Testnet deploy verified', status: 'Status: Verified', votes: 'Votes: 847', impact: 'Trust Score impact: +12', type: 'verified' },
      9: { date: 'May 09', title: 'Liquidity Pool v2 missed', status: 'Status: Missed deadline', votes: 'Votes: 214', impact: 'Trust Score impact: −18', type: 'risk' },
      12: { date: 'May 12', title: 'Security Audit submitted', status: 'Status: Community voting', votes: 'Votes: 312', impact: 'Trust Score impact: pending', type: 'voting' },
      18: { date: 'May 18', title: 'Governance update verified', status: 'Status: Verified update', votes: 'Votes: 528', impact: 'Trust Score impact: +5', type: 'important' },
      23: { date: 'May 23', title: 'Treasury report posted', status: 'Status: Positive update', votes: 'Votes: 402', impact: 'Trust Score impact: +3', type: 'verified' },
    },
    milestones: [
      { name: 'Security Audit v2', date: 'May 14', status: 'Voting', statusClass: 'status-voting', impact: '+15/−18' },
      { name: 'Liquidity Pool v2', date: 'May 09', status: 'Missed', statusClass: 'status-missed', impact: '−18' },
      { name: 'Mainnet v2.1 deploy', date: 'May 02', status: 'Verified', statusClass: 'status-verified', impact: '+8' },
      { name: 'Mobile App Beta', date: 'Aug 15', status: 'Pending', statusClass: 'status-pending', impact: '+6/−10' },
      { name: 'Oracle dispute fix', date: 'May 20', status: 'Disputed', statusClass: 'status-disputed', impact: '−8' },
    ],
    votes: [
      { title: 'Raise borrow cap to 5M USDC', status: 'Active', statusClass: 'status-voting', yes: 68, no: 32, ends: 'May 20' },
      { title: 'Add wstETH as collateral', status: 'Passed', statusClass: 'status-verified', yes: 82, no: 18, ends: 'May 12' },
      { title: 'Emergency pause LP v1', status: 'Failed', statusClass: 'status-missed', yes: 41, no: 59, ends: 'May 08' },
    ],
    topHolders: [
      { letter: 'A', address: '0xa1f...3d2e', amount: '84,200 UMIA', pct: '8.4%' },
      { letter: 'B', address: '0xb7c...9f1a', amount: '62,500 UMIA', pct: '6.2%' },
      { letter: 'C', address: '0xc4e...5b8c', amount: '41,000 UMIA', pct: '4.1%' },
      { letter: 'D', address: '0xd2a...7c3f', amount: '28,700 UMIA', pct: '2.9%' },
    ],
    verifiers: [
      { letter: 'A', address: '0xa1f...3d', pts: '840 ZXP' },
      { letter: 'B', address: '0xb2c...7f', pts: '620 ZXP' },
      { letter: 'C', address: '0xc4e...1a', pts: '410 ZXP' },
    ],
  },

  {
    id: 'baseswap',
    name: 'BaseSwap Pro',
    av: 'av-teal',
    letter: 'B',
    cat: 'DEX · Base Mainnet',
    sub: 'DEX · Base Mainnet · 9.8k followers',
    chain: 'Base Mainnet',
    tags: [
      { label: 'Verified', variant: 'verified' },
      { label: 'DEX' },
      { label: 'Genesis T2' },
    ],
    score: 68,
    scoreClass: 'mi',
    trend: '+5',
    trendClass: 'plt-up',
    trustLabel: 'Moderate · Stable',
    holders: '12,100',
    verdicts: 4,
    activeSince: 'May 2024',
    overview:
      'BaseSwap Pro is the leading concentrated liquidity DEX on Base Mainnet with over $40M TVL. It features custom fee tiers, a native token incentive program, and a community governance DAO that manages protocol fees and liquidity mining allocations.',
    timelineEvents: {
      2: { date: 'May 02', title: 'Fee tier update approved', status: 'Status: Verified', votes: 'Votes: 1,204', impact: 'Trust Score impact: +6', type: 'verified' },
      7: { date: 'May 07', title: 'Router v3 audit published', status: 'Status: Verified', votes: 'Votes: 934', impact: 'Trust Score impact: +9', type: 'important' },
      15: { date: 'May 15', title: 'LP rewards proposal voting', status: 'Status: Community voting', votes: 'Votes: 561', impact: 'Trust Score impact: pending', type: 'voting' },
      21: { date: 'May 21', title: 'Smart contract bug disclosed', status: 'Status: Risk flagged', votes: 'Votes: 892', impact: 'Trust Score impact: −12', type: 'risk' },
      27: { date: 'May 27', title: 'Bug patch deployed', status: 'Status: Verified fix', votes: 'Votes: 748', impact: 'Trust Score impact: +7', type: 'verified' },
    },
    milestones: [
      { name: 'Router v3 deployment', date: 'May 07', status: 'Verified', statusClass: 'status-verified', impact: '+9' },
      { name: 'LP Rewards v2', date: 'May 15', status: 'Voting', statusClass: 'status-voting', impact: '+12/−5' },
      { name: 'Bug patch v3.1.2', date: 'May 27', status: 'Verified', statusClass: 'status-verified', impact: '+7' },
      { name: 'Cross-chain bridge', date: 'Jul 30', status: 'Pending', statusClass: 'status-pending', impact: '+10/−15' },
      { name: 'Mobile wallet SDK', date: 'Sep 01', status: 'Pending', statusClass: 'status-pending', impact: '+5' },
    ],
    votes: [
      { title: 'Increase LP incentives by 20%', status: 'Active', statusClass: 'status-voting', yes: 74, no: 26, ends: 'May 22' },
      { title: 'Whitelist wETH/USDC pool', status: 'Passed', statusClass: 'status-verified', yes: 91, no: 9, ends: 'May 10' },
      { title: 'Reduce protocol fee to 0.05%', status: 'Active', statusClass: 'status-voting', yes: 55, no: 45, ends: 'May 25' },
    ],
    topHolders: [
      { letter: 'T', address: '0xf8a...2d1b', amount: '210,000 BSWP', pct: '12.1%' },
      { letter: 'W', address: '0x9c3...6e4f', amount: '148,000 BSWP', pct: '8.5%' },
      { letter: 'M', address: '0x7b1...0a2c', amount: '93,400 BSWP', pct: '5.4%' },
      { letter: 'V', address: '0x4e9...3f7d', amount: '71,200 BSWP', pct: '4.1%' },
    ],
    verifiers: [
      { letter: 'X', address: '0xf8a...2d', pts: '1,120 ZXP' },
      { letter: 'Y', address: '0x9c3...6e', pts: '780 ZXP' },
      { letter: 'Z', address: '0x7b1...0a', pts: '540 ZXP' },
    ],
  },

  {
    id: 'zerolend',
    name: 'ZeroLend',
    av: 'av-purple',
    letter: 'Z',
    cat: 'Lending · Base Mainnet',
    sub: 'Lending · Base Mainnet · 18.2k followers',
    chain: 'Base Mainnet',
    tags: [
      { label: 'Verified', variant: 'verified' },
      { label: 'Lending' },
      { label: 'Genesis T2' },
    ],
    score: null,
    scoreClass: 'na',
    trend: 'New',
    trendClass: 'plt-na',
    trustLabel: 'New · Unscored',
    holders: '3,400',
    verdicts: 0,
    activeSince: 'Apr 2025',
    overview:
      'ZeroLend is a next-generation lending protocol launching on Base Mainnet with gasless borrowing via meta-transactions and isolated risk pools for long-tail assets. Currently in genesis phase with no Trust Score yet assigned — community verdicts will begin after the first milestone audit.',
    timelineEvents: {
      5: { date: 'May 05', title: 'Genesis listing approved', status: 'Status: Verified', votes: 'Votes: 2,140', impact: 'Trust Score impact: initial', type: 'important' },
      14: { date: 'May 14', title: 'Smart contract submitted', status: 'Status: Community voting', votes: 'Votes: 1,830', impact: 'Trust Score impact: pending', type: 'voting' },
    },
    milestones: [
      { name: 'Genesis listing', date: 'May 05', status: 'Verified', statusClass: 'status-verified', impact: 'initial' },
      { name: 'Audit submission', date: 'May 30', status: 'Pending', statusClass: 'status-pending', impact: '+20/−25' },
      { name: 'Mainnet launch', date: 'Jun 20', status: 'Pending', statusClass: 'status-pending', impact: '+15/−20' },
      { name: 'ZERO token distribution', date: 'Jul 01', status: 'Pending', statusClass: 'status-pending', impact: '+10' },
    ],
    votes: [
      { title: 'Approve ZeroLend audit firm', status: 'Active', statusClass: 'status-voting', yes: 88, no: 12, ends: 'May 24' },
    ],
    topHolders: [
      { letter: 'F', address: '0x3a7...1c9e', amount: '500,000 ZERO', pct: '14.7%' },
      { letter: 'G', address: '0x8f2...4b6d', amount: '320,000 ZERO', pct: '9.4%' },
      { letter: 'H', address: '0x6c4...9a1f', amount: '180,000 ZERO', pct: '5.3%' },
      { letter: 'I', address: '0x1d8...7e3c', amount: '95,000 ZERO', pct: '2.8%' },
    ],
    verifiers: [
      { letter: 'P', address: '0x3a7...1c', pts: '320 ZXP' },
      { letter: 'Q', address: '0x8f2...4b', pts: '210 ZXP' },
    ],
  },

  {
    id: 'novadex',
    name: 'NovaDEX',
    av: 'av-red',
    letter: 'N',
    cat: 'DEX · Base Mainnet',
    sub: 'DEX · Base Mainnet · 7.1k followers',
    chain: 'Base Mainnet',
    tags: [{ label: 'DEX' }],
    score: 41,
    scoreClass: 'lo',
    trend: '−18',
    trendClass: 'plt-down',
    trustLabel: 'Low · Declining',
    holders: '870',
    verdicts: 6,
    activeSince: 'Jan 2024',
    overview:
      'NovaDEX is a DEX aggregator and AMM on Base Mainnet. The protocol has faced multiple missed milestones and a disputed oracle incident that caused significant Trust Score decline. A recovery plan was submitted by the team in May 2025 and is currently under community review.',
    timelineEvents: {
      1: { date: 'May 01', title: 'Recovery plan submitted', status: 'Status: Community voting', votes: 'Votes: 1,480', impact: 'Trust Score impact: pending', type: 'voting' },
      6: { date: 'May 06', title: 'Oracle incident disputed', status: 'Status: Risk flagged', votes: 'Votes: 2,210', impact: 'Trust Score impact: −22', type: 'risk' },
      11: { date: 'May 11', title: 'Team AMA held', status: 'Status: Positive update', votes: 'Votes: 384', impact: 'Trust Score impact: +2', type: 'verified' },
      19: { date: 'May 19', title: 'Roadmap v2 missed', status: 'Status: Missed deadline', votes: 'Votes: 992', impact: 'Trust Score impact: −14', type: 'risk' },
      25: { date: 'May 25', title: 'Community vote on recovery', status: 'Status: Community voting', votes: 'Votes: 1,120', impact: 'Trust Score impact: pending', type: 'voting' },
    },
    milestones: [
      { name: 'Oracle dispute resolution', date: 'May 06', status: 'Disputed', statusClass: 'status-disputed', impact: '−22' },
      { name: 'Roadmap v2 delivery', date: 'May 19', status: 'Missed', statusClass: 'status-missed', impact: '−14' },
      { name: 'Recovery plan vote', date: 'May 25', status: 'Voting', statusClass: 'status-voting', impact: '+18/−12' },
      { name: 'Smart contract v2 audit', date: 'Jun 30', status: 'Pending', statusClass: 'status-pending', impact: '+15/−20' },
      { name: 'UI overhaul', date: 'Jul 15', status: 'Pending', statusClass: 'status-pending', impact: '+3' },
    ],
    votes: [
      { title: 'Approve recovery roadmap v2', status: 'Active', statusClass: 'status-voting', yes: 61, no: 39, ends: 'May 27' },
      { title: 'Remove team multisig signer', status: 'Active', statusClass: 'status-voting', yes: 44, no: 56, ends: 'May 26' },
      { title: 'Pause protocol pending audit', status: 'Failed', statusClass: 'status-missed', yes: 48, no: 52, ends: 'May 14' },
    ],
    topHolders: [
      { letter: 'R', address: '0x2b5...8d4a', amount: '42,000 NOVA', pct: '4.8%' },
      { letter: 'S', address: '0x7e1...3c9b', amount: '31,500 NOVA', pct: '3.6%' },
      { letter: 'T', address: '0xac4...6f2e', amount: '18,200 NOVA', pct: '2.1%' },
      { letter: 'U', address: '0x5d9...1a7c', amount: '12,400 NOVA', pct: '1.4%' },
    ],
    verifiers: [
      { letter: 'L', address: '0x2b5...8d', pts: '290 ZXP' },
      { letter: 'M', address: '0x7e1...3c', pts: '180 ZXP' },
      { letter: 'N', address: '0xac4...6f', pts: '95 ZXP' },
    ],
  },

  {
    id: 'aerobase',
    name: 'AeroBase',
    av: 'av-gold',
    letter: 'A',
    cat: 'AMM · Base Mainnet',
    sub: 'AMM · Base Mainnet · 14.6k followers',
    chain: 'Base Mainnet',
    tags: [
      { label: 'Verified', variant: 'verified' },
      { label: 'AMM' },
      { label: 'Genesis T1' },
    ],
    score: 85,
    scoreClass: 'hi',
    trend: '+8',
    trendClass: 'plt-up',
    trustLabel: 'Excellent · Rising',
    holders: '8,920',
    verdicts: 7,
    activeSince: 'Nov 2023',
    overview:
      'AeroBase is the highest-scored AMM on Zexus Governance with a Genesis T1 rating. The protocol operates a ve(3,3) incentive model, has completed three independent audits, and maintains a fully transparent treasury updated weekly. It is the governance benchmark for Base Mainnet DeFi.',
    timelineEvents: {
      3: { date: 'May 03', title: 'Weekly treasury report', status: 'Status: Verified', votes: 'Votes: 1,640', impact: 'Trust Score impact: +4', type: 'verified' },
      8: { date: 'May 08', title: 've(3,3) upgrade passed', status: 'Status: Verified', votes: 'Votes: 2,380', impact: 'Trust Score impact: +8', type: 'important' },
      13: { date: 'May 13', title: 'Audit v3 submitted', status: 'Status: Verified', votes: 'Votes: 1,920', impact: 'Trust Score impact: +6', type: 'verified' },
      20: { date: 'May 20', title: 'Epoch rewards distributed', status: 'Status: Verified', votes: 'Votes: 1,110', impact: 'Trust Score impact: +3', type: 'verified' },
      26: { date: 'May 26', title: 'New gauge vote', status: 'Status: Community voting', votes: 'Votes: 880', impact: 'Trust Score impact: pending', type: 'voting' },
    },
    milestones: [
      { name: 'Audit v3 completion', date: 'May 13', status: 'Verified', statusClass: 'status-verified', impact: '+6' },
      { name: 've(3,3) model upgrade', date: 'May 08', status: 'Verified', statusClass: 'status-verified', impact: '+8' },
      { name: 'Cross-chain AERO bridge', date: 'Jun 15', status: 'Pending', statusClass: 'status-pending', impact: '+12/−5' },
      { name: 'Governance v2 module', date: 'Jul 01', status: 'Pending', statusClass: 'status-pending', impact: '+7' },
      { name: 'Epoch rewards v4', date: 'May 20', status: 'Verified', statusClass: 'status-verified', impact: '+3' },
    ],
    votes: [
      { title: 'Add AERO/cbETH gauge', status: 'Active', statusClass: 'status-voting', yes: 79, no: 21, ends: 'May 28' },
      { title: 'Increase bribe emissions 5%', status: 'Passed', statusClass: 'status-verified', yes: 86, no: 14, ends: 'May 18' },
      { title: 'Treasury diversify to USDC', status: 'Passed', statusClass: 'status-verified', yes: 93, no: 7, ends: 'May 11' },
    ],
    topHolders: [
      { letter: 'E', address: '0x9f3...4a2b', amount: '1,240,000 AERO', pct: '13.9%' },
      { letter: 'F', address: '0x6c8...7d1e', amount: '840,000 AERO', pct: '9.4%' },
      { letter: 'G', address: '0x4a1...2c9f', amount: '520,000 AERO', pct: '5.8%' },
      { letter: 'H', address: '0x1b7...8e4a', amount: '310,000 AERO', pct: '3.5%' },
    ],
    verifiers: [
      { letter: 'J', address: '0x9f3...4a', pts: '1,840 ZXP' },
      { letter: 'K', address: '0x6c8...7d', pts: '1,220 ZXP' },
      { letter: 'L', address: '0x4a1...2c', pts: '960 ZXP' },
    ],
  },
]

export function getProjectBySlug(slug: string): ProjectFull | undefined {
  return PROJECTS_FULL.find(p => p.id === slug)
}
