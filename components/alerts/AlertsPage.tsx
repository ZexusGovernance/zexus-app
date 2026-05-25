'use client'

import { useState } from 'react'

type AlertTab = 'All' | 'Unread'

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<AlertTab>('All')

  return (
    <div className="page active" id="page-alerts">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div className="page-title">Alerts</div>
          <div className="page-sub">Critical events from your watchlist</div>
          <div className="tabs">
            {(['All', 'Unread'] as AlertTab[]).map(t => (
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
          {/* Alert 1 */}
          <div className="card c-alert">
            <div className="card-head">
              <div className="proj-av av-red">N</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>NovaDEX</div>
              </div>
              <span className="type-badge tb-alert">Critical</span>
              <div className="card-time">11h ago</div>
            </div>
            <div className="card-title">Liquidity Pool deadline — 48h no response</div>
            <div className="card-text">Trust Score auto-reduced to 41.</div>
            <div className="card-footer">
              <div className="foot-btn danger"><i className="ph-bold ph-warning"></i> Emergency Call</div>
              <div className="foot-btn"><i className="ph-bold ph-eye"></i> View project</div>
            </div>
          </div>

          {/* Alert 2 */}
          <div className="card c-alert">
            <div className="card-head">
              <div className="proj-av av-blue">U</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>BaseSwap Pro</div>
              </div>
              <span className="type-badge tb-alert">Alert</span>
              <div className="card-time">1d ago</div>
            </div>
            <div className="card-title">Security Audit vote closes in 14h</div>
            <div className="card-text">312 verified holders have voted.</div>
            <span className="score-pill sp-up">
              <i className="ph-bold ph-trend-up" style={{ fontSize: '11px' }}></i> +12 pts from last vote
            </span>
            <div className="card-footer">
              <div className="foot-btn"><i className="ph-bold ph-shield-check"></i> Vote now</div>
              <div className="foot-btn">Dismiss</div>
            </div>
          </div>

          {/* Alert 3 - only in All tab */}
          {activeTab === 'All' && (
            <div className="card c-update">
              <div className="card-head">
                <div className="proj-av av-gold">A</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>AeroBase</div>
                </div>
                <span className="type-badge tb-update">Update</span>
                <div className="card-time">2d ago</div>
              </div>
              <div className="card-title">v2.1 mainnet deploy completed</div>
              <div className="card-text">Trust Score increased.</div>
              <span className="score-pill sp-up">
                <i className="ph-bold ph-trend-up" style={{ fontSize: '11px' }}></i> +8 pts · Trust Score: 85
              </span>
              <div className="card-footer">
                <div className="foot-btn"><i className="ph-bold ph-arrow-square-out"></i> View update</div>
                <div className="foot-btn"><i className="ph-bold ph-bookmark"></i> Add to watchlist</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="right">
        <div className="panel">
          <div className="panel-title">Summary</div>
          <div className="s-row"><span className="s-k">Unread</span><span className="s-v red">3</span></div>
          <div className="s-row"><span className="s-k">Critical</span><span className="s-v red">1</span></div>
          <div className="s-row"><span className="s-k">Last 7 days</span><span className="s-v">8</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Notification settings</div>
          <div className="s-row"><span className="s-k">Missed deadline</span><span className="s-v green">On</span></div>
          <div className="s-row"><span className="s-k">Trust Score drop</span><span className="s-v green">On</span></div>
          <div className="s-row"><span className="s-k">New verdicts</span><span className="s-v green">On</span></div>
          <div className="s-row"><span className="s-k">New projects</span><span className="s-v" style={{ color: 'var(--muted)' }}>Off</span></div>
        </div>
      </div>
    </div>
  )
}
