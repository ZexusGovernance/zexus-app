# Zexus Whitepaper — Updated Sections

> Ready-to-paste GitBook sections reflecting the live mechanics as of June 2026.
> All numbers below are taken directly from the production codebase.

---

## ZXP Economy & Epochs

ZXP is the off-chain governance and reputation credit that powers Zexus. It is not
an inflationary point system — ZXP is designed to be **used**, not hoarded. Unused
balances of inactive participants decay at the end of each epoch, while active
governors keep everything they earn.

### Epochs

The protocol runs in **6-month epochs**. A daily maintenance job (03:00 UTC)
recalculates the staking APY and, when an epoch closes, applies a tiered retention
burn before automatically advancing to the next epoch.

### Tiered retention (anti-inflation)

At epoch end, each wallet's **free** (unstaked) ZXP is retained based on the
activity it showed during the epoch:

| Activity during epoch | ZXP retained | Effect |
|---|---|---|
| Staking **or** 3+ governance votes | **100%** | No loss |
| 1–2 governance votes | **90%** | −10% |
| 0 votes and not staking | **70%** | −30% |

Staked ZXP is never decayed — staking is itself proof of commitment. The burned
amount is recorded on each profile's lifetime **ZXP burned** counter (which drives
Burn Ranks, see below).

### Dynamic APY

Staking rewards are paid in ZXP at a **dynamic APY with an 8% hard ceiling**. The
base rate is recomputed daily from the median participant balance so that rewards
stay sustainable as the network grows. At the start of every epoch the rate resets
to the 8% ceiling.

> **Effective APY = base APY (≤ 8%) + active Community Burn Pool bonus** (see below).

---

## Staking

Staking ZXP does two things: it earns rewards (APY) and it unlocks governance power.
Both scale with **how long** a position has been staked, rewarding long-term
alignment over mercenary capital.

### Age multipliers

| Position age | APY multiplier | Vote-power multiplier |
|---|---|---|
| < 30 days | 1.00× | 1.00× |
| ≥ 30 days | 1.05× | 1.20× |
| ≥ 90 days | 1.10× | 1.50× |
| ≥ 180 days | 1.20× | 1.80× |
| ≥ 365 days | 1.35× | 2.20× |

Rewards accrue continuously (fractional drip, down to 4 decimals) so that even small
positions visibly earn over time. Unstaking is subject to a cooldown window before
the principal becomes withdrawable.

---

## Governance — Power Vote

Zexus governance is built around **milestone confirmation**. Projects post claims
(e.g. "shipped X", "hit milestone Y"); the community confirms or disputes them, and
the weighted outcome moves the project's Trust Score.

### Vote weight formula

```
vote_weight = √(staked ZXP) × time_bonus
```

The square root deliberately **softens whale dominance** — doubling your stake does
not double your vote. `time_bonus` follows the staking age multipliers
(1.0× → 2.2× from <30d to ≥365d), so conviction over time is rewarded.

To prevent gaming, the time bonus uses the **amount-weighted average age** across
all of a wallet's positions — you cannot anchor one tiny old position to boost a
large fresh stake.

### Eligibility & cost

| Requirement | Value |
|---|---|
| Minimum staked to vote | **10 ZXP** |
| Minimum account age | **48 hours** |
| Cost per vote | **1 ZXP (burned)** |
| Changing an existing vote | **Free** |

Votes are **confirm** or **dispute**. Voting posts auto-finalize at their deadline,
and the weighted result feeds directly into the project's Trust Score.

---

## Trust Score

Every project carries a **Trust Score** (capped at **110**) — a living reputation
number rather than a static rating. It moves through the governance cycle:

```
milestone claim → community vote (confirm / dispute) → Trust Score update → public timeline
```

Confirmed milestones raise the score; disputed or failed ones lower it. Each
project exposes a **Trust Timeline** so the full history of movements is auditable.

---

## Predict Market

Predict Markets let the community put ZXP behind their convictions about project
outcomes. They are **parimutuel** (pooled) markets:

- Each market has two outcomes, **A** and **B**, each with its own pool.
- **One bet per wallet per market**, minimum **1 ZXP**, paid from your free balance.
- When the market resolves, a **2% platform fee is burned**, and the remaining prize
  pool is split among winners **pro-rata** to their share of the winning pool:

```
payout = (your_bet / winning_pool) × (total_pool − 2% fee)
```

Markets have a betting deadline (`closes_at`); after that no new bets are accepted,
and the outcome is resolved by governance.

---

## Emergency Call

An Emergency Call is a community-funded alarm against a project — used to flag
serious issues (rug risk, broken promises, security concerns) and rally a quorum.

| Parameter | Value |
|---|---|
| Collection window | **48 hours** |
| Contribution range | **5–60 ZXP** per wallet (base) |
| Pool goal | **300 ZXP** (base) |
| Cooldown per project | **60 days** |
| Cooldown per initiator | **14 days** |
| Minimum reason length | 10 characters |

All amounts scale with an admin-controlled `scale_factor`, so thresholds can be
tuned as ZXP velocity changes without a code change. Watchers of the targeted
project are notified (e.g. via Telegram) when a call opens.

---

## Community Burn Pool

The Burn Pool is a **shared, monthly co-op goal**. Every ZXP burned through normal
activity (votes, emergency calls, predict fees, etc.) adds to one collective pool.
When the community crosses a tier, **everyone** receives a staking-APY bonus for the
rest of the month.

| Tier | Goal (ZXP burned this month) | Reward (APY for everyone) |
|---|---|---|
| Tier I | 500 | +1% APY |
| Tier II | 1,500 | +2% APY |
| Tier III | 4,500 | +3% APY |
| Tier IV | 9,000 | +5% APY |

The pool **resets at the start of each calendar month**. Epoch-end decay burns are
excluded from the count, so the pool reflects genuine activity. This turns burning
ZXP from a purely individual cost into a positive-sum, cooperative game.

---

## Seasons (Monthly Leaderboard)

Each calendar month is a **Season**. Season XP is the amount of ZXP a participant
**earns** during the month — from rewards, daily check-ins, governance verdicts,
referrals, and onboarding. It is computed live from the transaction ledger, with no
separate accrual system, and the top 50 are ranked publicly.

Seasons give newcomers a fair, recurring shot at recognition: the board zeroes out
every month, so standing reflects recent contribution rather than lifetime totals.

---

## Burn Ranks

A wallet's **lifetime ZXP burned** earns a permanent rank badge, displayed on the
profile. Burning is the truest signal of conviction, so it is what ranks reflect:

| Rank | Lifetime ZXP burned |
|---|---|
| Contributor | 100+ |
| Believer | 500+ |
| Whale | 2,000+ |
| Legend | 10,000+ |

---

## Earning ZXP

ZXP enters circulation through participation, not purchase:

| Action | Reward |
|---|---|
| Connect wallet (onboarding) | 3 ZXP |
| First comment (onboarding) | 2 ZXP |
| First reaction (onboarding) | 1 ZXP |
| Add to watchlist (onboarding) | 1 ZXP |
| Daily check-in | 1 ZXP / day |
| Successful referral | 5 ZXP |
| Staking rewards | Dynamic APY (≤ 8% + Burn Pool bonus) |
| Predict win | Pro-rata share of the prize pool |

Onboarding rewards (7 ZXP total) are claimable within the first **7 days** after a
wallet registers.

---

## Platform & Security (brief)

- **SIWE wallet authentication** — actions are signed with the wallet; the server
  derives the acting address from the verified session, never from request bodies.
- **Telegram notifications** — opt-in alerts for ZXP earned, Emergency Calls,
  Predict wins, and watched-project activity.
- **Invite-code gating** — onboarding is gated behind invite codes during the early
  access phase.
- **Achievements & badges**, **daily check-in streaks**, and **referrals** drive
  retention and reward sustained participation.
