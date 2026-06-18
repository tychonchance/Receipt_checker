import { useState } from 'react'
import DropZone from './DropZone.jsx'

export default function ReceiptUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  const handleFiles = async (files) => {
    setUploading(true)
    setError(null)
    setProgress(`Processing ${files.length} receipt${files.length > 1 ? 's' : ''}…`)

    // Upload in batches of 3 to avoid overloading
    const batchSize = 3
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      const form = new FormData()
      batch.forEach(f => form.append('files', f))
      try {
        const res = await fetch('/api/receipts', { method: 'POST', body: form })
        if (!res.ok) throw new Error(await res.text())
        setProgress(`Processed ${Math.min(i + batchSize, files.length)} / ${files.length}…`)
      } catch (e) {
        setError(e.message)
        break
      }
    }

    setUploading(false)
    setProgress(null)
    onUploaded()
  }

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#1e293b' }}>
        Upload Receipts
      </h2>

      <DropZone
        accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
        multiple
        onFiles={handleFiles}
        label={uploading ? progress : 'Drop receipt images here'}
        subLabel={uploading ? 'AI is extracting receipt details…' : 'JPG, PNG, WebP accepted · multiple files OK'}
        icon={uploading ? '⏳' : '🧾'}
      />

      {error && (
        <p style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>{error}</p>
      )}
    </div>
  )
}
