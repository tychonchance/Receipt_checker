import { useState, useEffect, useCallback } from 'react'
import ReceiptUploader from './components/ReceiptUploader.jsx'
import CalendarPanel from './components/CalendarPanel.jsx'
import ReceiptTable from './components/ReceiptTable.jsx'

export default function App() {
  const [receipts, setReceipts] = useState([])
  const [calendars, setCalendars] = useState([])
  const [bufferHours, setBufferHours] = useState(2)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [rRes, cRes] = await Promise.all([
      fetch('/api/receipts'),
      fetch('/api/calendars'),
    ])
    const [r, c] = await Promise.all([rRes.json(), cRes.json()])
    setReceipts(r)
    setCalendars(c)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCalendarUpload = (data) => {
    refresh()
  }

  const handleCalendarDelete = () => {
    refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60,
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>🧾</span>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>
            Receipt Checker
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: 13 }}>
            {receipts.length} receipt{receipts.length !== 1 ? 's' : ''}
            {calendars.length > 0 && ` · ${calendars.length} calendar${calendars.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 48px' }}>
        {/* Upload row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 20,
          marginBottom: 24,
        }}>
          <ReceiptUploader onUploaded={refresh} />
          <CalendarPanel
            calendars={calendars}
            onUpload={handleCalendarUpload}
            onDelete={handleCalendarDelete}
          />
        </div>

        {/* How it works — shown when empty */}
        {receipts.length === 0 && calendars.length === 0 && (
          <div style={{
            background: '#fff', borderRadius: 16, padding: 32,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 24,
          }}>
            <h3 style={{ fontWeight: 700, color: '#1e293b', marginBottom: 20, fontSize: 15 }}>How it works</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
              {[
                { icon: '📸', title: '1. Upload receipts', desc: 'Drag and drop receipt photos. AI extracts the date, time, amount and company automatically.' },
                { icon: '📅', title: '2. Import calendars', desc: 'Upload .ics calendar exports from Google Calendar, Outlook, Apple Calendar, or any standard source.' },
                { icon: '✅', title: '3. Auto-match', desc: 'Each receipt is matched to calendar events within the time window. Ambiguous matches are flagged yellow, unmatched red.' },
              ].map(step => (
                <div key={step.title} style={{ textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>{step.icon}</div>
                  <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>{step.title}</p>
                  <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipt table */}
        <ReceiptTable
          receipts={receipts}
          onDelete={refresh}
          onRefresh={refresh}
          bufferHours={bufferHours}
          setBufferHours={setBufferHours}
        />
      </main>
    </div>
  )
}
