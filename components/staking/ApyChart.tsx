'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    Chart: any
  }
}

export default function ApyChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    const initChart = () => {
      if (!canvasRef.current || !window.Chart) return
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }

      const days = ['Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'Apr 29', 'May 6', 'May 13', 'now']
      const apy = [25, 23, 21, 19, 18, 16, 15, 14]
      const pool = [800, 1200, 2100, 3400, 4800, 6200, 7400, 8620]

      chartRef.current = new window.Chart(canvasRef.current.getContext('2d'), {
        data: {
          labels: days,
          datasets: [
            {
              type: 'line',
              label: 'APY',
              data: apy,
              borderColor: '#4caf7d',
              borderWidth: 2,
              pointBackgroundColor: days.map((_, i) => i === days.length - 1 ? '#4caf7d' : '#131210'),
              pointBorderColor: days.map((_, i) => i === days.length - 1 ? '#4caf7d' : '#3a3830'),
              pointRadius: days.map((_, i) => i === days.length - 1 ? 5 : 3),
              tension: 0.4,
              fill: true,
              backgroundColor: (c: any) => {
                const g = c.chart.ctx.createLinearGradient(0, 0, 0, 80)
                g.addColorStop(0, 'rgba(76,175,61,0.1)')
                g.addColorStop(1, 'rgba(76,175,61,0)')
                return g
              },
              yAxisID: 'yA',
              order: 1,
            },
            {
              type: 'bar',
              label: 'Pool',
              data: pool,
              backgroundColor: 'rgba(201,165,90,0.1)',
              borderColor: 'rgba(201,165,90,0.2)',
              borderWidth: 0.5,
              borderRadius: 3,
              yAxisID: 'yP',
              order: 2,
            },
            {
              type: 'line',
              label: 'max',
              data: new Array(8).fill(25),
              borderColor: 'rgba(201,165,90,0.2)',
              borderWidth: 1,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false,
              yAxisID: 'yA',
              order: 3,
            },
            {
              type: 'line',
              label: 'min',
              data: new Array(8).fill(5),
              borderColor: 'rgba(90,130,201,0.2)',
              borderWidth: 1,
              borderDash: [4, 4],
              pointRadius: 0,
              fill: false,
              yAxisID: 'yA',
              order: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a1916',
              borderColor: '#2e2c28',
              borderWidth: 0.5,
              titleColor: '#e8e4dc',
              bodyColor: '#6e6c66',
              padding: 8,
              callbacks: {
                label: (i: any) => {
                  if (i.dataset.label === 'APY') return `  APY: ${i.raw}%`
                  if (i.dataset.label === 'Pool') return `  Pool: ${i.raw.toLocaleString()} ZXP`
                  return null
                },
                filter: (i: any) => i.dataset.label === 'APY' || i.dataset.label === 'Pool',
              },
            },
          },
          scales: {
            x: {
              grid: { color: '#1e1c18' },
              ticks: { color: '#4a4844', font: { size: 9 } },
              border: { display: false },
            },
            yA: {
              position: 'left',
              min: 0,
              max: 30,
              grid: { color: '#1e1c18' },
              ticks: {
                color: '#4a4844',
                font: { size: 9 },
                callback: (v: any) => v + '%',
                stepSize: 5,
              },
              border: { display: false },
            },
            yP: {
              position: 'right',
              grid: { display: false },
              ticks: {
                color: '#2e2c28',
                font: { size: 9 },
                callback: (v: any) => (v / 1000).toFixed(0) + 'k',
              },
              border: { display: false },
            },
          },
        },
      })
    }

    // Chart.js is loaded via CDN in layout.tsx
    if (window.Chart) {
      initChart()
    } else {
      const interval = setInterval(() => {
        if (window.Chart) {
          clearInterval(interval)
          initChart()
        }
      }, 100)
      return () => clearInterval(interval)
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [])

  return <canvas ref={canvasRef} id="apyChart" height={60} />
}
