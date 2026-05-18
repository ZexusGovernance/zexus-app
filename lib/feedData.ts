export type PostType = 'alert' | 'voting' | 'verdict' | 'update' | 'new' | 'investment'

export interface FeedComment {
  author: string
  letter: string
  av: string
  text: string
  time: string
}

export interface FeedPost {
  id: string
  type: PostType
  project: string
  projectSlug?: string
  projectId?: string
  av: string
  letter: string
  sub: string
  title: string
  text: string
  detailText: string
  time: string
  vote?: { yes: number; count: string; open?: boolean; timeLeft?: string; zxp?: number }
  score?: { delta: string; value: number; dir: 'up' | 'down' }
  trust?: { value: number; color: string }
  comments: FeedComment[]
  images?: string[]
  isEmergency?: boolean
  trustScoreChange?: number
  investment?: { round: string; amount: string; lead: string }
  likeCount?: number
  createdAt?: string
}

export const FEED_POSTS: FeedPost[] = [
  {
    id: 'novadex-alert-1',
    type: 'alert',
    project: 'NovaDEX',
    av: 'av-red',
    letter: 'N',
    sub: 'DEX · Base Mainnet',
    title: 'Deadline missed — no response for 48h',
    text: 'The project did not confirm the Liquidity Pool v2 milestone. Trust Score was reduced automatically.',
    detailText: 'NovaDEX failed to respond to the LP v2 milestone confirmation request within the 48-hour governance window. Per Zexus protocol rules, an automated trust penalty was applied. The team has been notified via on-chain message and has until block #8,452,100 to respond before an Emergency Call can be initiated by any verified holder.',
    time: '10 min ago',
    score: { delta: '−18 pts', value: 41, dir: 'down' },
    comments: [
      { author: '0x9a1b...f2c4', letter: 'A', av: 'av-blue', text: 'This is the second deadline miss in 60 days. Something is clearly wrong.', time: '8 min ago' },
      { author: '0x3f7e...12ab', letter: 'B', av: 'av-teal', text: 'Filed an emergency call. Waiting for 10% holder threshold.', time: '5 min ago' },
    ],
  },
  {
    id: 'baseswap-voting-1',
    type: 'voting',
    project: 'BaseSwap Pro',
    av: 'av-teal',
    letter: 'B',
    sub: 'DEX · Base Mainnet',
    title: 'Certik Security Audit — your vote is waiting',
    text: 'Audit completed, 2 minor issues found and fixed before deploy. As a token holder, confirm or dispute the result.',
    detailText: 'BaseSwap Pro has completed a full Certik security audit of the v3 AMM contracts. The audit identified 2 minor informational issues, both of which were patched prior to deployment. The final report is publicly available on Certik\'s website. This community vote is to formally ratify the audit result and maintain Trust Score integrity on the Zexus platform.',
    time: '5h ago',
    vote: { yes: 74, count: '312 votes', open: true, timeLeft: '14h left', zxp: 15 },
    comments: [
      { author: '0xc4f2...8891', letter: 'C', av: 'av-gold', text: 'Read the Certik report — the fixes look solid. Voting Confirm.', time: '4h ago' },
      { author: '0x7b2a...44dc', letter: 'D', av: 'av-purple', text: 'Good precedent, we need more teams doing this proactively.', time: '2h ago' },
    ],
  },
  {
    id: 'umia-verdict-1',
    type: 'verdict',
    project: 'Umia Protocol',
    av: 'av-blue',
    letter: 'U',
    sub: 'DeFi · Base Mainnet',
    title: 'Testnet deploy — confirmed by the community ✓',
    text: '847 verified holders took part in the vote. Result accepted.',
    detailText: 'Umia Protocol\'s testnet deployment of the v2 yield optimizer has been formally verified by 847 holder participants on Zexus. The milestone included a public testnet, a 72-hour bug bounty period with no critical findings, and a Halborn security review. Trust Score increased by 12 points as a result of this successful community verification.',
    time: '2h ago',
    vote: { yes: 89, count: '847 votes' },
    score: { delta: '+12 pts', value: 72, dir: 'up' },
    comments: [
      { author: '0x5a3c...91be', letter: 'E', av: 'av-blue', text: 'Participated in the testnet myself. Yield curve is smooth and gas efficient.', time: '1h ago' },
      { author: '0x2d8f...c34a', letter: 'F', av: 'av-purple', text: 'Clean audit + public testnet. This is how it should be done.', time: '45 min ago' },
    ],
  },
  {
    id: 'aerobase-update-1',
    type: 'update',
    project: 'AeroBase',
    av: 'av-gold',
    letter: 'A',
    sub: 'AMM · Base Mainnet',
    title: 'v2.1 mainnet deploy completed',
    text: 'New protocol with improved UI and 18% lower gas. Mainnet live.',
    detailText: 'AeroBase v2.1 is now live on Base Mainnet. Key improvements include a redesigned liquidity UI, 18% average gas reduction through calldata optimizations, MEV protection on all swaps via a custom mempool guard, and support for concentrated liquidity positions. TVL migrated from v2.0 within 6 hours of launch with zero incidents.',
    time: '8h ago',
    trust: { value: 85, color: 'var(--green)' },
    comments: [
      { author: '0x2b9f...c37a', letter: 'G', av: 'av-red', text: 'Gas savings are real — tested swapping ETH/USDC and saved ~$1.20 vs old version.', time: '7h ago' },
      { author: '0x8d1e...5502', letter: 'H', av: 'av-teal', text: 'MEV protection alone is worth the upgrade.', time: '6h ago' },
    ],
  },
  {
    id: 'zerolend-new-1',
    type: 'new',
    project: 'ZeroLend',
    av: 'av-purple',
    letter: 'Z',
    sub: 'Lending · Base Mainnet · 18.2k followers',
    title: 'ZeroLend joined Zexus — Genesis Tier 2',
    text: 'Lending protocol verified. Verify your holding to join future verdicts.',
    detailText: 'ZeroLend, a non-custodial lending protocol with $140M TVL across chains, has joined the Zexus governance layer at Genesis Tier 2. Verified ZRLND token holders on Base Mainnet are eligible to participate in the first milestone vote launching in 7 days. The protocol has committed to publishing quarterly on-chain governance reports via Zexus.',
    time: '1d ago',
    comments: [
      { author: '0x4f2a...9c1b', letter: 'U', av: 'av-gold', text: 'Finally! Been waiting for ZeroLend to join. 18k followers is a strong community.', time: '23h ago' },
    ],
  },
  {
    id: 'baseswap-alert-1',
    type: 'alert',
    project: 'BaseSwap Pro',
    av: 'av-teal',
    letter: 'B',
    sub: 'DEX · Base Mainnet',
    title: 'Community flagged low-severity contract issue',
    text: 'A community researcher identified a reentrancy edge case in the LP router. Team acknowledged and patch is in review — funds not at risk.',
    detailText: 'Security researcher @chainwatch identified a theoretical reentrancy path in the BaseSwap Pro LP router at 0x7a2b...3f91. The attack vector requires controlling a malicious token contract, limiting real-world risk. Team acknowledged within 2 hours and a patch is under review. All funds are safe.',
    time: '3h ago',
    score: { delta: '−5 pts', value: 63, dir: 'down' },
    comments: [
      { author: '0xchainwatch', letter: 'I', av: 'av-red', text: 'Shared full PoC with the team. Low severity but worth patching before v4.', time: '2h ago' },
      { author: '0x6c3a...f19d', letter: 'J', av: 'av-blue', text: 'Team response time was great. +1 for transparency.', time: '1h ago' },
    ],
  },
  {
    id: 'aerobase-verdict-1',
    type: 'verdict',
    project: 'AeroBase',
    av: 'av-gold',
    letter: 'A',
    sub: 'AMM · Base Mainnet',
    title: 'Fee reduction proposal — passed 91% ✓',
    text: 'Governance vote to cut swap fees from 0.3% to 0.2% passed by a decisive majority. Change goes live in the next deploy.',
    detailText: 'The AeroBase fee reduction proposal (AIP-07) has passed with 91% approval from 1,204 holders. Swap fees will be reduced from 0.3% to 0.2% in the next contract upgrade. The proposal estimated that lower fees will increase volume by 35-50%, resulting in equivalent or higher LP revenue despite the rate cut.',
    time: '6h ago',
    vote: { yes: 91, count: '1 204 votes' },
    score: { delta: '+8 pts', value: 93, dir: 'up' },
    comments: [
      { author: '0x1a9b...87ef', letter: 'K', av: 'av-teal', text: 'Finally competitive with Uniswap fees. Volume should spike.', time: '5h ago' },
      { author: '0x3c5d...a12b', letter: 'L', av: 'av-gold', text: 'Great governance in action. AeroBase is setting the standard.', time: '3h ago' },
    ],
  },
  {
    id: 'zerolend-voting-1',
    type: 'voting',
    project: 'ZeroLend',
    av: 'av-purple',
    letter: 'Z',
    sub: 'Lending · Base Mainnet',
    title: 'First holder vote: Collateral whitelist expansion',
    text: 'ZeroLend proposes adding cbETH and wstETH as collateral assets. Your vote counts double this week.',
    detailText: 'ZeroLend Governance Proposal ZGP-01 adds cbETH and wstETH as supported collateral types. Both assets have $200M+ combined liquidity on Base Mainnet. Risk parameters: LTV 78%, liquidation threshold 83%, max borrow cap 5,000 ETH equivalent per asset.',
    time: '9h ago',
    vote: { yes: 61, count: '88 votes', open: true, timeLeft: '31h left', zxp: 20 },
    comments: [
      { author: '0x9c4d...3ab1', letter: 'M', av: 'av-purple', text: 'cbETH is solid collateral. Parameters look conservative enough.', time: '7h ago' },
      { author: '0x2e7f...bc44', letter: 'N', av: 'av-teal', text: 'First vote ever for ZeroLend on Zexus — historic!', time: '4h ago' },
    ],
  },
  {
    id: 'novadex-update-1',
    type: 'update',
    project: 'NovaDEX',
    av: 'av-red',
    letter: 'N',
    sub: 'DEX · Base Mainnet',
    title: 'Team response: Trail of Bits audit started',
    text: 'Following the missed LP v2 deadline, NovaDEX engaged Trail of Bits for a full audit. Estimated 3 weeks, report will be public.',
    detailText: 'NovaDEX CEO published an on-chain statement acknowledging the governance deadline failure. Trail of Bits audit began May 14th with a 3-week timeline. The final report will be published on GitHub and submitted to Zexus for community review. A governance liaison has been added to prevent future deadline misses.',
    time: '12h ago',
    trust: { value: 41, color: 'var(--amber)' },
    comments: [
      { author: '0x4a1c...77f2', letter: 'O', av: 'av-gold', text: 'Trail of Bits is one of the best firms. Respect for not cutting corners.', time: '10h ago' },
      { author: '0x8b3d...c91a', letter: 'P', av: 'av-red', text: 'Too little too late imo, trust score already tanked.', time: '8h ago' },
    ],
  },
  {
    id: 'baseswap-verdict-2',
    type: 'verdict',
    project: 'BaseSwap Pro',
    av: 'av-teal',
    letter: 'B',
    sub: 'DEX · Base Mainnet',
    title: 'Q1 roadmap milestone — confirmed ✓',
    text: 'Community verified the cross-chain bridge integration and v3 AMM upgrade on time. 562 holders participated.',
    detailText: 'BaseSwap Pro delivered both Q1 commitments: (1) cross-chain bridge via Across Protocol enabling ETH↔Base bridging in the UI, and (2) v3 AMM upgrade with concentrated liquidity. 562 verified holders participated in the Zexus ratification vote, 82% confirming delivery. Trust Score +10 pts.',
    time: '1d ago',
    vote: { yes: 82, count: '562 votes' },
    score: { delta: '+10 pts', value: 73, dir: 'up' },
    comments: [
      { author: '0x3c8a...29b6', letter: 'Q', av: 'av-blue', text: 'Bridge tested — sub-2min from ETH to Base. Confirmed.', time: '22h ago' },
    ],
  },
  {
    id: 'umia-update-1',
    type: 'update',
    project: 'Umia Protocol',
    av: 'av-blue',
    letter: 'U',
    sub: 'DeFi · Base Mainnet',
    title: 'Umia liquidity now routed through 1inch',
    text: 'Strategic integration with the 1inch DEX aggregator goes live — all Umia pools accessible to 2M+ 1inch users.',
    detailText: 'Umia Protocol completed the 1inch DEX aggregator integration, making all Umia liquidity pools discoverable via the 1inch API. This gives access to 1inch\'s 2.4M monthly active users and their Pathfinder algorithm, which will route trades through Umia whenever it offers the best price. Volume expected to increase 40-80% based on comparable integrations.',
    time: '1d ago',
    trust: { value: 72, color: 'var(--green)' },
    comments: [
      { author: '0x7f2e...4b19', letter: 'R', av: 'av-teal', text: 'Already seeing 1inch routes hitting Umia pools. Great move.', time: '20h ago' },
    ],
  },
  {
    id: 'liquidfi-new-1',
    type: 'new',
    project: 'LiquidFi',
    av: 'av-cyan',
    letter: 'L',
    sub: 'Liquid Staking · Base Mainnet · 6.3k followers',
    title: 'LiquidFi joins Zexus — Genesis Tier 1',
    text: 'Liquid staking protocol with $48M TVL enters the Zexus governance layer. First milestone vote opens in 7 days.',
    detailText: 'LiquidFi, a liquid staking protocol with $48M TVL and 6,300+ stakers on Base Mainnet, joined Zexus at Genesis Tier 1. LiquidFi offers liquid staking receipts (lfETH) that accrue staking yield while remaining usable as DeFi collateral. The first Zexus milestone vote covers their Q2 smart contract upgrade scheduled for June 2026.',
    time: '2d ago',
    comments: [
      { author: '0x5c1b...a83f', letter: 'S', av: 'av-teal', text: 'lfETH holders — time to get verified on Zexus.', time: '1d ago' },
      { author: '0x2a4d...71bc', letter: 'T', av: 'av-purple', text: '$48M TVL for a Tier 1 is impressive. Watching closely.', time: '20h ago' },
    ],
  },
  {
    id: 'umia-alert-1',
    type: 'alert',
    project: 'Umia Protocol',
    av: 'av-blue',
    letter: 'U',
    sub: 'DeFi · Base Mainnet',
    title: 'Whale wallet moved 2.3M UMIA tokens',
    text: 'On-chain data shows a top-5 holder transferring 2.3M tokens to an exchange deposit address. No official comment yet.',
    detailText: 'Wallet 0x8f2a...4c19 — a top-5 UMIA holder with 2.3M tokens (1.2% of supply) — transferred its full balance to a Binance deposit address at block #8,441,829. The wallet was inactive for 11 months. No team communication issued. Could be OTC, staking migration, or sell. Community has tagged the Umia X account requesting a statement.',
    time: '2d ago',
    score: { delta: '−3 pts', value: 69, dir: 'down' },
    comments: [
      { author: '0x4f2a...9c1b', letter: 'U', av: 'av-gold', text: 'Could be OTC or team reallocation. Waiting for official comment before any action.', time: '1d ago' },
      { author: '0x6b3c...f820', letter: 'V', av: 'av-red', text: 'Added to watchlist. Not alarming yet but bears monitoring.', time: '22h ago' },
    ],
  },
]
