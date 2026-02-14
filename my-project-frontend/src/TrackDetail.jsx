import { useState, useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'

const statusMap = {
    new: { label: '新建立', color: '#f59e0b', icon: '📝' },
    pending: { label: '待處理', color: '#f59e0b', icon: '⏳' },
    dispatched: { label: '已派工', color: '#3b82f6', icon: '🚗' },
    in_progress: { label: '處理中', color: '#8b5cf6', icon: '🔧' },
    done: { label: '已完工', color: '#10b981', icon: '✅' },
    completed: { label: '已結案', color: '#6b7280', icon: '📁' },
    closed: { label: '已關閉', color: '#6b7280', icon: '🔒' },
}

// 進度步驟
const statusSteps = ['new', 'dispatched', 'in_progress', 'done', 'completed']

export default function TrackDetail() {
    const { id } = useParams()
    const location = useLocation()
    const { phone, ticketNo } = location.state || {}

    const [ticket, setTicket] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!phone || !ticketNo) {
            setError('缺少驗證資訊，請重新查詢')
            setLoading(false)
            return
        }
        fetchDetail()
    }, [id]) // eslint-disable-line

    const fetchDetail = async () => {
        try {
            const params = new URLSearchParams({ phone, ticket_no: ticketNo })
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/tickets/track/${id}?${params}`
            )
            const data = await res.json()
            if (res.ok) {
                setTicket(data.ticket)
            } else {
                setError(data.message || '查詢失敗')
            }
        } catch {
            setError('網路連線錯誤')
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
            }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '16px' }}>⏳ 載入中...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)', padding: '20px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div>
                    <p style={{ color: '#fca5a5', fontSize: '15px', marginBottom: '20px' }}>{error}</p>
                    <Link to="/track" style={{
                        padding: '12px 24px', borderRadius: '10px',
                        background: '#3b82f6', color: '#fff', textDecoration: 'none',
                        fontSize: '14px',
                    }}>← 重新查詢</Link>
                </div>
            </div>
        )
    }

    const st = statusMap[ticket.status] || statusMap.pending
    const currentStep = statusSteps.indexOf(ticket.status)

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
            padding: '20px 16px 40px',
        }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                {/* Header */}
                <Link to="/track" style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                    textDecoration: 'none', display: 'inline-block', marginBottom: '16px',
                }}>← 返回查詢</Link>

                {/* Status Banner */}
                <div style={{
                    background: `${st.color}15`, borderRadius: '16px',
                    padding: '24px', border: `1px solid ${st.color}30`,
                    textAlign: 'center', marginBottom: '16px',
                }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>{st.icon}</div>
                    <div style={{
                        fontSize: '20px', fontWeight: '700', color: st.color, marginBottom: '4px',
                    }}>{st.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', fontFamily: 'monospace' }}>
                        {ticket.ticket_no}
                    </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                    padding: '20px', border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '16px',
                }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '14px' }}>
                        進度追蹤
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {statusSteps.map((s, i) => {
                            const info = statusMap[s]
                            const isActive = i <= currentStep
                            const isCurrent = s === ticket.status
                            return (
                                <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < statusSteps.length - 1 ? 1 : 'none' }}>
                                    <div style={{
                                        width: isCurrent ? '32px' : '24px',
                                        height: isCurrent ? '32px' : '24px',
                                        borderRadius: '50%',
                                        background: isActive ? `${info.color}` : 'rgba(255,255,255,0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: isCurrent ? '16px' : '10px', color: '#fff',
                                        transition: 'all 0.3s', flexShrink: 0,
                                        boxShadow: isCurrent ? `0 0 12px ${info.color}44` : 'none',
                                    }}>
                                        {isActive ? '✓' : ''}
                                    </div>
                                    {i < statusSteps.length - 1 && (
                                        <div style={{
                                            flex: 1, height: '2px', margin: '0 4px',
                                            background: i < currentStep ? info.color : 'rgba(255,255,255,0.1)',
                                        }} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                        {statusSteps.map((s) => (
                            <div key={s} style={{
                                fontSize: '10px', color: s === ticket.status ? statusMap[s].color : 'rgba(255,255,255,0.3)',
                                fontWeight: s === ticket.status ? '600' : '400',
                                textAlign: 'center', width: '48px',
                            }}>
                                {statusMap[s].label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Detail Info */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                    padding: '20px', border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '16px',
                }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '14px' }}>
                        報修資訊
                    </div>

                    {[
                        { label: '報修類別', value: ticket.category },
                        { label: '客戶姓名', value: ticket.customer_name },
                        { label: '聯絡電話', value: ticket.phone },
                        { label: '服務地址', value: ticket.address },
                        { label: '問題描述', value: ticket.description },
                        { label: '偏好時段', value: ticket.preferred_time_slot },
                    ].filter(item => item.value).map((item, i) => (
                        <div key={i} style={{
                            padding: '10px 0',
                            borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '4px' }}>
                                {item.label}
                            </div>
                            <div style={{ color: '#fff', fontSize: '14px' }}>
                                {item.value}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Timestamps */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                    padding: '20px', border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '16px',
                }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '14px' }}>
                        時間記錄
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>報修時間</span>
                        <span style={{ color: '#fff', fontSize: '13px' }}>
                            {new Date(ticket.created_at).toLocaleString('zh-TW')}
                        </span>
                    </div>
                    {ticket.completed_at && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>完工時間</span>
                            <span style={{ color: '#10b981', fontSize: '13px' }}>
                                {new Date(ticket.completed_at).toLocaleString('zh-TW')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Privacy Notice */}
                <div style={{
                    background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
                    padding: '12px 14px', textAlign: 'center',
                }}>
                    <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', margin: 0, lineHeight: '1.5' }}>
                        🔒 為保護個人隱私，姓名、電話及地址已做部分遮罩處理
                    </p>
                </div>
            </div>
        </div>
    )
}
