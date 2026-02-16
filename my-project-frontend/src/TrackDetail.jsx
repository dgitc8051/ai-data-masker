import { useState, useEffect } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import LiffCloseButton from './LiffCloseButton'

const statusMap = {
    new: { label: '新建立', color: '#f59e0b', icon: '📝' },
    pending: { label: '待處理', color: '#f59e0b', icon: '⏳' },
    need_more_info: { label: '待補件', color: '#ef4444', icon: '📢' },
    info_submitted: { label: '補件完成待審核', color: '#f97316', icon: '📥' },
    dispatched: { label: '已派工', color: '#3b82f6', icon: '🚗' },
    time_proposed: { label: '請確認時段', color: '#8b5cf6', icon: '📅' },
    scheduled: { label: '已排定', color: '#059669', icon: '✅' },
    reschedule: { label: '改期中', color: '#f59e0b', icon: '🔄' },
    in_progress: { label: '處理中', color: '#8b5cf6', icon: '🔧' },
    done: { label: '已完工', color: '#10b981', icon: '✅' },
    completed: { label: '已結案', color: '#6b7280', icon: '📁' },
    closed: { label: '已關閉', color: '#6b7280', icon: '🔒' },
    cancelled: { label: '已取消', color: '#ef4444', icon: '❌' },
}

// 進度步驟
const statusSteps = ['new', 'dispatched', 'scheduled', 'in_progress', 'done', 'closed']

export default function TrackDetail() {
    const { id } = useParams()
    const location = useLocation()
    const API = import.meta.env.VITE_API_URL
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
    // 改期
    const [showReschedule, setShowReschedule] = useState(false)
    const [rescheduleReason, setRescheduleReason] = useState('')
    const [rescheduleSlots, setRescheduleSlots] = useState([{ date: '', period: 'morning' }])
    const [slotConfirmed, setSlotConfirmed] = useState(false)
    // 補件用日曆排程
    const [calendarSlots, setCalendarSlots] = useState([{ date: '', periods: [] }])

    // 日期範圍
    const today = new Date()
    const twoWeeksLater = new Date()
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
    const minDate = today.toISOString().split('T')[0]
    const maxDate = twoWeeksLater.toISOString().split('T')[0]

    const PERIOD_OPTIONS = [
        { value: 'morning', label: '上午 09-12' },
        { value: 'afternoon', label: '下午 13-17' },
        { value: 'evening', label: '晚上 18-21' },
    ]
    const getCurrentPeriod = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'morning'
        if (hour < 17) return 'afternoon'
        return 'evening'
    }
    const getAvailablePeriods = (dateStr) => {
        const todayStr = today.toISOString().split('T')[0]
        if (dateStr !== todayStr) return PERIOD_OPTIONS
        const cp = getCurrentPeriod()
        if (cp === 'morning') return PERIOD_OPTIONS.filter(p => p.value !== 'morning')
        if (cp === 'afternoon') return PERIOD_OPTIONS.filter(p => p.value === 'evening')
        return []
    }
    // 日曆排程 helpers
    const addCalendarSlot = () => {
        if (calendarSlots.length < 3) setCalendarSlots([...calendarSlots, { date: '', periods: [] }])
    }
    const removeCalendarSlot = (index) => {
        if (calendarSlots.length > 1) setCalendarSlots(calendarSlots.filter((_, i) => i !== index))
    }
    const togglePeriod = (index, periodValue) => {
        const updated = [...calendarSlots]
        const cur = updated[index].periods || []
        if (cur.includes(periodValue)) {
            updated[index] = { ...updated[index], periods: cur.filter(p => p !== periodValue) }
        } else {
            updated[index] = { ...updated[index], periods: [...cur, periodValue] }
        }
        setCalendarSlots(updated)
    }

    useEffect(() => {
        if (!line_user_id && (!phone || !ticketNo)) {
            setError('缺少驗證資訊，請重新查詢')
            setLoading(false)
            return
        }
        fetchDetail()
    }, [id]) // eslint-disable-line

    const fetchDetail = async () => {
        setError('')  // 清除舊錯誤
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
                    // 解析 preferred_time_slot → 陣列
                    const existingSlot = data.ticket.preferred_time_slot || ''
                    const slotsArray = existingSlot ? existingSlot.split(', ').filter(Boolean) : []
                    // 解析 category → 其他 + customDevice
                    let category = data.ticket.category || ''
                    let customDevice = ''
                    const match = category.match(/^其他[（(](.+?)[）)]$/)
                    if (match) {
                        customDevice = match[1]
                        category = '其他'
                    }
                    setEditForm({
                        customer_name: data.ticket.customer_name || '',
                        address: data.ticket.address || '',
                        description_raw: data.ticket.description || '',
                        category,
                        customDevice,
                        preferred_time_slots: slotsArray,
                    })
                    // 初始化日曆排程（從 customer_preferred_slots 還原）
                    if (data.ticket.customer_preferred_slots?.length > 0) {
                        // 按日期分組
                        const grouped = {}
                        data.ticket.customer_preferred_slots.forEach(s => {
                            if (!grouped[s.date]) grouped[s.date] = []
                            grouped[s.date].push(s.period)
                        })
                        setCalendarSlots(Object.entries(grouped).map(([date, periods]) => ({ date, periods })))
                    } else {
                        setCalendarSlots([{ date: '', periods: [] }])
                    }
                }
            } else {
                setError(data.message || '查詢失敗')
            }
        } catch (err) {
            // 只在沒有 ticket 資料時顯示網路錯誤（避免重新整理時覆蓋已載入的資料）
            setError(prev => prev || (ticket ? '' : '網路連線錯誤，請重試'))
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

            // 處理 category：其他時合併自訂名稱
            const formToSend = { ...editForm }
            if (formToSend.category === '其他' && formToSend.customDevice) {
                formToSend.category = `其他（${formToSend.customDevice}）`
            }
            delete formToSend.customDevice

            // 處理偏好時段複選（舊格式）
            if (Array.isArray(formToSend.preferred_time_slots)) {
                formToSend.preferred_time_slot = formToSend.preferred_time_slots.join(', ')
                delete formToSend.preferred_time_slots
            }

            // 日曆偏好時段（展開為個別 {date, period, label}）
            const expandedSlots = calendarSlots
                .filter(s => s.date && s.periods?.length > 0)
                .flatMap(s => s.periods.map(p => ({
                    date: s.date,
                    period: p,
                    label: `${s.date} ${PERIOD_OPTIONS.find(o => o.value === p)?.label || p}`,
                })))
            if (expandedSlots.length > 0) {
                formData.append('customer_preferred_slots', JSON.stringify(expandedSlots))
            }

            Object.entries(formToSend).forEach(([key, val]) => {
                if (val === undefined || val === null) return
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

            // 容錯：先讀 text 再 parse JSON
            const text = await res.text()
            let data
            try {
                data = JSON.parse(text)
            } catch {
                console.error('Supplement response not JSON:', text?.substring(0, 200))
                if (res.ok) {
                    // 即使回傳非 JSON，只要 HTTP 200 就算成功
                    setSubmitted(true)
                    setNewPhotos([])
                    setDeletePhotoIds([])
                    fetchDetail()
                    return
                }
                throw new Error('伺服器回傳格式錯誤')
            }

            if (res.ok) {
                setSubmitted(true)
                setNewPhotos([])
                setDeletePhotoIds([])
                fetchDetail()
            } else {
                alert(data.message || '補件失敗')
            }
        } catch (err) {
            console.error('Supplement error:', err)
            alert(`❌ ${err.message || '網路連線錯誤'}`)
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
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <Link to="/track" style={{
                        color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                        textDecoration: 'none',
                    }}>← 返回查詢</Link>
                    <Link to="/home" style={{
                        color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                        textDecoration: 'none',
                    }}>🏠 首頁</Link>
                </div>

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
                                { key: 'address', label: '服務地址', type: 'text' },
                            ].map(field => (
                                <div key={field.key}>
                                    <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                        {field.label}
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm[field.key] || ''}
                                        onChange={e => setEditForm({ ...editForm, [field.key]: e.target.value })}
                                        style={inputStyle}
                                    />
                                </div>
                            ))}

                            {/* 報修類別 + 其他自訂輸入 (inline) */}
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                                    報修類別
                                </label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        value={editForm.category === '其他' || (editForm.category && editForm.category.startsWith('其他')) ? '其他' : (editForm.category || '')}
                                        onChange={e => setEditForm({ ...editForm, category: e.target.value, customDevice: '' })}
                                        style={{ ...inputStyle, flex: editForm.category === '其他' || (editForm.category && editForm.category.startsWith('其他')) ? '0 0 auto' : '1', width: 'auto', minWidth: '100px' }}
                                    >
                                        <option value="">請選擇</option>
                                        {['水管', '電路', '冷氣', '熱水器', '其他'].map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    {(editForm.category === '其他' || (editForm.category && editForm.category.startsWith('其他'))) && (
                                        <input
                                            type="text"
                                            value={editForm.customDevice || ''}
                                            onChange={e => setEditForm({ ...editForm, customDevice: e.target.value, category: '其他' })}
                                            placeholder="請輸入設備名稱"
                                            style={{ ...inputStyle, flex: 1 }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* 偏好維修時間（日曆形式） */}
                            <div>
                                <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                                    📅 偏好維修時間（最多 3 天，每天可複選時段）
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {calendarSlots.map((slot, index) => {
                                        const availPeriods = slot.date ? getAvailablePeriods(slot.date) : PERIOD_OPTIONS
                                        return (
                                            <div key={index} style={{
                                                background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                            }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', minWidth: '36px' }}>偏好{index + 1}</span>
                                                    <input
                                                        type="date"
                                                        value={slot.date}
                                                        min={minDate}
                                                        max={maxDate}
                                                        onChange={e => {
                                                            const updated = [...calendarSlots]
                                                            const newAvail = getAvailablePeriods(e.target.value).map(p => p.value)
                                                            const filtered = (slot.periods || []).filter(p => newAvail.includes(p))
                                                            updated[index] = { ...updated[index], date: e.target.value, periods: filtered }
                                                            setCalendarSlots(updated)
                                                        }}
                                                        style={{
                                                            flex: 1, padding: '8px 10px', borderRadius: '8px',
                                                            border: '1px solid rgba(255,255,255,0.2)', fontSize: '14px',
                                                            background: 'rgba(255,255,255,0.08)', color: '#fff',
                                                            colorScheme: 'dark',
                                                        }}
                                                    />
                                                    {calendarSlots.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeCalendarSlot(index)}
                                                            style={{
                                                                background: 'none', border: 'none', color: '#ef4444',
                                                                cursor: 'pointer', fontSize: '18px', padding: '0 4px',
                                                            }}
                                                        >×</button>
                                                    )}
                                                </div>
                                                {slot.date && (
                                                    <div style={{ display: 'flex', gap: '8px', paddingLeft: '44px', flexWrap: 'wrap' }}>
                                                        {availPeriods.map(opt => (
                                                            <label key={opt.value} style={{
                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                                fontSize: '13px', fontWeight: '500',
                                                                background: (slot.periods || []).includes(opt.value) ? '#4f46e5' : 'rgba(255,255,255,0.08)',
                                                                border: `1px solid ${(slot.periods || []).includes(opt.value) ? '#4f46e5' : 'rgba(255,255,255,0.15)'}`,
                                                                color: (slot.periods || []).includes(opt.value) ? 'white' : 'rgba(255,255,255,0.7)',
                                                                transition: 'all 0.15s',
                                                            }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(slot.periods || []).includes(opt.value)}
                                                                    onChange={() => togglePeriod(index, opt.value)}
                                                                    style={{ display: 'none' }}
                                                                />
                                                                {(slot.periods || []).includes(opt.value) ? '✅' : '⬜'} {opt.label}
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                                {slot.date && availPeriods.length === 0 && (
                                                    <div style={{ paddingLeft: '44px', color: '#fca5a5', fontSize: '12px' }}>
                                                        ⚠️ 今天已無可選時段，請選擇其他日期
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {calendarSlots.length < 3 && (
                                    <button
                                        type="button"
                                        onClick={addCalendarSlot}
                                        style={{
                                            marginTop: '8px', background: 'none', border: '1px dashed rgba(255,255,255,0.2)',
                                            borderRadius: '8px', padding: '8px 16px', color: 'rgba(255,255,255,0.5)',
                                            cursor: 'pointer', fontSize: '13px', width: '100%',
                                        }}
                                    >
                                        + 新增其他日期
                                    </button>
                                )}
                            </div>

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
                                                    src={`${API}/api/attachments/${att.id}/image`}
                                                    alt={att.original_name}
                                                    style={{
                                                        width: '100%', height: '80px', objectFit: 'cover',
                                                        borderRadius: '8px', cursor: 'pointer',
                                                        opacity: deletePhotoIds.includes(att.id) ? 0.3 : 1,
                                                        border: deletePhotoIds.includes(att.id) ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                                                    }}
                                                    onClick={() => window.open(`${API}/api/attachments/${att.id}/image`, '_blank')}
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

                {/* ===== 師傅已接案 / 選時段，請客戶一次確認（時間＋費用）===== */}
                {ticket.status === 'time_proposed' && ticket.worker_selected_slot && !slotConfirmed && (
                    <div style={{
                        background: 'rgba(139,92,246,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(139,92,246,0.3)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#a78bfa', marginBottom: '12px' }}>
                            📋 請確認維修預約
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '14px' }}>
                            師傅已安排以下維修內容，請確認後即為您安排
                        </div>

                        {/* 時間卡片 */}
                        <div style={{
                            padding: '16px', borderRadius: '12px',
                            background: 'rgba(139,92,246,0.15)', border: '2px solid #8b5cf6',
                            textAlign: 'center', marginBottom: '12px',
                        }}>
                            <div style={{ fontSize: '24px', marginBottom: '6px' }}>📆</div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>維修時間</div>
                            <div style={{ color: '#fff', fontSize: '18px', fontWeight: '700' }}>
                                {ticket.worker_selected_slot.label}
                            </div>
                            {ticket.worker_selected_slot.selected_by_name && (
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '6px' }}>
                                    師傅：{ticket.worker_selected_slot.selected_by_name}
                                </div>
                            )}
                        </div>

                        {/* 費用卡片 */}
                        {ticket.quoted_amount && (
                            <div style={{
                                padding: '16px', borderRadius: '12px',
                                background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.4)',
                                textAlign: 'center', marginBottom: '12px',
                            }}>
                                <div style={{ fontSize: '24px', marginBottom: '6px' }}>💰</div>
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>預估費用</div>
                                <div style={{ color: '#fff', fontSize: '28px', fontWeight: '800' }}>
                                    ${Number(ticket.quoted_amount).toLocaleString()}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '6px' }}>
                                    ⚠️ 僅供參考，實際金額依現場狀況為準
                                </div>
                            </div>
                        )}

                        {/* 注意事項 */}
                        <div style={{
                            padding: '10px 14px', borderRadius: '8px',
                            background: 'rgba(255,255,255,0.05)', fontSize: '12px',
                            color: 'rgba(255,255,255,0.4)', lineHeight: '1.6', marginBottom: '14px',
                        }}>
                            ⚠️ 師傅到場後若不維修，須酌收基礎檢測費（車馬費）
                        </div>

                        {/* 確認 + 改期按鈕 */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={async () => {
                                    setSubmitting(true)
                                    try {
                                        const body = { line_user_id, phone, ticket_no: ticketNo }
                                        const res = await fetch(
                                            `${API}/api/tickets/track/${id}/customer-confirm-slot`,
                                            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
                                        )
                                        const data = await res.json()
                                        if (res.ok) {
                                            setSlotConfirmed(true)
                                            setConfirmed(true)
                                            fetchDetail()
                                        } else {
                                            alert(data.message || '確認失敗')
                                        }
                                    } catch { alert('網路錯誤') }
                                    finally { setSubmitting(false) }
                                }}
                                disabled={submitting}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '12px',
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#fff', fontSize: '16px', fontWeight: '700',
                                    opacity: submitting ? 0.5 : 1,
                                }}
                            >
                                {submitting ? '⏳ 確認中...' : '✅ 確認預約'}
                            </button>
                            {(ticket.reschedule_count ?? 0) < 3 ? (
                                <button
                                    onClick={() => setShowReschedule(true)}
                                    style={{
                                        padding: '14px 20px', borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        background: 'rgba(255,255,255,0.06)', color: '#fca5a5',
                                        fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                                    }}
                                >🔄 改期</button>
                            ) : (
                                <div style={{ padding: '14px', color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center' }}>
                                    ⚠️ 改期已達上限，請確認或聯繫客服
                                </div>
                            )}
                        </div>

                        {/* 取消預約 */}
                        <button
                            onClick={() => setShowCancel(true)}
                            style={{
                                width: '100%', padding: '10px', marginTop: '10px',
                                borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)',
                                background: 'rgba(239,68,68,0.08)', color: '#fca5a5',
                                fontSize: '13px', cursor: 'pointer',
                            }}
                        >
                            ❌ 取消維修
                        </button>
                    </div>
                )}

                {/* 時段確認成功 */}
                {slotConfirmed && (
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
                            師傅將於約定時間到場處理
                        </div>
                    </div>
                )}

                {/* 已排定時段顯示 */}
                {ticket.confirmed_time_slot && !['time_proposed'].includes(ticket.status) && (
                    <div style={{
                        background: 'rgba(16,185,129,0.08)', borderRadius: '14px',
                        padding: '16px 20px', border: '1px solid rgba(16,185,129,0.2)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px' }}>✅ 確認維修時段</div>
                        <div style={{ color: '#34d399', fontSize: '16px', fontWeight: '600' }}>📅 {ticket.confirmed_time_slot}</div>
                        {ticket.time_confirmed_at && (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '4px' }}>
                                確認時間：{new Date(ticket.time_confirmed_at).toLocaleString('zh-TW')}
                            </div>
                        )}
                        {/* 已排定，客戶可改期（上限 3 次） */}
                        {['scheduled'].includes(ticket.status) && !showReschedule && (ticket.reschedule_count ?? 0) < 3 && (
                            <button
                                onClick={() => setShowReschedule(true)}
                                style={{
                                    marginTop: '12px', padding: '8px 16px', borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'rgba(255,255,255,0.06)', color: '#fca5a5',
                                    fontSize: '13px', cursor: 'pointer',
                                }}
                            >🔄 申請改期 ({3 - (ticket.reschedule_count ?? 0)} 次可用)</button>
                        )}
                        {['scheduled'].includes(ticket.status) && (ticket.reschedule_count ?? 0) >= 3 && (
                            <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                                ⚠️ 已達改期上限（3次），如需調整請聯繫客服
                            </div>
                        )}
                    </div>
                )}

                {/* 改期中狀態 */}
                {ticket.status === 'reschedule' && (
                    <div style={{
                        background: 'rgba(245,158,11,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(245,158,11,0.3)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#fbbf24', marginBottom: '8px' }}>
                            🔄 改期處理中
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                            您的新偏好時段已送出，請等待師傅重新選擇時間。
                        </div>
                        {ticket.reschedule_count > 0 && (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '6px' }}>
                                已改期 {ticket.reschedule_count} 次
                            </div>
                        )}
                    </div>
                )}

                {/* ===== 改期表單 ===== */}
                {showReschedule && (
                    <div style={{
                        background: 'rgba(245,158,11,0.1)', borderRadius: '14px',
                        padding: '20px', border: '1px solid rgba(245,158,11,0.3)',
                        marginBottom: '16px',
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#fbbf24', marginBottom: '12px' }}>
                            🔄 申請改期
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '4px' }}>改期原因</label>
                            <input
                                type="text"
                                value={rescheduleReason}
                                onChange={e => setRescheduleReason(e.target.value)}
                                placeholder="例如：臨時有事無法到場"
                                style={{
                                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.15)', fontSize: '14px',
                                    background: 'rgba(255,255,255,0.08)', color: '#fff',
                                    boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', display: 'block', marginBottom: '6px' }}>新偏好時間（最多 3 個）</label>
                            {rescheduleSlots.map((slot, i) => (
                                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                    <input
                                        type="date" value={slot.date} min={minDate} max={maxDate}
                                        onChange={e => {
                                            const u = [...rescheduleSlots]; u[i] = { ...u[i], date: e.target.value };
                                            // 重置時段如果當天選擇不合法
                                            const avail = getAvailablePeriods(e.target.value)
                                            if (avail.length && !avail.find(p => p.value === u[i].period)) u[i].period = avail[0].value
                                            setRescheduleSlots(u)
                                        }}
                                        style={{
                                            flex: 1, padding: '8px', borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '13px',
                                        }}
                                    />
                                    <select
                                        value={slot.period}
                                        onChange={e => { const u = [...rescheduleSlots]; u[i] = { ...u[i], period: e.target.value }; setRescheduleSlots(u) }}
                                        style={{
                                            padding: '8px', borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '13px',
                                        }}
                                    >
                                        {(slot.date ? getAvailablePeriods(slot.date) : PERIOD_OPTIONS).map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                    {rescheduleSlots.length > 1 && (
                                        <button onClick={() => setRescheduleSlots(rescheduleSlots.filter((_, j) => j !== i))}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>×</button>
                                    )}
                                </div>
                            ))}
                            {rescheduleSlots.length < 3 && (
                                <button
                                    onClick={() => setRescheduleSlots([...rescheduleSlots, { date: '', period: 'morning' }])}
                                    style={{
                                        width: '100%', padding: '8px', borderRadius: '8px',
                                        border: '1px dashed rgba(255,255,255,0.2)',
                                        background: 'none', color: 'rgba(255,255,255,0.4)',
                                        fontSize: '13px', cursor: 'pointer',
                                    }}
                                >+ 新增偏好</button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={async () => {
                                    if (!rescheduleReason.trim()) { alert('請填寫改期原因'); return }
                                    const validSlots = rescheduleSlots.filter(s => s.date && s.period)
                                    if (!validSlots.length) { alert('請至少選擇一個新時段'); return }
                                    setSubmitting(true)
                                    try {
                                        const body = { line_user_id, phone, ticket_no: ticketNo, reason: rescheduleReason, new_preferred_slots: validSlots }
                                        const res = await fetch(
                                            `${API}/api/tickets/track/${id}/reschedule`,
                                            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
                                        )
                                        const data = await res.json()
                                        if (res.ok) {
                                            alert('✅ 改期申請已送出')
                                            setShowReschedule(false)
                                            setRescheduleReason('')
                                            setRescheduleSlots([{ date: '', period: 'morning' }])
                                            fetchDetail()
                                        } else {
                                            alert(data.message || '改期失敗')
                                        }
                                    } catch { alert('網路錯誤') }
                                    finally { setSubmitting(false) }
                                }}
                                disabled={submitting}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '12px',
                                    border: 'none', cursor: 'pointer',
                                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    color: '#fff', fontSize: '15px', fontWeight: '700',
                                    opacity: submitting ? 0.5 : 1,
                                }}
                            >
                                {submitting ? '⏳ 送出中...' : '🔄 送出改期申請'}
                            </button>
                            <button
                                onClick={() => setShowReschedule(false)}
                                style={{
                                    padding: '14px 20px', borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    background: 'none', color: 'rgba(255,255,255,0.5)',
                                    fontSize: '14px', cursor: 'pointer',
                                }}
                            >取消</button>
                        </div>
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

                {/* ===== 報價確認區（只在非 time_proposed 時獨立顯示，time_proposed 已合併到上方）===== */}
                {ticket.quoted_amount && ticket.status !== 'time_proposed' && (
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
                            💰 預估費用
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
                                    ✅ 已確認費用
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
                                    師傅已評估您的維修需求<br />
                                    確認後師傅將安排維修時間
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
                                    {confirming ? '⏳ 處理中...' : '✅ 確認，請安排維修'}
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
                                        src={`${API}/api/attachments/${att.id}/image`}
                                        alt={att.original_name}
                                        style={{
                                            width: '100%', height: '80px', objectFit: 'cover',
                                            borderRadius: '8px', cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                        }}
                                        onClick={() => window.open(`${API}/api/attachments/${att.id}/image`, '_blank')}
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
                                        src={`${API}/api/attachments/${att.id}/image`}
                                        alt={att.original_name}
                                        style={{
                                            width: '100%', height: '80px', objectFit: 'cover',
                                            borderRadius: '8px', cursor: 'pointer',
                                            border: '1px solid rgba(16,185,129,0.3)',
                                        }}
                                        onClick={() => window.open(`${API}/api/attachments/${att.id}/image`, '_blank')}
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
