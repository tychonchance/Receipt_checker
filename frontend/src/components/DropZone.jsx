import { useState, useRef } from 'react'

export default function DropZone({ accept, multiple, onFiles, label, subLabel, icon }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      accept.split(',').some(type => {
        const t = type.trim()
        if (t.startsWith('.')) return f.name.toLowerCase().endsWith(t)
        return f.type.match(t.replace('*', '.*'))
      })
    )
    if (files.length) onFiles(files)
  }

  return (
    <div
      style={{
        border: `2px dashed ${dragging ? '#3b82f6' : '#cbd5e1'}`,
        borderRadius: 12,
        padding: '32px 24px',
        textAlign: 'center',
        background: dragging ? '#eff6ff' : '#f8fafc',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
      <p style={{ fontWeight: 600, color: '#334155', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>{subLabel}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) onFiles(Array.from(e.target.files)) }}
      />
    </div>
  )
}
