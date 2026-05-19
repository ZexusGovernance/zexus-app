'use client'

import { useRouter } from 'next/navigation'
import { PROJECTS } from '@/lib/data'

interface ProjectsPageProps {
  onNavigate: (page: string) => void
}

export default function ProjectsPage({ onNavigate }: ProjectsPageProps) {
  const router = useRouter()

  return (
    <div className="page active" id="page-projects">
      <div className="center" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <div className="page-title">Projects</div>
              <div className="page-sub">Verified projects on Base Mainnet</div>
            </div>
            <div className="filter-row" style={{ marginBottom: 0 }}>
              <button className="filter-btn active">All</button>
              <button className="filter-btn">DeFi</button>
              <button className="filter-btn">Lending</button>
              <button className="filter-btn">DEX</button>
            </div>
          </div>
        </div>
        <div className="scroll" id="projects-list">
          {PROJECTS.map(p => (
            <div key={p.id} className="proj-list-card" style={{ cursor: 'pointer' }} onClick={() => router.push(`/projects/${p.id}`)}>
              <div
                className={`proj-av ${p.av}`}
                style={{ width: 44, height: 44, fontSize: 18, borderRadius: 10 }}
              >
                {p.letter}
              </div>
              <div className="plc-info">
                <div className="plc-name">{p.name}</div>
                <div className="plc-sub">{p.sub}</div>
                <div className="plc-tags">
                  {p.tags.map((t, i) => (
                    <span key={i} className={`plc-tag${t.variant === 'verified' ? ' verified' : ''}`}>
                      {t.variant === 'verified' && <i className="ph-bold ph-check" style={{ fontSize: '9px' }}></i>}
                      {t.variant === 'verified' ? ' ' : ''}{t.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="plc-score-col">
                <div className={`plc-score ${p.scoreClass}`}>{p.score !== null ? p.score : '—'}</div>
                <div className={`plc-trend ${p.trendClass}`}>
                  {p.trendClass === 'plt-up' && <i className="ph-bold ph-trend-up" style={{ fontSize: '10px' }}></i>}
                  {p.trendClass === 'plt-down' && <i className="ph-bold ph-trend-down" style={{ fontSize: '10px' }}></i>}
                  {' '}{p.trend}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right sidebar for projects list */}
      <div className="right" id="projects-right">
        <div className="panel">
          <div className="panel-title">Platform stats</div>
          <div className="s-row"><span className="s-k">Total projects</span><span className="s-v">5</span></div>
          <div className="s-row"><span className="s-k">Verified</span><span className="s-v green">4</span></div>
          <div className="s-row"><span className="s-k">Genesis members</span><span className="s-v gold">3</span></div>
          <div className="s-row"><span className="s-k">Average Trust Score</span><span className="s-v gold">62</span></div>
        </div>
        <div className="panel">
          <div className="panel-title">Top by Trust Score</div>
          <div className="rwatch-row">
            <div className="proj-av av-gold" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}>A</div>
            <div className="rw-name">AeroBase</div>
            <div className="rw-score rw-s-hi">85</div>
          </div>
          <div className="rwatch-row">
            <div className="proj-av av-blue" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}>U</div>
            <div className="rw-name">Umia Protocol</div>
            <div className="rw-score rw-s-hi">72</div>
          </div>
          <div className="rwatch-row">
            <div className="proj-av av-teal" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}>B</div>
            <div className="rw-name">BaseSwap Pro</div>
            <div className="rw-score rw-s-mi">68</div>
          </div>
          <div className="rwatch-row">
            <div className="proj-av av-red" style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}>N</div>
            <div className="rw-name">NovaDEX</div>
            <div className="rw-score rw-s-lo">41</div>
          </div>
        </div>
      </div>
    </div>
  )
}
