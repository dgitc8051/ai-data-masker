import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function RepairTrack() {
    const navigate = useNavigate()
    const [phone, setPhone] = useState('')
    const [ticketNo, setTicketNo] = useState('')
    const [tickets, setTickets] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const statusMap = {
        new: { label: '新建立', color: '#f59e0b', bg: '#fef3c7' },
        pending: { label: '待處理', color: '#f59e0b', bg: '#fef3c7' },
        dispatched: { label: '已派工', color: '#3b82f6', bg: '#dbeafe' },
        in_progress: { label: '處理中', color: '#8b5cf6', bg: '#ede9fe' },
        done: { label: '已完工', color: '#10b981', bg: '#d1fae5' },
        completed: { label: '已結案', color: '#6b7280', bg: '#f3f4f6' },
        closed: { label: '已關閉', color: '#6b7280', bg: '#f3f4f6' },
    }

    const handleSearch = async (e) => {
        e.preventDefault()
        if (!phone.trim() || !ticketNo.trim()) return
        setLoading(true)
        setError('')
        setTickets(null)

        try {
            const params = new URLSearchParams({ phone, ticket_no: ticketNo })
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/tickets/track?${params}`
            )
            const data = await res.json()
            if (res.ok) {
                setTickets(data.tickets || [])
            } else {
                setError(data.message || '查詢失敗')
            }
        } catch {
            setError('網路連線錯誤，請稍後再試')
        } finally {
            setLoading(false)
        }
    }

    const goToDetail = (ticket) => {
        navigate(`/track/${ticket.id}`, {
            state: { phone, ticketNo, ticket }
        })
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
            padding: '20px 16px 40px',
        }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                {/* Header */}
                <Link to="/home" style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                    textDecoration: 'none', display: 'inline-block', marginBottom: '16px',
                }}>← 返回首頁</Link>

                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>📋</div>
                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 6px', fontWeight: '700' }}>
                        維修進度查詢
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                        輸入報修時的維修編號及手機號碼
                    </p>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} style={{
                    background: 'rgba(255,255,255,0.08)', borderRadius: '16px',
                    padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
                    marginBottom: '20px',
                }}>
                    <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                        維修編號 *
                    </label>
                    <input
                        type="text" value={ticketNo}
                        onChange={e => setTicketNo(e.target.value)}
                        placeholder="例如：TK-20260215-001"
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.15)', fontSize: '15px',
                            background: 'rgba(255,255,255,0.06)', color: '#fff',
                            boxSizing: 'border-box', outline: 'none', fontFamily: 'monospace',
                            marginBottom: '14px',
                        }}
                    />

                    <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                        手機號碼 *
                    </label>
                    <input
                        type="tel" value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="例如：0912345678"
                        style={{
                            width: '100%', padding: '12px 16px', borderRadius: '10px',
                            border: '1px solid rgba(255,255,255,0.15)', fontSize: '16px',
                            background: 'rgba(255,255,255,0.06)', color: '#fff',
                            boxSizing: 'border-box', outline: 'none',
                        }}
                    />

                    <div style={{
                        background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                        padding: '10px 12px', marginTop: '14px',
                    }}>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>
                            🔒 為保護您的隱私，需同時輸入維修編號和手機號碼才能查詢
                        </p>
                    </div>

                    <button type="submit" disabled={loading || !phone.trim() || !ticketNo.trim()} style={{
                        width: '100%', marginTop: '14px', padding: '12px',
                        borderRadius: '10px', border: 'none', fontSize: '15px',
                        fontWeight: '600', cursor: 'pointer', color: '#fff',
                        background: loading || !phone.trim() || !ticketNo.trim() ? '#4b5563' : '#3b82f6',
                    }}>
                        {loading ? '⏳ 查詢中...' : '🔍 查詢進度'}
                    </button>
                </form>

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)',
                        color: '#fca5a5', fontSize: '14px', textAlign: 'center', marginBottom: '16px',
                    }}>❌ {error}</div>
                )}

                {/* Results */}
                {tickets !== null && (
                    tickets.length === 0 ? (
                        <div style={{
                            padding: '32px', borderRadius: '16px',
                            background: 'rgba(255,255,255,0.06)', textAlign: 'center',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '0 0 4px' }}>
                                找不到符合的維修紀錄
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>
                                請確認維修編號和手機號碼是否正確
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px' }}>
                                共找到 {tickets.length} 筆紀錄
                            </p>
                            {tickets.map(t => {
                                const st = statusMap[t.status] || statusMap.pending
                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => goToDetail(t)}
                                        style={{
                                            background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                                            padding: '16px', marginBottom: '10px',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                                            e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', fontFamily: 'monospace' }}>
                                                {t.ticket_no}
                                            </span>
                                            <span style={{
                                                padding: '2px 10px', borderRadius: '10px', fontSize: '12px',
                                                fontWeight: '600', color: st.color, background: `${st.color}22`,
                                            }}>
                                                {st.label}
                                            </span>
                                        </div>
                                        <p style={{ color: '#fff', fontSize: '15px', fontWeight: '600', margin: '0 0 6px' }}>
                                            {t.category} — {t.title || t.description?.substring(0, 30)}
                                        </p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                                                📅 {new Date(t.created_at).toLocaleDateString('zh-TW')}
                                                {t.completed_at && ` → ✅ ${new Date(t.completed_at).toLocaleDateString('zh-TW')} 完工`}
                                            </span>
                                            <span style={{ color: '#60a5fa', fontSize: '12px' }}>查看詳情 →</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </div>
        </div>
    )
}
