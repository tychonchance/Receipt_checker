import { useState } from 'react'
import DropZone from './DropZone.jsx'

export default function CalendarPanel({ calendars, onUpload, onDelete, loading }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const handleFiles = async (files) => {
    setUploading(true)
    setError(null)
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    try {
      const res = await fetch('/api/calendars', { method: 'POST', body: form })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      onUpload(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (name) => {
    if (!confirm(`Remove calendar "${name}" and its events?`)) return
    await fetch(`/api/calendars/${encodeURIComponent(name)}`, { method: 'DELETE' })
    onDelete(name)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#1e293b' }}>
        Calendars
      </h2>

      <DropZone
        accept=".ics"
        multiple
        onFiles={handleFiles}
        label={uploading ? 'Uploading...' : 'Drop .ics calendar files here'}
        subLabel="or click to browse"
        icon="📅"
      />

      {error && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>
      )}

      {calendars.length > 0 && (
        <ul style={{ marginTop: 16, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {calendars.map(cal => (
            <li key={cal.calendar_name} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#f1f5f9', borderRadius: 8, padding: '8px 12px',
            }}>
              <span style={{ fontSize: 14 }}>
                <span style={{ marginRight: 6 }}>📅</span>
                <strong>{cal.calendar_name}</strong>
                <span style={{ color: '#64748b', marginLeft: 6, fontSize: 12 }}>
                  {cal.event_count} event{cal.event_count !== 1 ? 's' : ''}
                </span>
              </span>
              <button
                onClick={() => handleDelete(cal.calendar_name)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, lineHeight: 1 }}
                title="Remove calendar"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
