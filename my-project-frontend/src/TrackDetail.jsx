import { useState, useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import LiffCloseButton from './LiffCloseButton'

const statusMap = {
    new: { label: '新建立', color: '#f59e0b', icon: '📝' },
    pending: { label: '待處理', color: '#f59e0b', icon: '⏳' },
    need_more_info: { label: '待補件', color: '#ef4444', icon: '📢' },
    info_submitted: { label: '補件完成待審核', color: '#f97316', icon: '📥' },
    dispatched: { label: '已派工', color: '#3b82f6', icon: '🚗' },
    time_proposed: { label: '請選擇時段', color: '#8b5cf6', icon: '📅' },
    in_progress: { label: '處理中', color: '#8b5cf6', icon: '🔧' },
    done: { label: '已完工', color: '#10b981', icon: '✅' },
    completed: { label: '已結案', color: '#6b7280', icon: '📁' },
    closed: { label: '已關閉', color: '#6b7280', icon: '🔒' },
    cancelled: { label: '已取消', color: '#ef4444', icon: '❌' },
}

// 進度步驟
const statusSteps = ['new', 'dispatched', 'in_progress', 'done', 'closed']

export default function TrackDetail() {
    const { id } = useParams()
    const location = useLocation()
    const { phone, ticketNo, line_user_id } = location.state || {}

    const [ticket, setTicket] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [confirming, setConfirming] = useState(false)
    const [confirmed, setConfirmed] = useState(false)
    // 補件編輯
    const [editForm, setEditForm] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    // 照片管理
    const [newPhotos, setNewPhotos] = useState([])
    const [deletePhotoIds, setDeletePhotoIds] = useState([])
    // 時段選擇
    const [selectedSlot, setSelectedSlot] = useState('')
    const [timeConfirmed, setTimeConfirmed] = useState(false)
    // 取消
    const [showCancel, setShowCancel] = useState(false)
    const [cancelReason, setCancelReason] = useState('')
    const [cancelling, setCancelling] = useState(false)

    useEffect(() => {
        if (!line_user_id && (!phone || !ticketNo)) {
            setError('缺少驗證資訊，請重新查詢')
            setLoading(false)
            return
        }
        fetchDetail()
    }, [id]) // eslint-disable-line

    const fetchDetail = async () => {
        try {
            const params = line_user_id
                ? new URLSearchParams({ line_user_id })
                : new URLSearchParams({ phone, ticket_no: ticketNo })
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
                    body: JSON.stringify({ line_user_id, phone, ticket_no: ticketNo }),
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

    // 補件提交（FormData — 支援檔案上傳）
    const handleSupplement = async () => {
        setSubmitting(true)
        try {
            const formData = new FormData()
            if (line_user_id) formData.append('line_user_id', line_user_id)
            if (phone) formData.append('phone', phone)
            if (ticketNo) formData.append('ticket_no', ticketNo)
            Object.entries(editForm).forEach(([key, val]) => {
                formData.append(key, typeof val === 'boolean' ? (val ? '1' : '0') : val)
            })
            // 要刪除的舊照片
            if (deletePhotoIds.length > 0) {
                formData.append('delete_attachment_ids', JSON.stringify(deletePhotoIds))
            }
            // 新上傳的照片
            newPhotos.forEach(f => formData.append('attachments[]', f))

            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/tickets/track/${id}/supplement`,
                { method: 'POST', body: formData }
            )
            const data = await res.json()
            if (res.ok) {
                setSubmitted(true)
                setNewPhotos([])
                setDeletePhotoIds([])
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
            <LiffCloseButton />
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
                                { key: 'category', label: '報修類別', type: 'select', options: ['水管', '電路', '冷氣', '熱水器', '其他'] },
                                { key: 'address', label: '服務地址', type: 'text' },
                                { key: 'preferred_time_slot', label: '偏好時段', type: 'select', options: ['上午（09:00-12:00）', '下午（13:00-17:00）', '晚上（18:00-21:00）', '週末皆可'] },
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



                            {/* ===== 照片管理 ===== */}
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                                    📷 報修照片
                                </label>
                                {/* 現有照片 */}
                                {ticket.attachments && ticket.attachments.filter(a => a.file_type !== 'completion').length > 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                                        {ticket.attachments.filter(a => a.file_type !== 'completion').map(att => (
                                            <div key={att.id} style={{ position: 'relative' }}>
                                                <img
                                                    src={att.file_url}
                                                    alt={att.original_name}
                                                    style={{
                                                        width: '100%', height: '80px', objectFit: 'cover',
                                                        borderRadius: '8px', cursor: 'pointer',
                                                        opacity: deletePhotoIds.includes(att.id) ? 0.3 : 1,
                                                        border: deletePhotoIds.includes(att.id) ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                                                    }}
                                                    onClick={() => window.open(att.file_url, '_blank')}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setDeletePhotoIds(prev =>
                                                        prev.includes(att.id)
                                                            ? prev.filter(x => x !== att.id)
                                                            : [...prev, att.id]
                                                    )}
                                                    style={{
                                                        position: 'absolute', top: '4px', right: '4px',
                                                        width: '22px', height: '22px', borderRadius: '50%',
                                                        border: 'none', cursor: 'pointer', fontSize: '12px',
                                                        background: deletePhotoIds.includes(att.id) ? '#10b981' : '#ef4444',
                                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}
                                                >
                                                    {deletePhotoIds.includes(att.id) ? '↩' : '✕'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {deletePhotoIds.length > 0 && (
                                    <div style={{ color: '#fca5a5', fontSize: '12px', marginBottom: '8px' }}>
                                        ⚠️ 已標記 {deletePhotoIds.length} 張照片待刪除
                                    </div>
                                )}
                                {/* 新增照片 */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={e => setNewPhotos(prev => [...prev, ...Array.from(e.target.files)])}
                                    style={{ display: 'none' }}
                                    id="supplement-photos"
                                />
                                <label htmlFor="supplement-photos" style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '8px', padding: '12px', borderRadius: '10px',
                                    border: '2px dashed rgba(255,255,255,0.2)', cursor: 'pointer',
                                    color: 'rgba(255,255,255,0.5)', fontSize: '14px',
                                    background: 'rgba(255,255,255,0.04)',
                                }}>
                                    📎 新增照片
                                </label>
                                {newPhotos.length > 0 && (
                                    <div style={{ marginTop: '8px' }}>
                                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px' }}>
                                            新增 {newPhotos.length} 張照片：
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                            {newPhotos.map((f, i) => (
                                                <div key={i} style={{ position: 'relative' }}>
                                                    <img
                                                        src={URL.createObjectURL(f)}
                                                        alt={f.name}
                                                        style={{
                                                            width: '100%', height: '80px', objectFit: 'cover',
                                                            borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)',
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewPhotos(prev => prev.filter((_, j) => j !== i))}
                                                        style={{
                                                            position: 'absolute', top: '4px', right: '4px',
                                                            width: '22px', height: '22px', borderRadius: '50%',
                                                            border: 'none', background: '#ef4444', color: '#fff',
                                                            cursor: 'pointer', fontSize: '12px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}
                                                    >✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
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

                {/* ===== 師傅提供時段選擇 ===== */}
                {ticket.status === 'time_proposed' && !timeConfirmed && (
                    <div style={{
                        background: 'rgba(139,92,246,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(139,92,246,0.3)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#a78bfa', marginBottom: '12px' }}>
                            📅 請選擇維修時段
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '14px' }}>
                            師傅已提供以下可用時段，請選擇您方便的時間
                        </div>
                        <div style={{ display: 'grid', gap: '8px', marginBottom: '16px' }}>
                            {(ticket.proposed_time_slots || []).map((slot, i) => (
                                <label key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '14px 16px', borderRadius: '10px', cursor: 'pointer',
                                    background: selectedSlot === `${slot.date} ${slot.time}` ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)',
                                    border: selectedSlot === `${slot.date} ${slot.time}` ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                                    transition: 'all 0.2s',
                                }}>
                                    <input
                                        type="radio"
                                        name="customerSlot"
                                        value={`${slot.date} ${slot.time}`}
                                        checked={selectedSlot === `${slot.date} ${slot.time}`}
                                        onChange={e => setSelectedSlot(e.target.value)}
                                    />
                                    <span style={{ color: '#fff', fontSize: '15px', fontWeight: '500' }}>{slot.date} {slot.time}</span>
                                </label>
                            ))}
                        </div>
                        <button
                            onClick={async () => {
                                if (!selectedSlot) return
                                setSubmitting(true)
                                try {
                                    const res = await fetch(
                                        `${import.meta.env.VITE_API_URL}/api/tickets/track/${id}/confirm-time`,
                                        {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ line_user_id, phone, ticket_no: ticketNo, selected_slot: selectedSlot }),
                                        }
                                    )
                                    const data = await res.json()
                                    if (res.ok) {
                                        setTimeConfirmed(true)
                                        fetchDetail()
                                    } else {
                                        alert(data.message || '確認失敗')
                                    }
                                } catch (e) {
                                    alert('網路錯誤')
                                } finally {
                                    setSubmitting(false)
                                }
                            }}
                            disabled={!selectedSlot || submitting}
                            style={{
                                width: '100%', padding: '14px', borderRadius: '12px',
                                border: 'none', cursor: !selectedSlot || submitting ? 'not-allowed' : 'pointer',
                                background: selectedSlot ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'rgba(255,255,255,0.1)',
                                color: '#fff', fontSize: '16px', fontWeight: '700',
                                opacity: !selectedSlot || submitting ? 0.5 : 1,
                            }}
                        >
                            {submitting ? '⏳ 確認中...' : '✅ 確認這個時段'}
                        </button>
                    </div>
                )}

                {/* 時段確認成功 */}
                {timeConfirmed && (
                    <div style={{
                        background: 'rgba(16,185,129,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(16,185,129,0.3)',
                        marginBottom: '16px', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
                        <div style={{ color: '#34d399', fontSize: '16px', fontWeight: '700' }}>
                            時段已確認！
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px' }}>
                            師傅將於您選擇的時段前往處理
                        </div>
                    </div>
                )}

                {/* 已確認時段顯示 */}
                {ticket.confirmed_time_slot && ticket.status !== 'time_proposed' && (
                    <div style={{
                        background: 'rgba(16,185,129,0.08)', borderRadius: '14px',
                        padding: '16px 20px', border: '1px solid rgba(16,185,129,0.2)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px' }}>✅ 確認維修時段</div>
                        <div style={{ color: '#34d399', fontSize: '16px', fontWeight: '600' }}>{ticket.confirmed_time_slot}</div>
                    </div>
                )}

                {/* 已取消顯示 */}
                {ticket.status === 'cancelled' && (
                    <div style={{
                        background: 'rgba(239,68,68,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(239,68,68,0.3)',
                        marginBottom: '16px', textAlign: 'center',
                    }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>❌</div>
                        <div style={{ color: '#fca5a5', fontSize: '16px', fontWeight: '700' }}>工單已取消</div>
                        {ticket.cancel_reason && (
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '8px' }}>
                                原因：{ticket.cancel_reason}
                            </div>
                        )}
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

                    {/* 報修照片 */}
                    {ticket.attachments && ticket.attachments.filter(a => a.file_type !== 'completion').length > 0 && (
                        <div style={{ paddingTop: '12px' }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>📷 報修照片</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {ticket.attachments.filter(a => a.file_type !== 'completion').map(att => (
                                    <img
                                        key={att.id}
                                        src={att.file_url}
                                        alt={att.original_name}
                                        style={{
                                            width: '100%', height: '80px', objectFit: 'cover',
                                            borderRadius: '8px', cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                        }}
                                        onClick={() => window.open(att.file_url, '_blank')}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 完工照片 */}
                    {ticket.attachments && ticket.attachments.filter(a => a.file_type === 'completion').length > 0 && (
                        <div style={{ paddingTop: '12px' }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '8px' }}>✅ 完工照片</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                {ticket.attachments.filter(a => a.file_type === 'completion').map(att => (
                                    <img
                                        key={att.id}
                                        src={att.file_url}
                                        alt={att.original_name}
                                        style={{
                                            width: '100%', height: '80px', objectFit: 'cover',
                                            borderRadius: '8px', cursor: 'pointer',
                                            border: '1px solid rgba(16,185,129,0.3)',
                                        }}
                                        onClick={() => window.open(att.file_url, '_blank')}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
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

                {/* 客戶取消工單 */}
                {!['done', 'closed', 'cancelled'].includes(ticket.status) && (
                    <div style={{ marginBottom: '16px' }}>
                        <button
                            onClick={() => setShowCancel(!showCancel)}
                            style={{
                                width: '100%', padding: '12px', borderRadius: '10px',
                                border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                                background: showCancel ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.06)',
                                color: '#fca5a5', fontSize: '14px', fontWeight: '600',
                            }}
                        >
                            ❌ 我要取消此工單
                        </button>
                        {showCancel && (
                            <div style={{
                                padding: '16px', background: 'rgba(239,68,68,0.08)',
                                borderRadius: '0 0 10px 10px', border: '1px solid rgba(239,68,68,0.2)',
                                borderTop: 'none',
                            }}>
                                <textarea
                                    value={cancelReason}
                                    onChange={e => setCancelReason(e.target.value)}
                                    placeholder="請輸入取消原因..."
                                    rows={2}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '8px',
                                        border: '1px solid rgba(239,68,68,0.3)', fontSize: '14px',
                                        resize: 'vertical', boxSizing: 'border-box',
                                        background: 'rgba(255,255,255,0.06)', color: '#fff',
                                    }}
                                />
                                <button
                                    onClick={async () => {
                                        if (!cancelReason) return
                                        setCancelling(true)
                                        try {
                                            const res = await fetch(
                                                `${import.meta.env.VITE_API_URL}/api/tickets/track/${id}/cancel`,
                                                {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ line_user_id, phone, ticket_no: ticketNo, cancel_reason: cancelReason }),
                                                }
                                            )
                                            const data = await res.json()
                                            if (res.ok) {
                                                setShowCancel(false)
                                                setCancelReason('')
                                                fetchDetail()
                                            } else {
                                                alert(data.message || '取消失敗')
                                            }
                                        } catch (e) {
                                            alert('網路錯誤')
                                        } finally {
                                            setCancelling(false)
                                        }
                                    }}
                                    disabled={!cancelReason || cancelling}
                                    style={{
                                        width: '100%', padding: '12px', borderRadius: '10px',
                                        border: 'none', marginTop: '10px',
                                        background: cancelReason ? '#ef4444' : 'rgba(255,255,255,0.1)',
                                        color: '#fff', fontSize: '14px', fontWeight: '700',
                                        cursor: !cancelReason || cancelling ? 'not-allowed' : 'pointer',
                                        opacity: !cancelReason || cancelling ? 0.5 : 1,
                                    }}
                                >
                                    {cancelling ? '⏳ 取消中...' : '確認取消工單'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

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
