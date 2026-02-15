import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

const STATUS_MAP = {
    new: { label: '新案件', color: '#3b82f6' },
    need_more_info: { label: '待補件', color: '#f59e0b' },
    info_submitted: { label: '補件完成待審核', color: '#f97316' },
    dispatched: { label: '已派工', color: '#06b6d4' },
    time_proposed: { label: '師傅已提供時段', color: '#8b5cf6' },
    in_progress: { label: '處理中', color: '#f97316' },
    done: { label: '完工', color: '#10b981' },
    closed: { label: '結案', color: '#9ca3af' },
    cancelled: { label: '已取消', color: '#ef4444' },
    // 舊狀態相容
    pending: { label: '待處理', color: '#f59e0b' },
    processing: { label: '處理中', color: '#3b82f6' },
    completed: { label: '已完成', color: '#10b981' },
}

const STATUS_TRANSITIONS = {
    new: ['need_more_info', 'dispatched', 'cancelled'],
    need_more_info: ['new', 'dispatched', 'cancelled'],
    info_submitted: ['need_more_info', 'dispatched', 'cancelled'],
    dispatched: ['time_proposed', 'cancelled'],
    time_proposed: ['in_progress', 'dispatched', 'cancelled'],
    in_progress: ['done', 'cancelled'],
    done: ['closed'],
    closed: [],
    cancelled: [],
}

export default function TicketDetail() {
    const { id } = useParams()
    const { user, authFetch, API } = useAuth()
    const [ticket, setTicket] = useState(null)
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState('')
    const [workers, setWorkers] = useState([])
    const [editingSummary, setEditingSummary] = useState(false)
    const [summaryText, setSummaryText] = useState('')
    const [notesText, setNotesText] = useState('')
    const [showDispatch, setShowDispatch] = useState(false)
    const [dispatchResult, setDispatchResult] = useState(null)
    const [saving, setSaving] = useState(false)
    const [completionPhotos, setCompletionPhotos] = useState([])
    // 派工選師傅
    const [selectedWorkers, setSelectedWorkers] = useState([])
    // 師傅報價
    const [quoteAmount, setQuoteAmount] = useState('')
    const [quoteDesc, setQuoteDesc] = useState('')
    // 完工說明
    const [completionNote, setCompletionNote] = useState('')
    const [actualAmount, setActualAmount] = useState('')
    // 狀態變更（dropdown 模式）
    const [selectedStatus, setSelectedStatus] = useState('')
    const [supplementNote, setSupplementNote] = useState('')
    const [cancelReason, setCancelReason] = useState('')
    const [confirmReason, setConfirmReason] = useState('')
    const [selectedSlot, setSelectedSlot] = useState('')

    const isAdmin = user?.role === 'admin'
    const isRepairTicket = ticket?.category != null

    const fetchTicket = async () => {
        try {
            const res = await authFetch(`${API}/api/tickets/${id}`)
            const data = await res.json()
            setTicket(data)
            setSummaryText(data.description_summary || '')
            setNotesText(data.notes_internal || '')
        } catch (err) {
            console.error('載入失敗:', err)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchTicket()
        if (isAdmin) {
            authFetch(`${API}/api/users/workers`)
                .then(res => res.json())
                .then(data => setWorkers(data))
                .catch(() => { })
        }
    }, [id]) // eslint-disable-line

    // 更新狀態
    const updateStatus = async (newStatus, extra = {}) => {
        setSaving(true)
        try {
            const res = await authFetch(`${API}/api/tickets/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, ...extra }),
            })
            if (res.ok) {
                const msgs = {
                    need_more_info: '✅ 已退回給客戶補件，LINE 通知已送出',
                    cancelled: '✅ 工單已取消',
                    dispatched: '✅ 已派工',
                    in_progress: '✅ 狀態已更新為施工中',
                    done: '✅ 已標記為完工',
                    closed: '✅ 工單已結案',
                }
                alert(msgs[newStatus] || `✅ 狀態已更新為「${newStatus}」`)
            } else {
                const data = await res.json().catch(() => ({}))
                alert(`❌ 更新失敗：${data.message || '未知錯誤'}`)
            }
            fetchTicket()
        } catch (err) {
            alert(`❌ 連線錯誤：${err.message}`)
        }
        setSaving(false)
    }

    // 儲存摘要 & 備註
    const saveSummaryNotes = async () => {
        setSaving(true)
        await authFetch(`${API}/api/tickets/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                description_summary: summaryText,
                notes_internal: notesText,
            }),
        })
        setEditingSummary(false)
        fetchTicket()
        setSaving(false)
    }

    // 排程
    const [scheduleDate, setScheduleDate] = useState('')
    const saveSchedule = async () => {
        setSaving(true)
        await authFetch(`${API}/api/tickets/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduled_at: scheduleDate, status: 'scheduled' }),
        })
        fetchTicket()
        setSaving(false)
    }

    // 派工（含選師傅）
    const handleDispatch = async () => {
        setSaving(true)
        try {
            const body = {}
            if (selectedWorkers.length > 0) {
                body.technician_ids = selectedWorkers
            }
            const res = await authFetch(`${API}/api/tickets/${id}/dispatch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            setDispatchResult(data.dispatch)
            fetchTicket()
        } catch (err) {
            alert('派工失敗')
        }
        setSaving(false)
    }

    // 留言
    const submitComment = async (e) => {
        e.preventDefault()
        if (!newComment.trim()) return
        await authFetch(`${API}/api/tickets/${id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newComment }),
        })
        setNewComment('')
        fetchTicket()
    }

    // 師傅接案
    const handleAccept = async () => {
        if (!confirm('確定要接案嗎？')) return
        setSaving(true)
        try {
            await authFetch(`${API}/api/tickets/${id}/accept`, { method: 'POST' })
            fetchTicket()
        } catch (err) {
            alert('接案失敗')
        }
        setSaving(false)
    }

    // 師傅報價
    const handleSubmitQuote = async () => {
        if (!quoteAmount || Number(quoteAmount) < 0) return
        setSaving(true)
        try {
            await authFetch(`${API}/api/tickets/${id}/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quoted_amount: Number(quoteAmount),
                    description: quoteDesc || undefined,
                }),
            })
            setQuoteAmount('')
            setQuoteDesc('')
            fetchTicket()
        } catch (err) {
            alert('報價失敗')
        }
        setSaving(false)
    }

    // 客服代客確認報價
    const handleAdminConfirmQuote = async () => {
        const reason = prompt('請輸入代客確認原因（例如：客戶電話確認）')
        if (!reason || reason.trim().length < 2) return
        setSaving(true)
        try {
            const res = await authFetch(`${API}/api/tickets/${id}/admin-confirm-quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirm_reason: reason.trim() }),
            })
            const data = await res.json()
            if (res.ok) {
                alert('✅ 代客確認報價成功，LINE 通知已送出')
                fetchTicket()
            } else {
                alert(`❌ ${data.message || '操作失敗'}`)
            }
        } catch (err) {
            alert('❌ 網路錯誤')
        }
        setSaving(false)
    }

    // 師傅完工回報
    const handleCompletion = async () => {
        if (!confirm('確定要回報完工嗎？')) return
        setSaving(true)
        try {
            // 上傳完工照
            if (completionPhotos.length > 0) {
                const formData = new FormData()
                completionPhotos.forEach(f => formData.append('attachments[]', f))
                formData.append('type', 'completion')
                await authFetch(`${API}/api/tickets/${id}/attachments`, {
                    method: 'POST',
                    body: formData,
                })
            }
            // 更新狀態為完工（含說明+金額）
            await updateStatus('done', {
                completion_note: completionNote || undefined,
                actual_amount: actualAmount ? Number(actualAmount) : undefined,
            })
            setCompletionPhotos([])
            setCompletionNote('')
            setActualAmount('')
        } catch (err) {
            alert('回報失敗：' + err.message)
        }
        setSaving(false)
    }

    if (loading) return <div className="container"><p>⏳ 載入中...</p></div>
    if (!ticket) return <div className="container"><p>❌ 找不到工單</p></div>

    const st = STATUS_MAP[ticket.status] || STATUS_MAP.pending
    const allowedNext = STATUS_TRANSITIONS[ticket.status] || []

    return (
        <div className="container">
            <Link to="/" className="btn btn-secondary" style={{ marginBottom: '16px' }}>← 回到列表</Link>

            {/* 標題區 */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '20px', flexWrap: 'wrap', gap: '10px',
            }}>
                <div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 'bold', color: '#4f46e5', fontSize: '18px' }}>{ticket.ticket_no}</span>
                        {ticket.category && (
                            <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '12px', background: '#eef2ff', color: '#4f46e5', fontWeight: 'bold' }}>
                                {ticket.category}
                            </span>
                        )}
                        {ticket.is_urgent && <span style={{ fontSize: '14px' }}>🔴 急件</span>}
                    </div>
                    <h2 style={{ margin: 0 }}>{ticket.title}</h2>
                </div>
                <span style={{
                    padding: '6px 16px', borderRadius: '16px', fontSize: '13px',
                    background: st.color + '18', color: st.color, fontWeight: 'bold',
                }}>{st.label}</span>
            </div>

            {/* ====== 報修工單：客服/管理員視圖 ====== */}
            {isRepairTicket && isAdmin && (
                <>
                    {/* 客戶資料 */}
                    <div className="detail-card">
                        <h3>👤 客戶資料</h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {ticket.customer_name && (
                                <div style={rowStyle}><span style={labelStyle}>姓名</span><span>{ticket.customer_name}</span></div>
                            )}
                            {ticket.phone && (
                                <div style={rowStyle}><span style={labelStyle}>電話</span><span>{ticket.phone}</span></div>
                            )}
                            {ticket.address && (
                                <div style={rowStyle}><span style={labelStyle}>地址</span><span>{ticket.address}</span></div>
                            )}
                            {ticket.preferred_time_slot && (
                                <div style={rowStyle}><span style={labelStyle}>偏好時段</span><span>{ticket.preferred_time_slot}</span></div>
                            )}
                            <div style={rowStyle}>
                                <span style={labelStyle}>處理優先權</span>
                                <span style={{ display: 'flex', gap: '6px' }}>
                                    {[
                                        { value: 'high', label: '🔴 高', bg: '#fef2f2', border: '#fca5a5', color: '#dc2626' },
                                        { value: 'medium', label: '🟡 中', bg: '#fffbeb', border: '#fcd34d', color: '#d97706' },
                                        { value: 'low', label: '🟢 低', bg: '#f0fdf4', border: '#86efac', color: '#16a34a' },
                                    ].map(p => (
                                        <button key={p.value}
                                            onClick={async () => {
                                                await authFetch(`${API}/api/tickets/${id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ priority: p.value }),
                                                })
                                                fetchTicket()
                                            }}
                                            style={{
                                                padding: '4px 12px', borderRadius: '12px', fontSize: '12px',
                                                fontWeight: ticket.priority === p.value ? 'bold' : 'normal',
                                                background: ticket.priority === p.value ? p.bg : '#f9fafb',
                                                border: `1.5px solid ${ticket.priority === p.value ? p.border : '#e5e7eb'}`,
                                                color: ticket.priority === p.value ? p.color : '#9ca3af',
                                                cursor: 'pointer', transition: 'all 0.2s',
                                            }}
                                        >{p.label}</button>
                                    ))}
                                </span>
                            </div>
                            {ticket.scheduled_at && (
                                <div style={rowStyle}><span style={labelStyle}>排程時間</span><span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{new Date(ticket.scheduled_at).toLocaleString('zh-TW')}</span></div>
                            )}
                        </div>
                    </div>

                    {/* 問題描述 */}
                    <div className="detail-card">
                        <h3>🔧 問題描述</h3>
                        {ticket.description_raw && (
                            <div style={{ padding: '12px 16px', background: '#f9fafb', borderRadius: '8px', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
                                {ticket.description_raw}
                            </div>
                        )}

                        {/* 現場照片 */}
                        {ticket.attachments && ticket.attachments.filter(a => a.file_type !== 'completion').length > 0 && (
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>📷 現場照片</div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {ticket.attachments.filter(a => a.file_type !== 'completion').map(att => (
                                        <img key={att.id} src={`${API}/storage/${att.file_path}`} alt={att.original_name}
                                            style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                                            onClick={() => window.open(`${API}/storage/${att.file_path}`, '_blank')} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 完工照片 */}
                        {ticket.attachments && ticket.attachments.filter(a => a.file_type === 'completion').length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', color: '#10b981' }}>✅ 完工照片</div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    {ticket.attachments.filter(a => a.file_type === 'completion').map(att => (
                                        <img key={att.id} src={`${API}/storage/${att.file_path}`} alt={att.original_name}
                                            style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '2px solid #10b981', cursor: 'pointer' }}
                                            onClick={() => window.open(`${API}/storage/${att.file_path}`, '_blank')} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 報價/金額資訊 */}
                    {(ticket.quoted_amount || ticket.actual_amount) && (
                        <div className="detail-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                            <h3>💰 費用資訊</h3>
                            <div style={{ display: 'grid', gap: '10px' }}>
                                {ticket.quoted_amount && (
                                    <div style={rowStyle}>
                                        <span style={labelStyle}>師傅報價</span>
                                        <span style={{ fontWeight: 'bold' }}>${ticket.quoted_amount}</span>
                                    </div>
                                )}
                                {ticket.quote_confirmed_at ? (
                                    <div style={rowStyle}>
                                        <span style={labelStyle}>客戶確認</span>
                                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>✅ {new Date(ticket.quote_confirmed_at).toLocaleString('zh-TW')}</span>
                                    </div>
                                ) : ticket.quoted_amount ? (
                                    <div style={rowStyle}>
                                        <span style={labelStyle}>客戶確認</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⏳ 等待確認</span>
                                            {(user?.role === 'admin') && (
                                                <button
                                                    onClick={handleAdminConfirmQuote}
                                                    disabled={saving}
                                                    style={{
                                                        padding: '4px 12px', borderRadius: '6px', fontSize: '12px',
                                                        background: '#10b981', color: 'white', border: 'none',
                                                        cursor: 'pointer', fontWeight: 'bold',
                                                    }}
                                                >代客確認</button>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                {ticket.actual_amount && (
                                    <div style={rowStyle}>
                                        <span style={labelStyle}>實收金額</span>
                                        <span style={{ fontWeight: 'bold' }}>${ticket.actual_amount}</span>
                                    </div>
                                )}
                                {ticket.quoted_amount && ticket.actual_amount && Number(ticket.actual_amount) > Number(ticket.quoted_amount) * 1.2 && (
                                    <div style={{ padding: '8px 14px', background: '#fef2f2', borderRadius: '8px', color: '#ef4444', fontSize: '13px', fontWeight: 'bold' }}>
                                        ⚠️ 實收金額超出報價 20% 以上
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 完工說明 */}
                    {ticket.completion_note && (
                        <div className="detail-card" style={{ borderLeft: '4px solid #10b981' }}>
                            <h4 style={{ margin: '0 0 4px 0' }}>📝 完工說明</h4>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.completion_note}</p>
                        </div>
                    )}

                    {/* 客服操作區 */}
                    <div className="detail-card">
                        <h3>📝 客服操作</h3>

                        {/* 摘要編輯 */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '14px' }}>外勤摘要</label>
                                {!editingSummary && (
                                    <button onClick={() => setEditingSummary(true)} className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 12px' }}>編輯</button>
                                )}
                            </div>
                            {editingSummary ? (
                                <>
                                    <textarea rows="3" className="form-input"
                                        placeholder="寫給師傅看的摘要，例如：冷氣不冷，昨晚開始，清過濾網無改善"
                                        value={summaryText} onChange={e => setSummaryText(e.target.value)} />
                                    <label style={{ fontWeight: 'bold', fontSize: '14px', marginTop: '10px', display: 'block' }}>內部備註</label>
                                    <textarea rows="2" className="form-input"
                                        placeholder="門禁、停車等注意事項（不會外發給師傅）"
                                        value={notesText} onChange={e => setNotesText(e.target.value)} />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <button onClick={saveSummaryNotes} className="btn btn-primary" disabled={saving} style={{ fontSize: '13px' }}>
                                            {saving ? '⏳ ...' : '💾 儲存'}
                                        </button>
                                        <button onClick={() => setEditingSummary(false)} className="btn btn-secondary" style={{ fontSize: '13px' }}>取消</button>
                                    </div>
                                </>
                            ) : (
                                <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', fontSize: '14px', minHeight: '40px' }}>
                                    {ticket.description_summary || <span style={{ color: '#9ca3af' }}>尚未填寫外勤摘要</span>}
                                </div>
                            )}
                        </div>

                        {/* ======= 客服操作區：依狀態顯示不同操作 ======= */}

                        {/* 已取消工單：顯示取消資訊 */}
                        {ticket.status === 'cancelled' && (
                            <div style={{ padding: '14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '16px' }}>
                                <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: '8px' }}>❌ 工單已取消</div>
                                <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                                    取消者：{ticket.cancelled_by_name} ({ticket.cancelled_by_role === 'admin' ? '客服' : ticket.cancelled_by_role === 'worker' ? '師傅' : '客戶'})<br />
                                    原因：{ticket.cancel_reason || '未提供'}<br />
                                    時間：{ticket.cancelled_at ? new Date(ticket.cancelled_at).toLocaleString('zh-TW') : '-'}
                                </div>
                            </div>
                        )}

                        {/* 新案件 / 補件完成待審核 → 客服兩分支操作 */}
                        {['new', 'info_submitted', 'need_more_info'].includes(ticket.status) && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '14px', display: 'block', marginBottom: '8px' }}>📋 客服操作</label>

                                {/* info_submitted 提醒 */}
                                {ticket.status === 'info_submitted' && (
                                    <div style={{ padding: '10px 14px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #fb923c', fontSize: '13px', color: '#9a3412', marginBottom: '10px' }}>
                                        📥 客戶已完成補件，請審核後決定下一步
                                    </div>
                                )}

                                {/* 分支一：需補件 */}
                                <div style={{ marginBottom: '10px' }}>
                                    <button
                                        onClick={() => setSelectedStatus(selectedStatus === 'need_more_info' ? '' : 'need_more_info')}
                                        className="btn"
                                        style={{
                                            width: '100%', padding: '12px', fontSize: '14px',
                                            background: selectedStatus === 'need_more_info' ? '#fbbf24' : '#fffbeb',
                                            color: selectedStatus === 'need_more_info' ? '#fff' : '#92400e',
                                            border: '1px solid #fbbf24', borderRadius: '8px',
                                        }}
                                    >
                                        📢 需要客戶補件
                                    </button>
                                    {selectedStatus === 'need_more_info' && (
                                        <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '0 0 8px 8px', border: '1px solid #fbbf24', borderTop: 'none' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#92400e', display: 'block', marginBottom: '6px' }}>
                                                📝 告知客戶需要補什麼（會透過 LINE 通知）
                                            </label>
                                            <textarea
                                                value={supplementNote}
                                                onChange={e => setSupplementNote(e.target.value)}
                                                placeholder="例如：請補上漏水處的照片，以及確認地址樓層..."
                                                rows={3}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #fbbf24', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                                            />
                                            <button
                                                onClick={() => { updateStatus('need_more_info', { supplement_note: supplementNote }); setSelectedStatus(''); setSupplementNote('') }}
                                                disabled={saving}
                                                className="btn btn-primary"
                                                style={{ marginTop: '8px', width: '100%', padding: '10px' }}
                                            >
                                                📨 通知客戶補件
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* 分支二：直接派工 */}
                                <button onClick={() => setShowDispatch(true)} className="btn btn-primary"
                                    style={{ width: '100%', padding: '14px', fontSize: '16px', background: '#06b6d4' }}>
                                    🚀 直接派工
                                </button>

                                {/* 取消 */}
                                <div style={{ marginTop: '10px' }}>
                                    <button
                                        onClick={() => setSelectedStatus(selectedStatus === 'cancelled' ? '' : 'cancelled')}
                                        style={{ width: '100%', padding: '10px', fontSize: '13px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                        ❌ 取消工單
                                    </button>
                                    {selectedStatus === 'cancelled' && (
                                        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '0 0 8px 8px', border: '1px solid #fca5a5', borderTop: 'none' }}>
                                            <textarea
                                                value={cancelReason}
                                                onChange={e => setCancelReason(e.target.value)}
                                                placeholder="請輸入取消原因..."
                                                rows={2}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                                            />
                                            <button
                                                onClick={() => { updateStatus('cancelled', { cancel_reason: cancelReason }); setSelectedStatus(''); setCancelReason('') }}
                                                disabled={!cancelReason || saving}
                                                className="btn"
                                                style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px' }}
                                            >
                                                確認取消
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 已派工 → 等師傅提供時段 */}
                        {ticket.status === 'dispatched' && (
                            <div style={{ padding: '14px', background: '#ecfeff', borderRadius: '8px', border: '1px solid #06b6d4', marginBottom: '16px' }}>
                                <div style={{ fontWeight: 'bold', color: '#0e7490', marginBottom: '4px' }}>🚗 已派工</div>
                                <div style={{ fontSize: '13px', color: '#155e75' }}>等待師傅提供可用時段。</div>
                            </div>
                        )}

                        {/* 師傅已提供時段 → 客服可代客確認或等客戶確認 */}
                        {ticket.status === 'time_proposed' && (
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ fontWeight: 'bold', fontSize: '14px', display: 'block', marginBottom: '8px' }}>📅 師傅已提供時段</label>

                                {/* 時段列表 */}
                                <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
                                    {(ticket.proposed_time_slots || []).map((slot, i) => (
                                        <label key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
                                            background: selectedSlot === `${slot.date} ${slot.time}` ? '#ede9fe' : '#f8fafc',
                                            border: selectedSlot === `${slot.date} ${slot.time}` ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
                                        }}>
                                            <input
                                                type="radio"
                                                name="timeSlot"
                                                value={`${slot.date} ${slot.time}`}
                                                checked={selectedSlot === `${slot.date} ${slot.time}`}
                                                onChange={e => setSelectedSlot(e.target.value)}
                                            />
                                            <span style={{ fontSize: '14px' }}>{slot.date} {slot.time}</span>
                                        </label>
                                    ))}
                                </div>

                                {/* 代客確認 */}
                                {selectedSlot && (
                                    <div style={{ padding: '12px', background: '#fefce8', borderRadius: '8px', border: '1px solid #facc15', marginBottom: '10px' }}>
                                        <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#854d0e', display: 'block', marginBottom: '6px' }}>
                                            📝 代客選擇原因
                                        </label>
                                        <textarea
                                            value={confirmReason}
                                            onChange={e => setConfirmReason(e.target.value)}
                                            placeholder={`由於客戶不方便選取時間，因此於 ${new Date().toLocaleString('zh-TW')} 代客選取`}
                                            rows={2}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #facc15', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            onClick={async () => {
                                                setSaving(true)
                                                try {
                                                    await authFetch(`${API}/api/tickets/${ticket.id}/confirm-time`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            selected_slot: selectedSlot,
                                                            confirm_reason: confirmReason || `由於客戶不方便選取時間，因此於 ${new Date().toLocaleString('zh-TW')} 代客選取`,
                                                        }),
                                                    })
                                                    fetchTicket()
                                                    setSelectedSlot('')
                                                    setConfirmReason('')
                                                } catch (err) {
                                                    alert(err.message)
                                                } finally {
                                                    setSaving(false)
                                                }
                                            }}
                                            disabled={saving}
                                            className="btn btn-primary"
                                            style={{ marginTop: '8px', width: '100%', padding: '10px' }}
                                        >
                                            ✅ 代客確認此時段
                                        </button>
                                    </div>
                                )}

                                <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                    💡 等待客戶自行確認，或由客服代客選擇
                                </div>
                            </div>
                        )}

                        {/* 處理中 → 可取消 */}
                        {ticket.status === 'in_progress' && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ padding: '14px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #fb923c', marginBottom: '10px' }}>
                                    <div style={{ fontWeight: 'bold', color: '#9a3412', marginBottom: '4px' }}>🔧 師傅處理中</div>
                                    {ticket.confirmed_time_slot && (
                                        <div style={{ fontSize: '13px', color: '#c2410c' }}>
                                            確認時段：{ticket.confirmed_time_slot}
                                            {ticket.confirmed_by && ticket.confirmed_by.startsWith('admin:') && (
                                                <span style={{ color: '#d97706', marginLeft: '6px' }}>（{ticket.confirmed_by}）</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setSelectedStatus(selectedStatus === 'cancelled' ? '' : 'cancelled')}
                                    style={{ width: '100%', padding: '10px', fontSize: '13px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    ❌ 取消工單
                                </button>
                                {selectedStatus === 'cancelled' && (
                                    <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '0 0 8px 8px', border: '1px solid #fca5a5', borderTop: 'none' }}>
                                        <textarea
                                            value={cancelReason}
                                            onChange={e => setCancelReason(e.target.value)}
                                            placeholder="請輸入取消原因..."
                                            rows={2}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                                        />
                                        <button
                                            onClick={() => { updateStatus('cancelled', { cancel_reason: cancelReason }); setSelectedStatus(''); setCancelReason('') }}
                                            disabled={!cancelReason || saving}
                                            className="btn"
                                            style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px' }}
                                        >
                                            確認取消
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 已結案 */}
                        {ticket.status === 'closed' && (
                            <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                                ✅ 此工單已結案
                            </div>
                        )}
                    </div>

                    {/* 派工預覽 Modal */}
                    {showDispatch && (
                        <div className="detail-card" style={{ border: '2px solid #06b6d4', background: '#f0fdfa' }}>
                            <h3>📤 外勤版派工預覽</h3>
                            {dispatchResult ? (
                                <>
                                    <pre style={{
                                        background: '#1e293b', color: '#e2e8f0', padding: '16px',
                                        borderRadius: '8px', whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.8',
                                    }}>{dispatchResult.message}</pre>
                                    <p style={{ textAlign: 'center', color: '#10b981', fontWeight: 'bold', marginTop: '12px' }}>
                                        ✅ 已派工完成！
                                    </p>
                                    <button onClick={() => { setShowDispatch(false); setDispatchResult(null) }}
                                        className="btn btn-secondary" style={{ width: '100%' }}>關閉</button>
                                </>
                            ) : (
                                <>
                                    {/* 選擇師傅 */}
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                                            👷 指派師傅
                                        </label>
                                        {workers.length > 0 ? (
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                                {workers.map(w => (
                                                    <label key={w.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '10px 14px', background: selectedWorkers.includes(w.id) ? '#e0f2fe' : 'white',
                                                        borderRadius: '8px', cursor: 'pointer',
                                                        border: `1px solid ${selectedWorkers.includes(w.id) ? '#06b6d4' : '#e5e7eb'}`,
                                                    }}>
                                                        <input type="checkbox"
                                                            checked={selectedWorkers.includes(w.id)}
                                                            onChange={e => {
                                                                if (e.target.checked) {
                                                                    setSelectedWorkers([...selectedWorkers, w.id])
                                                                } else {
                                                                    setSelectedWorkers(selectedWorkers.filter(id => id !== w.id))
                                                                }
                                                            }} />
                                                        <span style={{ fontWeight: '600' }}>{w.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <p style={{ color: '#9ca3af', fontSize: '13px' }}>尚無可用師傅</p>
                                        )}
                                        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                                            💡 不選師傅 = 所有師傅都能看到並自行接案
                                        </p>
                                    </div>

                                    <p style={{ color: '#374151', fontSize: '14px', marginBottom: '12px' }}>
                                        系統將自動套用「最小揭露規則」：
                                    </p>
                                    <ul style={{ fontSize: '13px', color: '#6b7280', paddingLeft: '20px', lineHeight: '2' }}>
                                        <li>姓名 → 遮罩為「X 先生/小姐」</li>
                                        <li>電話 → 完整提供（師傅需聯絡）</li>
                                        <li>地址 → 完整提供（師傅需到場）</li>
                                        <li>Email / 證件 → 不顯示</li>
                                        <li>內部備註 → 不外發</li>
                                    </ul>

                                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                                        <button onClick={() => setShowDispatch(false)} className="btn btn-secondary">取消</button>
                                        <button onClick={handleDispatch} disabled={saving}
                                            className="btn btn-primary" style={{ flex: 1, background: '#06b6d4' }}>
                                            {saving ? '⏳ 派工中...' : '✅ 確認派工'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* 內部備註 */}
                    {ticket.notes_internal && !editingSummary && (
                        <div className="detail-card" style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
                            <h4 style={{ margin: '0 0 4px 0' }}>⚠️ 內部備註（不外發）</h4>
                            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{ticket.notes_internal}</p>
                        </div>
                    )}

                    {/* 派工紀錄 */}
                    {ticket.dispatch_logs && ticket.dispatch_logs.length > 0 && (
                        <div className="detail-card">
                            <h3>📊 派工歷史</h3>
                            {ticket.dispatch_logs.map((log, i) => (
                                <div key={log.id} style={{
                                    padding: '10px 14px', background: '#f9fafb', borderRadius: '8px',
                                    marginBottom: '8px', fontSize: '13px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 'bold' }}>第 {i + 1} 次派工</span>
                                        <span style={{ color: '#9ca3af' }}>{new Date(log.dispatched_at).toLocaleString('zh-TW')}</span>
                                    </div>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#374151' }}>
                                        {log.payload_snapshot?.message}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ====== 報修工單：師傅視圖 ====== */}
            {isRepairTicket && !isAdmin && (
                <>
                    <div className="detail-card" style={{ borderLeft: '4px solid #06b6d4' }}>
                        <h3>📋 派工資訊</h3>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {ticket.customer_name && (
                                <div style={rowStyle}><span style={labelStyle}>客戶</span><span>{ticket.customer_name}</span></div>
                            )}
                            {ticket.phone && (
                                <div style={rowStyle}>
                                    <span style={labelStyle}>電話</span>
                                    <a href={`tel:${ticket.phone}`} style={{ color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none' }}>
                                        📞 {ticket.phone}
                                    </a>
                                </div>
                            )}
                            {ticket.address && (
                                <div style={rowStyle}>
                                    <span style={labelStyle}>地址</span>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.address)}`}
                                        target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#4f46e5', fontWeight: 'bold', textDecoration: 'none' }}>
                                        📍 {ticket.address}
                                    </a>
                                </div>
                            )}
                            {ticket.scheduled_at && (
                                <div style={rowStyle}><span style={labelStyle}>排程</span><span style={{ fontWeight: 'bold', color: '#4f46e5' }}>🕐 {new Date(ticket.scheduled_at).toLocaleString('zh-TW')}</span></div>
                            )}
                            {ticket.preferred_time_slot && (
                                <div style={rowStyle}><span style={labelStyle}>偏好時段</span><span>{ticket.preferred_time_slot}</span></div>
                            )}
                        </div>
                        {ticket.description_summary && (
                            <div style={{ marginTop: '12px', padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '13px' }}>問題摘要</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{ticket.description_summary}</div>
                            </div>
                        )}
                    </div>

                    {/* 師傅操作區 */}
                    <div className="detail-card">
                        <h3>📝 工作操作</h3>

                        {/* 目前狀態提示 */}
                        <div style={{
                            padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                            background: st.color + '15', border: `1px solid ${st.color}30`,
                            textAlign: 'center', fontSize: '15px',
                        }}>
                            目前狀態：<span style={{ fontWeight: 'bold', color: st.color }}>{st.label}</span>
                        </div>

                        <div style={{ display: 'grid', gap: '10px' }}>

                            {/* 已派工 → 接案 + 提供時段 */}
                            {ticket.status === 'dispatched' && !ticket.accepted_at && (
                                <button onClick={handleAccept} disabled={saving}
                                    className="btn btn-primary"
                                    style={{ padding: '16px', fontSize: '16px', background: '#06b6d4' }}>
                                    {saving ? '⏳ ...' : '📥 確認接案'}
                                </button>
                            )}

                            {/* 已接案（dispatched + accepted_at）→ 提供時段 */}
                            {ticket.status === 'dispatched' && ticket.accepted_at && (
                                <>
                                    <div style={{ padding: '14px', background: '#ecfeff', borderRadius: '8px', border: '1px solid #06b6d4', marginBottom: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#0e7490', marginBottom: '6px' }}>📅 提供可用時段</div>
                                        <div style={{ fontSize: '13px', color: '#155e75', marginBottom: '10px' }}>新增您方便的維修日期與時間，客戶會收到通知選擇。</div>

                                        {/* 動態時段輸入 */}
                                        {(Array.isArray(window._proposeSlots) ? window._proposeSlots : (window._proposeSlots = [{ date: '', time: '' }])).map((slot, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                                                <input type="date" className="form-input" style={{ flex: 1 }}
                                                    value={slot.date} onChange={e => { window._proposeSlots[i].date = e.target.value; setActualAmount(Date.now().toString()) }} />
                                                <input type="text" className="form-input" style={{ flex: 1 }}
                                                    placeholder="例：上午 / 14:00-16:00"
                                                    value={slot.time} onChange={e => { window._proposeSlots[i].time = e.target.value; setActualAmount(Date.now().toString()) }} />
                                                {window._proposeSlots.length > 1 && (
                                                    <button onClick={() => { window._proposeSlots.splice(i, 1); setActualAmount(Date.now().toString()) }}
                                                        style={{ padding: '6px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                                                )}
                                            </div>
                                        ))}
                                        <button onClick={() => { window._proposeSlots.push({ date: '', time: '' }); setActualAmount(Date.now().toString()) }}
                                            style={{ width: '100%', padding: '8px', fontSize: '13px', background: '#f0f9ff', color: '#0284c7', border: '1px dashed #7dd3fc', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}>
                                            + 新增時段
                                        </button>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            const slots = (window._proposeSlots || []).filter(s => s.date && s.time)
                                            if (slots.length === 0) { alert('請至少填寫一個時段'); return }
                                            setSaving(true)
                                            try {
                                                await authFetch(`${API}/api/tickets/${ticket.id}/propose-times`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ time_slots: slots }),
                                                })
                                                window._proposeSlots = [{ date: '', time: '' }]
                                                fetchTicket()
                                            } catch (err) {
                                                alert(err.message)
                                            } finally {
                                                setSaving(false)
                                            }
                                        }}
                                        disabled={saving}
                                        className="btn btn-primary"
                                        style={{ padding: '14px', fontSize: '16px', width: '100%' }}
                                    >
                                        {saving ? '⏳ 提交中...' : '📤 提交可用時段'}
                                    </button>

                                    {/* 取消接單 */}
                                    <button
                                        onClick={() => setSelectedStatus(selectedStatus === 'cancel_accept' ? '' : 'cancel_accept')}
                                        style={{ width: '100%', padding: '10px', fontSize: '13px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer', marginTop: '8px' }}
                                    >
                                        ⚠️ 取消接單
                                    </button>
                                    {selectedStatus === 'cancel_accept' && (
                                        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '0 0 8px 8px', border: '1px solid #fca5a5', borderTop: 'none' }}>
                                            <textarea
                                                value={cancelReason}
                                                onChange={e => setCancelReason(e.target.value)}
                                                placeholder="請輸入取消接單原因..."
                                                rows={2}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (!cancelReason) return
                                                    setSaving(true)
                                                    try {
                                                        await authFetch(`${API}/api/tickets/${ticket.id}/cancel-accept`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ cancel_reason: cancelReason }),
                                                        })
                                                        setCancelReason('')
                                                        setSelectedStatus('')
                                                        fetchTicket()
                                                    } catch (err) {
                                                        alert(err.message)
                                                    } finally {
                                                        setSaving(false)
                                                    }
                                                }}
                                                disabled={!cancelReason || saving}
                                                className="btn"
                                                style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px' }}
                                            >
                                                確認取消接單
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* 師傅已提供時段 → 等客戶確認 */}
                            {ticket.status === 'time_proposed' && (
                                <div>
                                    <div style={{ padding: '14px', background: '#ede9fe', borderRadius: '8px', border: '1px solid #a78bfa', marginBottom: '10px' }}>
                                        <div style={{ fontWeight: 'bold', color: '#6d28d9', marginBottom: '6px' }}>📅 等待客戶確認時段</div>
                                        <div style={{ fontSize: '13px', color: '#5b21b6' }}>
                                            {(ticket.proposed_time_slots || []).map((s, i) => (
                                                <div key={i}>• {s.date} {s.time}</div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* 取消接單 */}
                                    <button
                                        onClick={() => setSelectedStatus(selectedStatus === 'cancel_accept' ? '' : 'cancel_accept')}
                                        style={{ width: '100%', padding: '10px', fontSize: '13px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                        ⚠️ 取消接單
                                    </button>
                                    {selectedStatus === 'cancel_accept' && (
                                        <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '0 0 8px 8px', border: '1px solid #fca5a5', borderTop: 'none' }}>
                                            <textarea
                                                value={cancelReason}
                                                onChange={e => setCancelReason(e.target.value)}
                                                placeholder="請輸入取消接單原因..."
                                                rows={2}
                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (!cancelReason) return
                                                    setSaving(true)
                                                    try {
                                                        await authFetch(`${API}/api/tickets/${ticket.id}/cancel-accept`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ cancel_reason: cancelReason }),
                                                        })
                                                        setCancelReason('')
                                                        setSelectedStatus('')
                                                        fetchTicket()
                                                    } catch (err) {
                                                        alert(err.message)
                                                    } finally {
                                                        setSaving(false)
                                                    }
                                                }}
                                                disabled={!cancelReason || saving}
                                                className="btn"
                                                style={{ marginTop: '8px', width: '100%', padding: '10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px' }}
                                            >
                                                確認取消接單
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 處理中 → 報價 + 完工 */}
                            {ticket.status === 'in_progress' && (
                                <>
                                    {ticket.confirmed_time_slot && (
                                        <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '10px', fontSize: '13px' }}>
                                            ✅ 確認時段：{ticket.confirmed_time_slot}
                                        </div>
                                    )}

                                    {/* 報價區 */}
                                    <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '10px' }}>
                                        <label style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                                            💰 現場報價
                                            {ticket.quoted_amount && (
                                                <span style={{ fontSize: '12px', color: '#10b981', marginLeft: '8px' }}>
                                                    (已報價 ${ticket.quoted_amount}
                                                    {ticket.quote_confirmed_at ? ' ✅ 客戶已確認' : ' ⏳ 等待確認'})
                                                </span>
                                            )}
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>$</span>
                                            <input type="number" className="form-input" style={{ flex: 1 }}
                                                placeholder="維修金額" value={quoteAmount}
                                                onChange={e => setQuoteAmount(e.target.value)} />
                                            <button onClick={handleSubmitQuote} disabled={saving || !quoteAmount}
                                                className="btn btn-primary" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {saving ? '⏳' : '送出報價'}
                                            </button>
                                        </div>
                                        <input type="text" className="form-input" style={{ marginTop: '8px' }}
                                            placeholder="維修項目說明（選填）" value={quoteDesc}
                                            onChange={e => setQuoteDesc(e.target.value)} />
                                    </div>

                                    {/* 完工照片 */}
                                    <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '10px' }}>
                                        <label style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                                            📷 完工照片 <span style={{ color: '#9ca3af', fontSize: '12px' }}>（選填，可多張）</span>
                                        </label>
                                        <input type="file" accept="image/*" multiple
                                            onChange={e => setCompletionPhotos(Array.from(e.target.files).slice(0, 5))}
                                            style={{ fontSize: '14px' }} />
                                        {completionPhotos.length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                                {completionPhotos.map((f, i) => (
                                                    <div key={i} style={{ fontSize: '12px', padding: '4px 10px', background: '#e5e7eb', borderRadius: '6px' }}>
                                                        📎 {f.name.substring(0, 15)}...
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* 完工說明 */}
                                    <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '10px' }}>
                                        <label style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                                            📝 完工說明 <span style={{ color: '#9ca3af', fontSize: '12px' }}>（選填）</span>
                                        </label>
                                        <textarea rows="3" className="form-input"
                                            placeholder="維修內容、使用材料、注意事項等"
                                            value={completionNote} onChange={e => setCompletionNote(e.target.value)} />
                                    </div>

                                    {/* 實收金額 */}
                                    <div style={{ padding: '14px 16px', background: '#f9fafb', borderRadius: '10px' }}>
                                        <label style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px', display: 'block' }}>
                                            💵 實收金額 <span style={{ color: '#9ca3af', fontSize: '12px' }}>（選填）</span>
                                        </label>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>$</span>
                                            <input type="number" className="form-input" style={{ flex: 1 }}
                                                placeholder="實際收取金額" value={actualAmount}
                                                onChange={e => setActualAmount(e.target.value)} />
                                        </div>
                                    </div>

                                    {/* 完工回報按鈕 */}
                                    <button onClick={handleCompletion} disabled={saving}
                                        className="btn btn-primary"
                                        style={{ padding: '16px', fontSize: '16px', background: '#10b981' }}>
                                        {saving ? '⏳ 回報中...' : '✅ 完工回報'}
                                    </button>
                                </>
                            )}

                            {/* 已完工 */}
                            {ticket.status === 'done' && (
                                <div style={{
                                    padding: '20px', textAlign: 'center', borderRadius: '10px',
                                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                                }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                                    <div style={{ fontWeight: 'bold', color: '#10b981' }}>已回報完工</div>
                                    <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>等待客服確認結案</div>
                                </div>
                            )}

                            {/* 已結案 */}
                            {ticket.status === 'closed' && (
                                <div style={{
                                    padding: '20px', textAlign: 'center', borderRadius: '10px',
                                    background: '#f9fafb', border: '1px solid #e5e7eb',
                                }}>
                                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏁</div>
                                    <div style={{ fontWeight: 'bold', color: '#9ca3af' }}>此案件已結案</div>
                                </div>
                            )}

                            {/* 已取消 */}
                            {ticket.status === 'cancelled' && (
                                <div style={{ padding: '14px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                                    <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>❌ 工單已取消</div>
                                    <div style={{ fontSize: '13px', color: '#7f1d1d' }}>
                                        原因：{ticket.cancel_reason || '未提供'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* ====== 舊版遮罩工單視圖（非報修） ====== */}
            {!isRepairTicket && (
                <>
                    {isAdmin && ticket.original_text && (
                        <div className="detail-card">
                            <h3>🔍 原始內容 vs 遮罩</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <h4 style={{ color: '#ef4444' }}>原始</h4>
                                    <pre style={{ whiteSpace: 'pre-wrap', background: '#fef2f2', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                        {ticket.original_text}
                                    </pre>
                                </div>
                                <div>
                                    <h4 style={{ color: '#10b981' }}>遮罩後</h4>
                                    <pre style={{ whiteSpace: 'pre-wrap', background: '#f0fdf4', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                        {ticket.masked_text}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                    {!isAdmin && ticket.masked_text && (
                        <div className="detail-card">
                            <h3>📄 遮罩後內容</h3>
                            <pre style={{ whiteSpace: 'pre-wrap', background: '#f0fdf4', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                {ticket.masked_text}
                            </pre>
                        </div>
                    )}
                </>
            )}

            {/* 留言區 */}
            <div className="detail-card">
                <h3>💬 留言（{ticket.comments?.length || 0}）</h3>

                {ticket.comments?.map(comment => (
                    <div key={comment.id} style={{
                        padding: '10px 14px', background: '#f9fafb', borderRadius: '8px', marginBottom: '8px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 'bold', color: '#374151' }}>{comment.author}</span>
                            <span>{new Date(comment.created_at).toLocaleString('zh-TW')}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{comment.content}</div>
                    </div>
                ))}

                <form onSubmit={submitComment} style={{ marginTop: '12px' }}>
                    <textarea rows="2" className="form-input"
                        placeholder="輸入留言..."
                        value={newComment} onChange={e => setNewComment(e.target.value)} />
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}
                        disabled={!newComment.trim()}>
                        送出留言
                    </button>
                </form>
            </div>
        </div>
    )
}

// 路內樣式
const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: '#f9fafb', borderRadius: '8px' }
const labelStyle = { color: '#6b7280', fontWeight: '500' }
