'use client'

import { useState } from 'react'

type PredictTab = 'Active' | 'My bets' | 'Completed'

export default function PredictPage() {
  const [activeTab, setActiveTab] = useState<PredictTab>('Active')

  return (
    <div className="page active" id="page-predict">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div className="page-title">Predict Market</div>
          <div className="page-sub">Bets on internal Zexus events · ZXP only · 1-2% fee</div>
          <div className="tabs">
            {(['Active', 'My bets', 'Completed'] as PredictTab[]).map(t => (
              <div
                key={t}
                className={`tab${activeTab === t ? ' active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t}
              </div>
            ))}
          </div>
        </div>
        <div className="scroll">
          {/* Card 1 - mine */}
          <div className="pcard mine">
            <div className="my-stake-tag">
              <i className="ph-bold ph-coin" style={{ fontSize: '11px' }}></i> My bet: 50 ZXP → Yes
            </div>
            <div className="pcard-top">
              <div>
                <div className="pcard-cat">Platform growth</div>
                <div className="pcard-title">Will Zexus reach 1,000 verified users by July 1, 2026?</div>
              </div>
              <div className="ptimer hot"><i className="ph-bold ph-clock"></i> 6d left</div>
            </div>
            <div className="split-labels">
              <span className="sl-yes">Yes — 63%</span>
              <span className="sl-no">No — 37%</span>
            </div>
            <div className="split-bar">
              <div className="sb-yes" style={{ width: '63%' }}></div>
              <div className="sb-no" style={{ width: '37%' }}></div>
            </div>
            <div className="pool-row">
              <span>Pool: <span className="pool-val">1,240 ZXP</span></span>
              <span>142 participants</span>
            </div>
            <div className="bet-row">
              <button className="bet-btn bb-yes"><i className="ph-bold ph-check"></i> Bet Yes</button>
              <button className="bet-btn bb-no"><i className="ph-bold ph-x"></i> Bet No</button>
            </div>
          </div>

          {/* Card 2 */}
          <div className="pcard">
            <div className="pcard-top">
              <div>
                <div className="pcard-cat">Genesis Program</div>
                <div className="pcard-title">Will all Genesis Tier 1 spots be filled before launch?</div>
              </div>
              <div className="ptimer hot"><i className="ph-bold ph-clock"></i> 12d left</div>
            </div>
            <div className="split-labels">
              <span className="sl-yes">Yes — 71%</span>
              <span className="sl-no">No — 29%</span>
            </div>
            <div className="split-bar">
              <div className="sb-yes" style={{ width: '71%' }}></div>
              <div className="sb-no" style={{ width: '29%' }}></div>
            </div>
            <div className="pool-row">
              <span>Pool: <span className="pool-val">3,800 ZXP</span></span>
              <span>89 participants</span>
            </div>
            <div className="bet-row">
              <button className="bet-btn bb-yes"><i className="ph-bold ph-check"></i> Bet Yes</button>
              <button className="bet-btn bb-no"><i className="ph-bold ph-x"></i> Bet No</button>
            </div>
          </div>

          {/* Card 3 */}
          <div className="pcard">
            <div className="pcard-top">
              <div>
                <div className="pcard-cat">Product</div>
                <div className="pcard-title">Will 5+ ecosystem partners join before MVP?</div>
              </div>
              <div className="ptimer"><i className="ph-bold ph-clock"></i> 19d left</div>
            </div>
            <div className="split-labels">
              <span className="sl-yes">Yes — 58%</span>
              <span className="sl-no">No — 42%</span>
            </div>
            <div className="split-bar">
              <div className="sb-yes" style={{ width: '58%' }}></div>
              <div className="sb-no" style={{ width: '42%' }}></div>
            </div>
            <div className="pool-row">
              <span>Pool: <span className="pool-val">2,180 ZXP</span></span>
              <span>61 participants</span>
            </div>
            <div className="bet-row">
              <button className="bet-btn bb-yes"><i className="ph-bold ph-check"></i> Bet Yes</button>
              <button className="bet-btn bb-no"><i className="ph-bold ph-x"></i> Bet No</button>
            </div>
          </div>

          {/* Card 4 - resolved */}
          <div className="pcard resolved">
            <div className="pcard-top">
              <div>
                <div className="pcard-cat">
                  Partnerships
                  <span className="resolved-tag rt-yes">
                    <i className="ph-bold ph-check" style={{ fontSize: '9px' }}></i> Yes
                  </span>
                </div>
                <div className="pcard-title">ZXP staking pool exceeded 5,000 ZXP by May</div>
              </div>
              <div className="ptimer"><i className="ph-bold ph-lock"></i> Closed</div>
            </div>
            <div className="split-labels">
              <span className="sl-yes">Yes — 71%</span>
              <span className="sl-no">No — 29%</span>
            </div>
            <div className="split-bar">
              <div className="sb-yes" style={{ width: '71%' }}></div>
              <div className="sb-no" style={{ width: '29%' }}></div>
            </div>
            <div className="pool-row">
              <span>Final pool: <span className="pool-val">3,200 ZXP</span></span>
              <span>Paid out</span>
            </div>
            <div className="bet-row">
              <button className="bet-btn bb-yes bb-disabled" disabled>Bets closed</button>
            </div>
          </div>
        </div>
      </div>

      <div className="right">
        <div className="panel">
          <div className="panel-title">Market stats</div>
          <div className="stat-big">8,620</div>
          <div className="stat-sub">ZXP in active pools</div>
          <div className="s-row"><span className="s-k">Open events</span><span className="s-v">3</span></div>
          <div className="s-row"><span className="s-k">Participants</span><span className="s-v">292</span></div>
          <div className="s-row"><span className="s-k">Fee</span><span className="s-v">1.5%</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">My bets</div>
          <div className="mybets-row">
            <div className="mybets-name">1,000 users by July 1</div>
            <div className="mybets-detail">
              <span className="mbside-yes">Yes</span>
              <span className="mbzxp">50 ZXP</span>
            </div>
          </div>
          <div className="mybets-row">
            <div className="mybets-name">Genesis Tier 1 fills up</div>
            <div className="mybets-detail">
              <span className="mbside-yes">Yes</span>
              <span className="mbzxp">30 ZXP</span>
            </div>
          </div>
          <div className="mybets-row">
            <div className="mybets-name">5+ partners before MVP ✓</div>
            <div className="mybets-detail">
              <span className="mbside-yes">Yes</span>
              <span className="mbzxp win">+42 ZXP</span>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Rules</div>
          <div className="rule-row">
            <i className="ph-bold ph-info"></i>
            <div className="rule-text">Only internal Zexus events: growth, product, partnerships</div>
          </div>
          <div className="rule-row">
            <i className="ph-bold ph-coin"></i>
            <div className="rule-text">Bets in ZXP only · Minimum 10 ZXP</div>
          </div>
          <div className="rule-row">
            <i className="ph-bold ph-percent"></i>
            <div className="rule-text">1-2% pool fee goes to the ecosystem</div>
          </div>
          <div className="rule-row">
            <i className="ph-bold ph-shield-check"></i>
            <div className="rule-text">Result is verified on-chain, so manipulation is impossible</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">My ZXP balance</div>
          <div className="zxp-big">340</div>
          <div className="zxp-sub">Available for bets: 140 ZXP</div>
          <div className="zxp-bar-row">
            <span className="zbl">In bets</span>
            <div className="zbw"><div className="zbf" style={{ width: '24%', background: 'var(--amber)' }}></div></div>
            <span className="zbv">80</span>
          </div>
          <div className="zxp-bar-row">
            <span className="zbl">Free</span>
            <div className="zbw"><div className="zbf" style={{ width: '41%', background: 'var(--green)' }}></div></div>
            <span className="zbv">140</span>
          </div>
          <div className="zxp-bar-row">
            <span className="zbl">Staking</span>
            <div className="zbw"><div className="zbf" style={{ width: '59%', background: 'var(--gold)' }}></div></div>
            <span className="zbv">200</span>
          </div>
        </div>
      </div>
    </div>
  )
}
