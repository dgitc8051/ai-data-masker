import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import liff from '@line/liff'
import LiffCloseButton from './LiffCloseButton'

export default function RepairTrack() {
    const navigate = useNavigate()
    const API = import.meta.env.VITE_API_URL
    const [lineUserId, setLineUserId] = useState('')
    const [liffReady, setLiffReady] = useState(false)
    const [liffError, setLiffError] = useState('')
    const [tickets, setTickets] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // 舊式查詢 fallback
    const [phone, setPhone] = useState('')
    const [ticketNo, setTicketNo] = useState('')
    const [showManualSearch, setShowManualSearch] = useState(false)

    const statusMap = {
        new: { label: '新建立', color: '#f59e0b' },
        pending: { label: '待處理', color: '#f59e0b' },
        dispatched: { label: '已派工', color: '#3b82f6' },
        time_proposed: { label: '待確認時段', color: '#8b5cf6' },
        in_progress: { label: '處理中', color: '#8b5cf6' },
        need_more_info: { label: '待補件', color: '#f97316' },
        done: { label: '已完工', color: '#10b981' },
        completed: { label: '已結案', color: '#6b7280' },
        closed: { label: '已關閉', color: '#6b7280' },
        cancelled: { label: '已取消', color: '#ef4444' },
    }

    // LIFF 初始化
    useEffect(() => {
        const liffId = import.meta.env.VITE_LIFF_ID_TRACK
        if (!liffId) {
            // 沒有 LIFF ID → 直接顯示手動查詢
            setLiffReady(true)
            return
        }
        liff.init({ liffId })
            .then(async () => {
                if (!liff.isLoggedIn()) {
                    // 強制 LINE 登入（此 LIFF 端點為 /track，不會 400）
                    liff.login({ redirectUri: window.location.href })
                    return
                }
                try {
                    const profile = await liff.getProfile()
                    setLineUserId(profile.userId)
                } catch (err) {
                    console.warn('LIFF getProfile 失敗:', err)
                }
                setLiffReady(true)
            })
            .catch(err => {
                console.warn('LIFF 初始化失敗:', err)
                setLiffReady(true)
            })
    }, [])

    // LIFF 登入成功後自動查詢
    useEffect(() => {
        if (!lineUserId) return
        loadByLineId()
    }, [lineUserId]) // eslint-disable-line

    const loadByLineId = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(
                `${API}/api/tickets/track-by-line?line_user_id=${encodeURIComponent(lineUserId)}`
            )
            const data = await res.json()
            if (res.ok) setTickets(data.tickets || [])
            else setError(data.message || '查詢失敗')
        } catch {
            setError('網路連線錯誤，請稍後再試')
        }
        setLoading(false)
    }

    // 舊式查詢 fallback
    const handleManualSearch = async (e) => {
        e.preventDefault()
        if (phone.length !== 8 || !ticketNo.trim()) return
        setLoading(true)
        setError('')
        setTickets(null)
        try {
            const params = new URLSearchParams({ phone: `09${phone}`, ticket_no: ticketNo })
            const res = await fetch(`${API}/api/tickets/track?${params}`)
            const data = await res.json()
            if (res.ok) setTickets(data.tickets || [])
            else setError(data.message || '查詢失敗')
        } catch {
            setError('網路連線錯誤，請稍後再試')
        }
        setLoading(false)
    }

    const goToDetail = (ticket) => {
        navigate(`/track/${ticket.id}`, {
            state: {
                line_user_id: lineUserId,
                phone: phone ? `09${phone}` : '',
                ticketNo: ticket.ticket_no,
                ticket,
            }
        })
    }

    // ─── 載入中 ───
    if (!liffReady) {
        return (
            <div style={containerStyle}>
                <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center', paddingTop: '80px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
                    <h2 style={{ color: '#fff' }}>正在連線 LINE...</h2>
                    <p style={{ color: 'rgba(255,255,255,0.5)' }}>請稍候，正在進行身份驗證</p>
                </div>
            </div>
        )
    }

    return (
        <div style={containerStyle}>
            <LiffCloseButton />
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
                        {lineUserId ? '已透過 LINE 自動查詢您的維修紀錄' : '請透過 LINE 登入查詢'}
                    </p>
                </div>

                {/* LINE 登入失敗 → 顯示手動查詢 */}
                {!lineUserId && (
                    <div style={{
                        background: 'rgba(255,255,255,0.08)', borderRadius: '16px',
                        padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '20px', textAlign: 'center',
                    }}>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '16px' }}>
                            {liffError || '請透過 LINE 的選單開啟此頁面，即可自動查詢您的維修紀錄'}
                        </p>
                        <button
                            onClick={() => setShowManualSearch(!showManualSearch)}
                            style={{
                                padding: '8px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)',
                                background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '13px',
                            }}
                        >📝 手動輸入編號和電話查詢</button>
                    </div>
                )}

                {/* 手動查詢表單 (fallback) */}
                {showManualSearch && !lineUserId && (
                    <form onSubmit={handleManualSearch} style={{
                        background: 'rgba(255,255,255,0.08)', borderRadius: '16px',
                        padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '20px',
                    }}>
                        <label style={labelStyle}>維修編號 *</label>
                        <input
                            type="text" value={ticketNo}
                            onChange={e => setTicketNo(e.target.value)}
                            placeholder="例如：TK260215001"
                            style={inputStyle}
                        />
                        <label style={{ ...labelStyle, marginTop: '14px' }}>手機號碼 *</label>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                padding: '12px 14px', background: 'rgba(255,255,255,0.15)',
                                borderRadius: '10px 0 0 10px', border: '1px solid rgba(255,255,255,0.15)',
                                borderRight: 'none', fontWeight: '700', fontSize: '16px', color: '#fff',
                            }}>09</span>
                            <input
                                type="tel" value={phone}
                                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                maxLength={8} placeholder="12345678"
                                style={{ ...inputStyle, borderRadius: '0 10px 10px 0', marginBottom: 0 }}
                            />
                        </div>
                        <button type="submit" disabled={loading || phone.length !== 8 || !ticketNo.trim()} style={{
                            width: '100%', marginTop: '14px', padding: '12px', borderRadius: '10px',
                            border: 'none', fontSize: '15px', fontWeight: '600', cursor: 'pointer', color: '#fff',
                            background: loading || phone.length !== 8 || !ticketNo.trim() ? '#4b5563' : '#3b82f6',
                        }}>
                            {loading ? '⏳ 查詢中...' : '🔍 查詢進度'}
                        </button>
                    </form>
                )}

                {/* Loading */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.5)' }}>
                        ⏳ 查詢中...
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{
                        padding: '12px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)',
                        color: '#fca5a5', fontSize: '14px', textAlign: 'center', marginBottom: '16px',
                    }}>❌ {error}</div>
                )}

                {/* Results */}
                {!loading && tickets !== null && (
                    tickets.length === 0 ? (
                        <div style={{
                            padding: '32px', borderRadius: '16px',
                            background: 'rgba(255,255,255,0.06)', textAlign: 'center',
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '0 0 4px' }}>
                                目前沒有維修紀錄
                            </p>
                            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: 0 }}>
                                報修後即可在此查詢進度
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '12px' }}>
                                共 {tickets.length} 筆維修紀錄
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

const containerStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
    padding: '20px 16px 40px',
}
const labelStyle = { color: 'rgba(255,255,255,0.7)', fontSize: '13px', display: 'block', marginBottom: '8px' }
const inputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)', fontSize: '15px',
    background: 'rgba(255,255,255,0.06)', color: '#fff',
    boxSizing: 'border-box', outline: 'none', marginBottom: '14px',
}
