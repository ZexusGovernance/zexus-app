'use client'

import { useState } from 'react'

interface ProjectDetailProps {
  onBack: () => void
}

type DayEvent = {
  date: string
  title: string
  status: string
  votes: string
  impact: string
  type: string
}

const DAY_EVENTS: Record<number, DayEvent> = {
  4: { date: 'May 04', title: 'Testnet deploy verified', status: 'Status: Verified', votes: 'Votes: 847', impact: 'Trust Score impact: +12', type: 'verified' },
  9: { date: 'May 09', title: 'Liquidity Pool v2 missed', status: 'Status: Missed deadline', votes: 'Votes: 214', impact: 'Trust Score impact: -18', type: 'risk' },
  12: { date: 'May 12', title: 'Security Audit submitted', status: 'Status: Community voting', votes: 'Votes: 312', impact: 'Trust Score impact: pending', type: 'voting' },
  18: { date: 'May 18', title: 'Governance update verified', status: 'Status: Verified update', votes: 'Votes: 528', impact: 'Trust Score impact: +5', type: 'important' },
  23: { date: 'May 23', title: 'Treasury report posted', status: 'Status: Positive update', votes: 'Votes: 402', impact: 'Trust Score impact: +3', type: 'verified' },
}

const MILESTONES = [
  { name: 'Security Audit', date: 'May 14', status: 'Voting', statusClass: 'status-voting', impact: '+15/-18' },
  { name: 'Liquidity Pool v2', date: 'May 09', status: 'Missed', statusClass: 'status-missed', impact: '-18' },
  { name: 'Mainnet v2.1', date: 'May 02', status: 'Verified', statusClass: 'status-verified', impact: '+8' },
  { name: 'Mobile App Beta', date: 'Aug 15', status: 'Pending', statusClass: 'status-pending', impact: '+6/-10' },
  { name: 'Oracle dispute review', date: 'May 20', status: 'Disputed', statusClass: 'status-disputed', impact: '-8' },
]

export default function ProjectDetail({ onBack }: ProjectDetailProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(12)

  const selectedEvent = selectedDay !== null
    ? DAY_EVENTS[selectedDay] || {
        date: `May ${String(selectedDay).padStart(2, '0')}`,
        title: 'No activity',
        status: 'Status: No activity',
        votes: 'Votes: -',
        impact: 'Trust Score impact: 0',
        type: 'none',
      }
    : null

  return (
    <>
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="proj-detail-header">
          <div className="back-btn" onClick={onBack}>
            <i className="ph-bold ph-arrow-left"></i> Back to projects
          </div>
          <div className="pdh-top">
            <div className="pdh-av av-teal" style={{ width: 52, height: 52, fontSize: 20 }}>B</div>
            <div style={{ flex: 1 }}>
              <div className="pdh-name">BaseSwap Pro</div>
              <div className="pdh-sub">DEX · Base Mainnet · 12,100 holders</div>
              <div className="plc-tags">
                <span className="plc-tag verified"><i className="ph-bold ph-check" style={{ fontSize: '9px' }}></i> Verified</span>
                <span className="plc-tag">DEX</span>
                <span className="plc-tag">Genesis T2</span>
              </div>
            </div>
          </div>
          <div className="tabs trust-tabs">
            <div className="tab active">Overview</div>
            <div className="tab">Trust Timeline</div>
            <div className="tab">Milestones</div>
            <div className="tab">Votes</div>
            <div className="tab">Holders</div>
          </div>
        </div>
        <div className="scroll">
          {/* Trust Timeline Card */}
          <div className="trust-timeline-card" id="trust-timeline">
            <div className="concept-head">
              <div>
                <div className="concept-title">Trust Timeline</div>
                <div className="concept-sub">Every promise, missed deadline, update, and community verdict becomes visible over time.</div>
              </div>
              <div className="timeline-legend">
                <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(83,201,146,0.62)' }}></span>Verified</span>
                <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(225,184,94,0.68)' }}></span>Voting</span>
                <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(238,121,121,0.62)' }}></span>Risk</span>
                <span className="legend-pill"><span className="legend-dot" style={{ background: 'rgba(111,155,229,0.68)' }}></span>Important</span>
              </div>
            </div>
            <div className="timeline-grid">
              {Array.from({ length: 30 }, (_, i) => {
                const day = i + 1
                const event = DAY_EVENTS[day]
                const type = event ? event.type : 'none'
                return (
                  <button
                    key={day}
                    className={`timeline-day tl-${type}${selectedDay === day ? ' active' : ''}`}
                    type="button"
                    aria-label={`May ${String(day).padStart(2, '0')}`}
                    onClick={() => setSelectedDay(day)}
                  />
                )
              })}
            </div>
            {selectedEvent && (
              <div className="timeline-detail">
                <div>
                  <div className="timeline-date">{selectedEvent.date}</div>
                  <div className="timeline-event-title">{selectedEvent.title}</div>
                  <div className="timeline-meta">
                    {selectedEvent.status}<br />
                    {selectedEvent.votes}<br />
                    {selectedEvent.impact}
                  </div>
                </div>
                <div></div>
              </div>
            )}
          </div>

          {/* Roadmap Promises */}
          <div className="roadmap-promises">
            <div className="concept-head">
              <div>
                <div className="concept-title">Roadmap Promises</div>
                <div className="concept-sub">Every milestone is a public commitment tracked on-chain.</div>
              </div>
            </div>
            <div className="milestone-list">
              {MILESTONES.map((m, i) => (
                <div key={i} className="milestone-card">
                  <div>
                    <div className="milestone-name">{m.name}</div>
                    <div className="milestone-meta">{m.date} · Impact: {m.impact}</div>
                  </div>
                  <span className={`status-pill ${m.statusClass}`}>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel for project detail */}
      <div className="right" id="project-detail-right">
        <div className="panel">
          <div className="panel-title">Trust Score</div>
          <div className="ts-big">68</div>
          <div className="ts-lbl">Trust Score</div>
          <div className="ts-bar-wrap">
            <div className="ts-bar-fill" style={{ width: '68%' }}></div>
          </div>
          <div className="ts-hint"><span>0</span><span>100</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Stats</div>
          <div className="s-row"><span className="s-k">Holders</span><span className="s-v green">12,100</span></div>
          <div className="s-row"><span className="s-k">Verdicts</span><span className="s-v">4</span></div>
          <div className="s-row"><span className="s-k">Active since</span><span className="s-v">May 2024</span></div>
          <div className="s-row"><span className="s-k">Category</span><span className="s-v gold">DEX</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Actions</div>
          <button className="action-btn primary"><i className="ph-bold ph-shield-check"></i> Verify holding</button>
          <button className="action-btn"><i className="ph-bold ph-bookmark"></i> Add to watchlist</button>
          <button className="emergency-btn"><i className="ph-bold ph-warning"></i> Emergency Call</button>
        </div>
        <div className="panel">
          <div className="panel-title">Top verifiers</div>
          <div className="tv-row">
            <div className="tv-av">A</div>
            <div className="tv-name">0xa1f...3d</div>
            <div className="tv-pts">840 ZXP</div>
          </div>
          <div className="tv-row">
            <div className="tv-av">B</div>
            <div className="tv-name">0xb2c...7f</div>
            <div className="tv-pts">620 ZXP</div>
          </div>
          <div className="tv-row">
            <div className="tv-av">C</div>
            <div className="tv-name">0xc4e...1a</div>
            <div className="tv-pts">410 ZXP</div>
          </div>
        </div>
      </div>
    </>
  )
}
