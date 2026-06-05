'use client'

const MIN_APY = 5
const MAX_APY = 25

export default function ApyChart({ currentApy = 8 }: { currentApy?: number }) {
  const pct = ((currentApy - MIN_APY) / (MAX_APY - MIN_APY)) * 100

  return (
    <div style={{ width: '100%' }}>
      {/* Bar */}
      <div style={{ position: 'relative', height: 5, borderRadius: 3, background: 'linear-gradient(to right, rgba(111,155,229,0.35), rgba(83,201,146,0.7))', marginBottom: 12 }}>
        <div style={{
          position: 'absolute', top: '50%', left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: 11, height: 11, borderRadius: '50%',
          background: 'var(--green)',
          border: '2px solid #131210',
          boxShadow: '0 0 6px rgba(83,201,146,0.5)',
          zIndex: 1,
        }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
        <span>Min {MIN_APY}%</span>
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>Now {currentApy}%</span>
        <span>Max {MAX_APY}%</span>
      </div>

      {/* Tier bonuses */}
      <div style={{
        marginTop: 10, display: 'flex', justifyContent: 'space-between',
        padding: '7px 10px', background: 'transparent', borderRadius: 6,
        fontSize: 10, color: 'var(--muted)',
      }}>
        <span>30d → 1.05x</span>
        <span>90d → 1.1x</span>
        <span>180d → 1.2x</span>
        <span>365d → 1.35x</span>
      </div>
    </div>
  )
}
