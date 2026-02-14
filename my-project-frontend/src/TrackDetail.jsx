import { useState, useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'

const statusMap = {
    new: { label: '新建立', color: '#f59e0b', icon: '📝' },
    pending: { label: '待處理', color: '#f59e0b', icon: '⏳' },
    need_more_info: { label: '待補件', color: '#ef4444', icon: '📢' },
    info_submitted: { label: '補件完成待審核', color: '#f97316', icon: '📥' },
    scheduled: { label: '已排程', color: '#8b5cf6', icon: '📅' },
    dispatched: { label: '已派工', color: '#3b82f6', icon: '🚗' },
    in_progress: { label: '處理中', color: '#8b5cf6', icon: '🔧' },
    done: { label: '已完工', color: '#10b981', icon: '✅' },
    completed: { label: '已結案', color: '#6b7280', icon: '📁' },
    closed: { label: '已關閉', color: '#6b7280', icon: '🔒' },
}

// 進度步驟
const statusSteps = ['new', 'dispatched', 'in_progress', 'done', 'closed']

export default function TrackDetail() {
    const { id } = useParams()
    const location = useLocation()
    const { phone, ticketNo } = location.state || {}

    const [ticket, setTicket] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [confirming, setConfirming] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    // 補件編輯
    const [editForm, setEditForm] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)

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
                if (data.ticket.quote_confirmed_at) setConfirmed(true)
                // 補件模式：預填表單
                if (data.ticket.editable) {
                    setEditForm({
                        customer_name: data.ticket.customer_name || '',
                        address: data.ticket.address || '',
                        description_raw: data.ticket.description || '',
                        category: data.ticket.category || '',
                        preferred_time_slot: data.ticket.preferred_time_slot || '',
                        is_urgent: data.ticket.is_urgent || false,
                    })
                }
            } else {
                setError(data.message || '查詢失敗')
            }
        } catch {
            setError('網路連線錯誤')
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmQuote = async () => {
        if (!confirm(`確定同意此報價 $${ticket.quoted_amount} 嗎？`)) return
        setConfirming(true)
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/tickets/track/${id}/confirm-quote`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, ticket_no: ticketNo }),
                }
            )
            const data = await res.json()
            if (res.ok) {
                setConfirmed(true)
                fetchDetail()
            } else {
                alert(data.message || '確認失敗')
            }
        } catch {
            alert('網路連線錯誤')
        } finally {
            setConfirming(false)
        }
    }

    // 補件提交
    const handleSupplement = async () => {
        setSubmitting(true)
        try {
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/tickets/track/${id}/supplement`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone, ticket_no: ticketNo, ...editForm }),
                }
            )
            const data = await res.json()
            if (res.ok) {
                setSubmitted(true)
                fetchDetail()
            } else {
                alert(data.message || '補件失敗')
            }
        } catch {
            alert('網路連線錯誤')
        } finally {
            setSubmitting(false)
        }
    }

    const inputStyle = {
        width: '100%', padding: '10px 14px', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.15)', fontSize: '14px',
        background: 'rgba(255,255,255,0.08)', color: '#fff',
        boxSizing: 'border-box',
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

                {/* ===== 待補件區域 ===== */}
                {ticket.status === 'need_more_info' && !submitted && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(239,68,68,0.3)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#fca5a5', marginBottom: '12px' }}>
                            📢 請補充資料
                        </div>

                        {/* 客服留言 */}
                        {ticket.supplement_note && (
                            <div style={{
                                padding: '12px 14px', background: 'rgba(255,255,255,0.08)',
                                borderRadius: '10px', marginBottom: '16px',
                                borderLeft: '3px solid #fca5a5',
                            }}>
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', marginBottom: '4px' }}>客服說明：</div>
                                <div style={{ color: '#fff', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                                    {ticket.supplement_note}
                                </div>
                            </div>
                        )}

                        {/* 編輯表單 */}
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {[
                                { key: 'customer_name', label: '姓名', type: 'text' },
                                { key: 'category', label: '報修類別', type: 'select', options: ['水管', '電路', '冒氣', '熱水器', '其他'] },
                                { key: 'address', label: '服務地址', type: 'text' },
                                { key: 'preferred_time_slot', label: '偏好時段', type: 'select', options: ['上午 (9-12)', '下午 (13-17)', '晚上 (18-21)', '皆可'] },
                            ].map(field => (
                                <div key={field.key}>
                                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                        {field.label}
                                    </label>
                                    {field.type === 'select' ? (
                                        <select
                                            value={editForm[field.key] || ''}
                                            onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                            style={inputStyle}
                                        >
                                            <option value="">請選擇</option>
                                            {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={editForm[field.key] || ''}
                                            onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                            style={inputStyle}
                                        />
                                    )}
                                </div>
                            ))}

                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                    問題描述
                                </label>
                                <textarea
                                    value={editForm.description_raw || ''}
                                    onChange={e => setEditForm({ ...editForm, description_raw: e.target.value })}
                                    rows={4}
                                    style={{ ...inputStyle, resize: 'vertical' }}
                                />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '14px' }}>
                                <input
                                    type="checkbox"
                                    checked={editForm.is_urgent || false}
                                    onChange={e => setEditForm({ ...editForm, is_urgent: e.target.checked })}
                                />
                                🔴 緊急件
                            </label>
                        </div>

                        <button
                            onClick={handleSupplement}
                            disabled={submitting}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '12px',
                                border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                color: '#fff', fontSize: '16px', fontWeight: '700',
                                marginTop: '16px', opacity: submitting ? 0.6 : 1,
                            }}
                        >
                            {submitting ? '⏳ 送出中...' : '📤 送出補件'}
                        </button>
                    </div>
                )}

                {/* 補件成功提示 */}
                {(submitted || ticket.status === 'info_submitted') && (
                    <div style={{
                        background: 'rgba(16,185,129,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(16,185,129,0.3)',
                        marginBottom: '16px', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                        <div style={{ color: '#34d399', fontSize: '16px', fontWeight: '700' }}>
                            補件已送出，等待客服審核
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px' }}>
                            客服確認後會安排師傅前往處理
                        </div>
                    </div>
                )}

                {/* 待補件說明（非補件狀態時也顯示） */}
                {ticket.supplement_note && ticket.status !== 'need_more_info' && (
                    <div style={{
                        background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                        padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px' }}>📝 客服備註</div>
                        <div style={{ color: '#fff', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                            {ticket.supplement_note}
                        </div>
                    </div>
                )}

                {/* ===== 報價確認區 ===== */}
                {ticket.quoted_amount && (
                    <div style={{
                        background: confirmed
                            ? 'rgba(16,185,129,0.1)'
                            : 'rgba(245,158,11,0.1)',
                        borderRadius: '14px',
                        padding: '20px',
                        border: `1px solid ${confirmed ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        marginBottom: '16px',
                    }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '10px' }}>
                            💰 師傅報價
                        </div>
                        <div style={{
                            fontSize: '32px', fontWeight: '800', color: '#fff',
                            textAlign: 'center', marginBottom: '8px',
                        }}>
                            ${Number(ticket.quoted_amount).toLocaleString()}
                        </div>

                        {confirmed || ticket.quote_confirmed_at ? (
                            <div style={{
                                padding: '12px', borderRadius: '10px', textAlign: 'center',
                                background: 'rgba(16,185,129,0.15)',
                            }}>
                                <span style={{ color: '#34d399', fontSize: '14px', fontWeight: '600' }}>
                                    ✅ 已確認報價
                                </span>
                                {ticket.quote_confirmed_at && (
                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>
                                        {new Date(ticket.quote_confirmed_at).toLocaleString('zh-TW')}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <p style={{
                                    color: 'rgba(255,255,255,0.5)', fontSize: '12px',
                                    textAlign: 'center', margin: '0 0 12px', lineHeight: '1.6',
                                }}>
                                    師傅已完成現場檢測並報價<br />
                                    請確認是否同意此報價，確認後師傅將開始施工
                                </p>
                                <button
                                    onClick={handleConfirmQuote}
                                    disabled={confirming}
                                    style={{
                                        width: '100%', padding: '14px', borderRadius: '12px',
                                        border: 'none', cursor: confirming ? 'not-allowed' : 'pointer',
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        color: '#fff', fontSize: '16px', fontWeight: '700',
                                        opacity: confirming ? 0.6 : 1,
                                    }}>
                                    {confirming ? '⏳ 處理中...' : '✅ 同意此報價'}
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* 實收金額（完工後顯示） */}
                {ticket.actual_amount && (
                    <div style={{
                        background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                        padding: '16px 20px', border: '1px solid rgba(255,255,255,0.08)',
                        marginBottom: '16px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>💵 實收金額</span>
                        <span style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>
                            ${Number(ticket.actual_amount).toLocaleString()}
                        </span>
                    </div>
                )}

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
