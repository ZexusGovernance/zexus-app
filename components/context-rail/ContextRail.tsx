'use client'

interface ContextRailProps {
  page: string
}

export default function ContextRail({ page }: ContextRailProps) {
  if (page === 'feed') {
    return (
      <div className="context-rail">
        <div className="context-panel context-feature">
          <div className="context-title">Active Vote</div>
          <div className="context-big">74%</div>
          <div className="context-sub">Umia Security Audit · 14h left · 312 votes</div>
        </div>
        <div className="context-panel">
          <div className="context-title">Trust Score Movers</div>
          <div className="context-row">
            <span className="context-k">Umia Protocol</span>
            <span className="context-v green">+12</span>
          </div>
          <div className="context-row">
            <span className="context-k">BaseSwap Pro</span>
            <span className="context-v green">+5</span>
          </div>
          <div className="context-row">
            <span className="context-k">NovaDEX</span>
            <span className="context-v red">−18</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">Platform Today</div>
          <div className="context-mini-grid">
            <div className="context-tile">
              <div className="context-tile-label">Verdicts</div>
              <div className="context-tile-value" style={{ color: 'var(--green)' }}>12</div>
            </div>
            <div className="context-tile">
              <div className="context-tile-label">Users</div>
              <div className="context-tile-value">2140</div>
            </div>
            <div className="context-tile">
              <div className="context-tile-label">ZXP Issued</div>
              <div className="context-tile-value" style={{ color: 'var(--gold)' }}>+210</div>
            </div>
            <div className="context-tile">
              <div className="context-tile-label">Projects</div>
              <div className="context-tile-value">5</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (page === 'projects') {
    return (
      <div className="context-rail">
        <div className="context-panel">
          <div className="context-title">Platform Stats</div>
          <div className="context-row">
            <span className="context-k">Total projects</span>
            <span className="context-v">5</span>
          </div>
          <div className="context-row">
            <span className="context-k">Active</span>
            <span className="context-v green">5</span>
          </div>
          <div className="context-row">
            <span className="context-k">Avg Trust Score</span>
            <span className="context-v gold">62</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">Top by Trust Score</div>
          <div className="context-row">
            <span className="context-k">Umia Protocol</span>
            <span className="context-v green">72</span>
          </div>
          <div className="context-row">
            <span className="context-k">BaseSwap Pro</span>
            <span className="context-v gold">68</span>
          </div>
          <div className="context-row">
            <span className="context-k">NovaDEX</span>
            <span className="context-v red">41</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">Genesis Slots</div>
          <div className="context-row">
            <span className="context-k">Tier 1</span>
            <span className="context-v gold">10 spots</span>
          </div>
          <div className="context-row">
            <span className="context-k">Tier 2</span>
            <span className="context-v">50 spots</span>
          </div>
          <div className="context-row">
            <span className="context-k">Tier 3</span>
            <span className="context-v">200 spots</span>
          </div>
        </div>
      </div>
    )
  }

  if (page === 'alerts') {
    return (
      <div className="context-rail">
        <div className="context-panel context-feature">
          <div className="context-title">Unread Alerts</div>
          <div className="context-big">3</div>
          <div className="context-sub">1 critical item</div>
        </div>
        <div className="context-panel">
          <div className="context-title">Alert Types</div>
          <div className="context-row">
            <span className="context-k">Critical</span>
            <span className="context-v red">1</span>
          </div>
          <div className="context-row">
            <span className="context-k">Verdict open</span>
            <span className="context-v gold">1</span>
          </div>
          <div className="context-row">
            <span className="context-k">Roadmap update</span>
            <span className="context-v">1</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">Notification Status</div>
          <div className="context-row">
            <span className="context-k">Watchlist</span>
            <span className="context-v green">On</span>
          </div>
          <div className="context-row">
            <span className="context-k">New verdicts</span>
            <span className="context-v green">On</span>
          </div>
          <div className="context-row">
            <span className="context-k">New projects</span>
            <span className="context-v">Off</span>
          </div>
        </div>
      </div>
    )
  }

  if (page === 'staking') {
    return (
      <div className="context-rail">
        <div className="context-panel">
          <div className="context-title">My Status</div>
          <div className="context-row">
            <span className="context-k">Rank</span>
            <span className="context-v gold">#312</span>
          </div>
          <div className="context-row">
            <span className="context-k">Influence</span>
            <span className="context-v green">1.05x</span>
          </div>
          <div className="context-row">
            <span className="context-k">Staked</span>
            <span className="context-v gold">200 ZXP</span>
          </div>
          <div className="context-row">
            <span className="context-k">To Tier 3</span>
            <span className="context-v">+260 ZXP</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">How to Earn ZXP</div>
          <div className="context-chip-row">
            <span className="context-chip">Daily check-in</span>
            <span className="context-chip">Correct verdicts</span>
            <span className="context-chip">Predict wins</span>
            <span className="context-chip">Referrals</span>
          </div>
        </div>
        <div className="context-panel context-feature">
          <div className="context-title">APY / Pool</div>
          <div className="context-big">14%</div>
          <div className="context-sub">Pool: 8,620 ZXP · Recalc in 4 days</div>
        </div>
      </div>
    )
  }

  if (page === 'profile') {
    return (
      <div className="context-rail">
        <div className="context-panel context-feature">
          <div className="context-title">ZXP Balance</div>
          <div className="context-big">340</div>
          <div className="context-sub" style={{ color: 'var(--green)' }}>+26 ZXP this week</div>
        </div>
        <div className="context-panel">
          <div className="context-title">Activity</div>
          <div className="context-row">
            <span className="context-k">Accuracy</span>
            <span className="context-v green">85%</span>
          </div>
          <div className="context-row">
            <span className="context-k">Verdicts</span>
            <span className="context-v">7</span>
          </div>
          <div className="context-row">
            <span className="context-k">Streak</span>
            <span className="context-v">9 days</span>
          </div>
          <div className="context-row">
            <span className="context-k">Rank</span>
            <span className="context-v gold">#312</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">Genesis Progress</div>
          <div className="context-row">
            <span className="context-k">Balance</span>
            <span className="context-v gold">340 ZXP</span>
          </div>
          <div className="context-row">
            <span className="context-k">Next tier need</span>
            <span className="context-v">+260</span>
          </div>
          <div className="context-row">
            <span className="context-k">Multiplier</span>
            <span className="context-v green">1.1x</span>
          </div>
        </div>
      </div>
    )
  }

  if (page === 'predict') {
    return (
      <div className="context-rail">
        <div className="context-panel context-feature">
          <div className="context-title">Market Stats</div>
          <div className="context-big">8620</div>
          <div className="context-sub">ZXP in active pools</div>
        </div>
        <div className="context-panel">
          <div className="context-title">My Bets</div>
          <div className="context-row">
            <span className="context-k">1,000 users by July 1</span>
            <span className="context-v green">Yes</span>
          </div>
          <div className="context-row">
            <span className="context-k">Genesis Tier 1 fills</span>
            <span className="context-v green">Yes</span>
          </div>
          <div className="context-row">
            <span className="context-k">5+ partners before MVP</span>
            <span className="context-v gold">Paid</span>
          </div>
        </div>
        <div className="context-panel">
          <div className="context-title">Rules</div>
          <div className="context-chip-row">
            <span className="context-chip">ZXP only</span>
            <span className="context-chip">10 ZXP min</span>
            <span className="context-chip">1-2% fee</span>
            <span className="context-chip">On-chain result</span>
          </div>
        </div>
      </div>
    )
  }

  return <div className="context-rail"></div>
}
