'use client'

import { useState, useEffect, useRef } from 'react'
import { SEARCH_PROJECTS } from '@/lib/data'

interface SearchOverlayProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (page: string) => void
}

export default function SearchOverlay({ isOpen, onClose, onNavigate }: SearchOverlayProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !isOpen) {
        e.preventDefault()
        // handled by parent Shell
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const filtered = query.trim()
    ? SEARCH_PROJECTS.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : SEARCH_PROJECTS.slice(0, 3)

  return (
    <div className={`search-overlay${isOpen ? ' active' : ''}`} onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <i className="ph-bold ph-magnifying-glass"></i>
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search projects, pages..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="search-esc" onClick={onClose}>Esc</button>
        </div>
        <div className="search-results">
          <div className="search-section-title">Projects</div>
          {filtered.length === 0 ? (
            <div className="search-empty">No results found</div>
          ) : (
            filtered.map(p => (
              <div
                key={p.name}
                className="search-result-item"
                onClick={() => { onNavigate('projects'); onClose() }}
              >
                <div className={`proj-av ${p.av}`} style={{ width: 32, height: 32, fontSize: 13, borderRadius: 8 }}>{p.l}</div>
                <div>
                  <div className="search-result-name">{p.name}</div>
                  <div className="search-result-cat">{p.cat}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
