import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import TW from './twAddress'
import liff from '@line/liff'
import LiffCloseButton from './LiffCloseButton'

const CATEGORIES = [
    { value: '水管', label: '🔧 水管/馬桶', icon: '🚿' },
    { value: '電路', label: '⚡ 電路/開關', icon: '💡' },
    { value: '冷氣', label: '❄️ 冷氣/空調', icon: '🌀' },
    { value: '熱水器', label: '🔥 熱水器', icon: '♨️' },
    { value: '其他', label: '🔩 其他設備', icon: '🛠️' },
]

const PERIOD_OPTIONS = [
    { value: 'morning', label: '上午 09:00-12:00' },
    { value: 'afternoon', label: '下午 13:00-17:00' },
    { value: 'evening', label: '晚上 18:00-21:00' },
]

export default function RepairForm() {
    const navigate = useNavigate()
    let auth = null
    try { auth = useAuth() } catch (e) { }
    const user = auth?.user
    const API = auth?.API || import.meta.env.VITE_API_URL || 'http://localhost:8080'
    console.log('[RepairForm] API base URL:', API)
    console.log('[RepairForm] VITE_API_URL:', import.meta.env.VITE_API_URL)
    console.log('[RepairForm] auth?.API:', auth?.API)
    console.log('[RepairForm] isLoggedIn:', !!user)
    const isLoggedIn = !!user

    const [step, setStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [workers, setWorkers] = useState([])
    const [successInfo, setSuccessInfo] = useState(null) // { ticketNo, phone }
    const [lineUserId, setLineUserId] = useState('')
    const [lineDisplayName, setLineDisplayName] = useState('')
    const [liffReady, setLiffReady] = useState(false)
    const [liffError, setLiffError] = useState('')
    const [debugLogs, setDebugLogs] = useState([])

    const addDebug = (msg) => {
        const ts = new Date().toLocaleTimeString('zh-TW')
        setDebugLogs(prev => [...prev, `[${ts}] ${msg}`])
        console.log('[DEBUG]', msg)
    }

    // LIFF 初始化（強制 LINE 登入 → 註冊客戶 → 自動帶入舊資料）
    useEffect(() => {
        const liffId = import.meta.env.VITE_LIFF_ID
        if (!liffId) {
            setLiffError('系統設定錯誤（LIFF ID 未設定），請聯繫管理員')
            setLiffReady(true)
            return
        }
        addDebug(`LIFF init start, liffId: ${liffId?.substring(0, 8)}...`)
        liff.init({ liffId })
            .then(async () => {
                addDebug(`LIFF init OK, isLoggedIn: ${liff.isLoggedIn()}`)
                if (!liff.isLoggedIn()) {
                    liff.login({ redirectUri: window.location.href })
                    return
                }
                try {
                    const profile = await liff.getProfile()
                    addDebug(`profile OK: ${profile.userId?.substring(0, 8)}...`)
                    setLineUserId(profile.userId)
                    setLineDisplayName(profile.displayName)

                    // 註冊到 line_customers + 取得過去資料
                    addDebug(`register => ${API}/api/line-customers/register`)
                    const regStart = Date.now()
                    const res = await fetch(`${API}/api/line-customers/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                        body: JSON.stringify({
                            line_user_id: profile.userId,
                            line_display_name: profile.displayName,
                            avatar_url: profile.pictureUrl || '',
                        }),
                    })
                    addDebug(`register done: ${res.status} (${Date.now() - regStart}ms)`)
                    const data = await res.json()
                    addDebug(`register data: ${data.customer?.customer_name || 'new'}`)
                    // 自動帶入過去報修資料（回頭客）
                    if (data.customer) {
                        if (data.customer.customer_name) setCustomerName(data.customer.customer_name)
                        if (data.customer.phone) {
                            const p = data.customer.phone.replace(/^09/, '')
                            setPhone(p)
                        }
                        if (data.customer.address) {
                            // 嘗試解析地址：前 3 字 = 縣市, 3~6 = 區
                            const addr = data.customer.address
                            for (const c of Object.keys(TW)) {
                                if (addr.startsWith(c)) {
                                    setCity(c)
                                    const rest = addr.slice(c.length)
                                    for (const d of (TW[c] || [])) {
                                        if (rest.startsWith(d)) {
                                            setDistrict(d)
                                            setAddressDetail(rest.slice(d.length))
                                            break
                                        }
                                    }
                                    break
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('[LIFF] 登入/註冊失敗:', err, err.stack)
                    addDebug(`LIFF ERROR: ${err.message}`)
                    setLiffError(`LINE 登入失敗: ${err.message}`)
                }
                setLiffReady(true)
            })
            .catch(err => {
                console.warn('LIFF 初始化失敗:', err)
                setLiffError('LINE 連線失敗，請透過 LINE 的選單重新開啟')
                setLiffReady(true)
            })
    }, [])

    // Step 1: 故障資訊
    const [category, setCategory] = useState('')
    const [customDevice, setCustomDevice] = useState('')
    const [description, setDescription] = useState('')
    const [photos, setPhotos] = useState([])     // File objects
    const [previews, setPreviews] = useState([])  // preview URLs

    // Step 2: 聯絡方式
    const [customerName, setCustomerName] = useState('')
    const [phone, setPhone] = useState('') // 只存後8碼
    const [city, setCity] = useState('')
    const [district, setDistrict] = useState('')
    const [addressDetail, setAddressDetail] = useState('')
    const [preferredTimeSlots, setPreferredTimeSlots] = useState([])
    // 日曆排程：客戶偏好時段（最多 3 天，每天可複選時段）
    const [calendarSlots, setCalendarSlots] = useState([{ date: '', periods: [] }])

    // 計算今天和兩週後的日期（用本地時區，避免 UTC 偏差）
    const today = new Date()
    const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const twoWeeksLater = new Date()
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
    const minDate = toLocalDateStr(today)
    const maxDate = toLocalDateStr(twoWeeksLater)

    // 當天可用時段過濾（早上只能約下午/晚上，下午只能約晚上，晚上不能約當天）
    const getCurrentPeriod = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'morning'
        if (hour < 17) return 'afternoon'
        return 'evening'
    }
    const getAvailablePeriods = (dateStr) => {
        const todayStr = toLocalDateStr(today)
        if (dateStr !== todayStr) return PERIOD_OPTIONS // 非當天，全部可選
        const currentPeriod = getCurrentPeriod()
        if (currentPeriod === 'morning') return PERIOD_OPTIONS.filter(p => p.value !== 'morning')
        if (currentPeriod === 'afternoon') return PERIOD_OPTIONS.filter(p => p.value === 'evening')
        return [] // 晚上無法當天預約
    }

    const addCalendarSlot = () => {
        if (calendarSlots.length < 3) {
            setCalendarSlots([...calendarSlots, { date: '', periods: [] }])
        }
    }
    const removeCalendarSlot = (index) => {
        if (calendarSlots.length > 1) {
            setCalendarSlots(calendarSlots.filter((_, i) => i !== index))
        }
    }
    const updateCalendarSlot = (index, field, value) => {
        const updated = [...calendarSlots]
        updated[index] = { ...updated[index], [field]: value }
        setCalendarSlots(updated)
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

    // Step 3: 補充
    const [notes, setNotes] = useState('')
    const [assignedUserIds, setAssignedUserIds] = useState([])

    useEffect(() => {
        if (isLoggedIn && user?.role === 'admin') {
            const token = localStorage.getItem('auth_token')
            fetch(`${API}/api/users/workers`, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
            })
                .then(res => res.json())
                .then(data => setWorkers(data))
                .catch(() => { })
        }
    }, []) // eslint-disable-line

    // 照片壓縮（手機拍的照片動輒 10MB+，壓縮到 ~300KB）
    const compressImage = (file, maxWidth = 1920, quality = 0.7) => {
        return new Promise((resolve) => {
            // 非圖片直接回傳
            if (!file.type.startsWith('image/')) { resolve(file); return }
            const reader = new FileReader()
            reader.onload = (e) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    let w = img.width, h = img.height
                    if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth }
                    canvas.width = w; canvas.height = h
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
                    canvas.toBlob((blob) => {
                        const compressed = new File([blob], file.name, { type: 'image/jpeg' })
                        addDebug(`壓縮: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`)
                        resolve(compressed)
                    }, 'image/jpeg', quality)
                }
                img.src = e.target.result
            }
            reader.readAsDataURL(file)
        })
    }

    // 照片處理（選擇後自動壓縮）
    const handlePhotos = async (e) => {
        const files = Array.from(e.target.files).slice(0, 5) // 最多 5 張
        addDebug(`選了 ${files.length} 張照片，開始壓縮...`)
        const compressed = await Promise.all(files.map(f => compressImage(f)))
        setPhotos(compressed)
        setPreviews(compressed.map(f => URL.createObjectURL(f)))
    }

    const removePhoto = (index) => {
        URL.revokeObjectURL(previews[index])
        setPhotos(prev => prev.filter((_, i) => i !== index))
        setPreviews(prev => prev.filter((_, i) => i !== index))
    }

    // 表單驗證
    const canGoStep2 = category && description.trim()
    const address = city && district ? `${city}${district}${addressDetail}` : ''
    const canGoStep3 = phone.trim().length === 8 && city && district && addressDetail.trim()

    // 欄位缺失提示
    const [showStep1Errors, setShowStep1Errors] = useState(false)
    const [showStep2Errors, setShowStep2Errors] = useState(false)
    const step1Errors = []
    if (!category) step1Errors.push('請選擇報修類別')
    if (!description.trim()) step1Errors.push('請填寫問題描述')
    const step2Errors = []
    if (phone.trim().length !== 8) step2Errors.push('請填寫完整手機號碼（8碼）')
    if (!city) step2Errors.push('請選擇縣市')
    if (!district) step2Errors.push('請選擇鄉鎮市區')
    if (!addressDetail.trim()) step2Errors.push('請填寫詳細地址')

    // 送出
    const handleSubmit = async () => {
        setSubmitting(true)
        addDebug('===== SUBMIT START =====')
        addDebug(`API: ${API}`)
        addDebug(`photos: ${photos.length}, sizes: ${photos.map(f => `${(f.size / 1024).toFixed(0)}KB`).join(',') || 'none'}`)
        try {
            const formData = new FormData()
            const finalCategory = category === '其他' && customDevice ? `其他（${customDevice}）` : category
            formData.append('category', finalCategory)
            formData.append('title', `${finalCategory}報修 - ${address.substring(0, 20)}`)
            formData.append('description', description)
            formData.append('customer_name', customerName)
            formData.append('phone', `09${phone}`)
            formData.append('address', address)
            formData.append('preferred_time_slot', preferredTimeSlots.join(', '))
            // 日曆偏好時段（展開為個別 {date, period}）
            const expandedSlots = calendarSlots
                .filter(s => s.date && s.periods?.length > 0)
                .flatMap(s => s.periods.map(p => ({ date: s.date, period: p })))
            if (expandedSlots.length > 0) {
                formData.append('customer_preferred_slots', JSON.stringify(expandedSlots))
            }
            if (notes) formData.append('notes_internal', notes)
            if (lineUserId) formData.append('customer_line_id', lineUserId)
            if (assignedUserIds.length > 0) {
                assignedUserIds.forEach(id => formData.append('assigned_user_ids[]', id))
            }
            photos.forEach(file => formData.append('attachments[]', file))

            const token = localStorage.getItem('auth_token')
            const endpoint = isLoggedIn ? `${API}/api/tickets` : `${API}/api/repair-tickets`
            const headers = { 'Accept': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`

            addDebug(`fetch => ${endpoint}`)
            const fetchStart = Date.now()

            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: formData,
            })
            addDebug(`response: ${res.status} (${Date.now() - fetchStart}ms)`)

            const text = await res.text()
            addDebug(`body length: ${text.length} chars`)

            let data
            try {
                data = JSON.parse(text)
            } catch (parseErr) {
                addDebug(`JSON parse FAILED: ${text.substring(0, 80)}`)
                throw new Error(`伺服器回傳非 JSON: ${text.substring(0, 100)}`)
            }

            if (!res.ok) throw new Error(data.message || '建立失敗')

            addDebug(`SUCCESS: ${data.ticket?.ticket_no}`)
            if (isLoggedIn) {
                alert(`✅ 報修單 ${data.ticket.ticket_no} 已建立！`)
                navigate('/')
            } else {
                setSuccessInfo({
                    ticketNo: data.ticket.ticket_no,
                    phone: `09${phone}`,
                })
            }
        } catch (err) {
            addDebug(`ERROR: [${err.constructor.name}] ${err.message}`)
            alert(`❌ ${err.message}`)
        }
        setSubmitting(false)
        addDebug('===== SUBMIT END =====')
    }

    const steps = ['故障資訊', '聯絡方式', '確認送出']

    // 成功畫面
    if (successInfo) {
        return (
            <div style={{
                minHeight: '100vh',
                background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px', position: 'relative',
            }}>
                <LiffCloseButton />
                <div style={{
                    maxWidth: '420px', width: '100%', textAlign: 'center',
                }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'rgba(16,185,129,0.2)', margin: '0 auto 20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '40px',
                    }}>✅</div>

                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 8px', fontWeight: '700' }}>
                        報修單已送出！
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '0 0 28px' }}>
                        我們會盡快與您聯繫安排維修
                    </p>

                    {/* 報修資訊卡 */}
                    <div style={{
                        background: 'rgba(255,255,255,0.08)', borderRadius: '16px',
                        padding: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '16px', textAlign: 'left',
                    }}>
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '4px' }}>
                                報修編號
                            </div>
                            <div style={{
                                color: '#60a5fa', fontSize: '22px', fontWeight: '800',
                                fontFamily: 'monospace', letterSpacing: '1px',
                            }}>
                                {successInfo.ticketNo}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginBottom: '4px' }}>
                                聯絡電話
                            </div>
                            <div style={{ color: '#fff', fontSize: '16px', fontWeight: '600' }}>
                                {successInfo.phone}
                            </div>
                        </div>
                    </div>

                    {/* 提示 */}
                    <div style={{
                        background: 'rgba(59,130,246,0.15)', borderRadius: '12px',
                        padding: '14px 18px', border: '1px solid rgba(59,130,246,0.2)',
                        marginBottom: '24px', textAlign: 'left',
                    }}>
                        <p style={{ color: '#93c5fd', fontSize: '13px', margin: 0, lineHeight: '1.6' }}>
                            💡 請記住以上編號與手機號碼，可隨時查詢維修進度
                        </p>
                    </div>

                    {/* Buttons */}
                    <Link to={`/track${lineUserId ? `?line_user_id=${encodeURIComponent(lineUserId)}` : ''}`} style={{
                        display: 'block', padding: '14px', borderRadius: '12px',
                        background: '#3b82f6', color: '#fff', fontSize: '15px',
                        fontWeight: '600', textDecoration: 'none', marginBottom: '10px',
                    }}>
                        📋 查詢維修進度
                    </Link>
                    <Link to="/home" style={{
                        display: 'block', padding: '14px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                        fontSize: '14px', textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        ← 返回首頁
                    </Link>
                </div>
            </div>
        )
    }

    // ─── LIFF 阻擋畫面 ───
    if (!liffReady) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
                <h2>正在連線 LINE...</h2>
                <p style={{ color: '#6b7280' }}>請稍候，正在進行 LINE 身份驗證</p>
            </div>
        )
    }

    if (liffError || !lineUserId) {
        return (
            <div className="container" style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <h2>需要透過 LINE 登入</h2>
                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                    {liffError || '請透過 LINE 的選單開啟報修頁面，以便我們通知您維修進度。'}
                </p>
                <button
                    className="btn btn-primary"
                    style={{ background: '#06c755', borderColor: '#06c755' }}
                    onClick={() => window.location.reload()}
                >🔄 重新嘗試</button>
            </div>
        )
    }

    return (
        <div className="container">
            <LiffCloseButton />
            <h1>🔧 報修填單</h1>

            {/* Debug panel - 只在 URL 帶 ?debug=1 時顯示 */}
            {debugLogs.length > 0 && new URLSearchParams(window.location.search).get('debug') === '1' && (
                <div style={{
                    background: '#1a1a2e', color: '#0f0', fontSize: '11px',
                    fontFamily: 'monospace', padding: '8px', borderRadius: '8px',
                    marginBottom: '12px', maxHeight: '150px', overflow: 'auto',
                    border: '1px solid #333', whiteSpace: 'pre-wrap',
                }}>
                    <div style={{ color: '#ff0', marginBottom: '4px' }}>🐛 Debug Log:</div>
                    {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            )}

            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                <Link to="/home" className="btn btn-secondary">← 回首頁</Link>
                {isLoggedIn && <Link to="/" className="btn btn-secondary">📋 工單列表</Link>}
            </div>

            {/* 步驟指示器 */}
            <div style={{
                display: 'flex', justifyContent: 'center', gap: '0', marginBottom: '24px',
            }}>
                {steps.map((label, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 'bold',
                            background: step > i + 1 ? '#10b981' : step === i + 1 ? '#4f46e5' : '#e5e7eb',
                            color: step >= i + 1 ? 'white' : '#9ca3af',
                            transition: 'all 0.3s',
                        }}>
                            {step > i + 1 ? '✓' : i + 1}
                        </div>
                        <span style={{
                            margin: '0 12px', fontSize: '13px',
                            color: step === i + 1 ? '#4f46e5' : '#9ca3af',
                            fontWeight: step === i + 1 ? 'bold' : 'normal',
                        }}>{label}</span>
                        {i < steps.length - 1 && (
                            <div style={{
                                width: '30px', height: '2px',
                                background: step > i + 1 ? '#10b981' : '#e5e7eb',
                                marginRight: '12px',
                            }} />
                        )}
                    </div>
                ))}
            </div>

            {/* ====== Step 1: 故障資訊 ====== */}
            {step === 1 && (
                <div className="detail-card">
                    <h3>🚨 故障資訊</h3>

                    {/* 報修分類 */}
                    <div className="form-group">
                        <label>報修類別 *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                            {CATEGORIES.map(cat => (
                                <div
                                    key={cat.value}
                                    onClick={() => setCategory(cat.value)}
                                    style={{
                                        padding: '14px', borderRadius: '10px', cursor: 'pointer',
                                        textAlign: 'center', transition: 'all 0.2s',
                                        border: category === cat.value ? '2px solid #4f46e5' : '2px solid #e5e7eb',
                                        background: category === cat.value ? '#eef2ff' : 'white',
                                    }}
                                >
                                    <div style={{ fontSize: '24px' }}>{cat.icon}</div>
                                    <div style={{ fontSize: '13px', marginTop: '4px', fontWeight: category === cat.value ? 'bold' : 'normal' }}>
                                        {cat.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 其他設備自訂輸入 */}
                    {category === '其他' && (
                        <div className="form-group">
                            <label>設備名稱 *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="請輸入設備名稱，例如：電視、洗衣機..."
                                value={customDevice}
                                onChange={e => setCustomDevice(e.target.value)}
                            />
                        </div>
                    )}

                    {/* 問題描述 */}
                    <div className="form-group">
                        <label>問題描述 *</label>
                        <textarea
                            rows="4" className="form-input"
                            placeholder="請描述故障情況，例如：冷氣不冷、水龍頭漏水..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>

                    {/* 照片上傳 */}
                    <div className="form-group">
                        <label>現場照片 <span style={{ color: '#9ca3af', fontSize: '12px' }}>（最多 5 張）</span></label>
                        <input
                            type="file" accept="image/*" multiple
                            onChange={handlePhotos}
                            style={{ fontSize: '14px' }}
                        />
                        {previews.length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                                {previews.map((url, i) => (
                                    <div key={i} style={{ position: 'relative' }}>
                                        <img src={url} alt={`照片${i + 1}`} style={{
                                            width: '100px', height: '100px', objectFit: 'cover',
                                            borderRadius: '8px', border: '1px solid #e5e7eb',
                                        }} />
                                        <button onClick={() => removePhoto(i)} style={{
                                            position: 'absolute', top: '-6px', right: '-6px',
                                            width: '22px', height: '22px', borderRadius: '50%',
                                            border: 'none', background: '#ef4444', color: 'white',
                                            cursor: 'pointer', fontSize: '12px', lineHeight: '22px',
                                            textAlign: 'center',
                                        }}>✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => {
                            if (!canGoStep2) { setShowStep1Errors(true); return }
                            setShowStep1Errors(false)
                            setStep(2)
                        }}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                    >
                        下一步：聯絡方式 →
                    </button>
                    {showStep1Errors && step1Errors.length > 0 && (
                        <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                            {step1Errors.map((e, i) => (
                                <div key={i} style={{ color: '#dc2626', fontSize: '13px', marginBottom: i < step1Errors.length - 1 ? '4px' : 0 }}>⚠️ {e}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ====== Step 2: 聯絡方式 ====== */}
            {step === 2 && (
                <div className="detail-card">
                    <h3>📞 聯絡與地點</h3>

                    <div className="form-group">
                        <label>客戶姓名</label>
                        <input type="text" className="form-input" placeholder="例：王大明"
                            value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label>聯絡電話 *</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                            <span style={{
                                padding: '10px 12px', background: '#e5e7eb', borderRadius: '8px 0 0 8px',
                                border: '1px solid #d1d5db', borderRight: 'none', fontWeight: '700',
                                fontSize: '15px', color: '#374151',
                            }}>09</span>
                            <input type="tel" className="form-input" placeholder="12345678"
                                maxLength={8}
                                style={{ borderRadius: '0 8px 8px 0', flex: 1 }}
                                value={phone} onChange={e => {
                                    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                                    setPhone(v)
                                }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>服務地址 *</label>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <select className="form-input" value={city}
                                onChange={e => { setCity(e.target.value); setDistrict('') }}
                                style={{ flex: 1 }}>
                                <option value="">縣市</option>
                                {Object.keys(TW).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select className="form-input" value={district}
                                onChange={e => setDistrict(e.target.value)}
                                disabled={!city}
                                style={{ flex: 1 }}>
                                <option value="">鄉鎮市區</option>
                                {city && TW[city]?.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <input type="text" className="form-input"
                            placeholder="路街巷弄號樓（例：XX路123號4樓）"
                            value={addressDetail}
                            onChange={e => setAddressDetail(e.target.value)} />
                        {city && district && addressDetail && (
                            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                                📍 {city}{district}{addressDetail}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label>📅 偏好維修時間（最多 3 天，每天可複選時段）</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {calendarSlots.map((slot, index) => {
                                const availPeriods = slot.date ? getAvailablePeriods(slot.date) : PERIOD_OPTIONS
                                return (
                                    <div key={index} style={{
                                        background: '#f9fafb', borderRadius: '10px', padding: '12px',
                                        border: '1px solid #e5e7eb',
                                    }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ color: '#6b7280', fontSize: '13px', minWidth: '36px' }}>偏好{index + 1}</span>
                                            <input
                                                type="date"
                                                value={slot.date}
                                                min={minDate}
                                                max={maxDate}
                                                onChange={e => {
                                                    updateCalendarSlot(index, 'date', e.target.value)
                                                    // 清除當天不可用的時段
                                                    const newAvail = getAvailablePeriods(e.target.value).map(p => p.value)
                                                    const filtered = (slot.periods || []).filter(p => newAvail.includes(p))
                                                    const updated = [...calendarSlots]
                                                    updated[index] = { ...updated[index], date: e.target.value, periods: filtered }
                                                    setCalendarSlots(updated)
                                                }}
                                                style={{
                                                    flex: 1, padding: '8px 10px', borderRadius: '8px',
                                                    border: '1px solid #d1d5db', fontSize: '14px',
                                                    background: '#fff',
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
                                            <div style={{ display: 'flex', gap: '8px', paddingLeft: '44px' }}>
                                                {availPeriods.map(opt => (
                                                    <label key={opt.value} style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px',
                                                        padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                                                        fontSize: '13px', fontWeight: '500',
                                                        background: (slot.periods || []).includes(opt.value) ? '#dbeafe' : '#fff',
                                                        border: `1px solid ${(slot.periods || []).includes(opt.value) ? '#3b82f6' : '#d1d5db'}`,
                                                        color: (slot.periods || []).includes(opt.value) ? '#1d4ed8' : '#374151',
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
                                            <div style={{ paddingLeft: '44px', color: '#ef4444', fontSize: '12px' }}>
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
                                    marginTop: '8px', background: 'none', border: '1px dashed #9ca3af',
                                    borderRadius: '8px', padding: '8px 16px', color: '#6b7280',
                                    cursor: 'pointer', fontSize: '13px', width: '100%',
                                }}
                            >
                                + 新增偏好日期
                            </button>
                        )}
                        <p style={{ color: '#9ca3af', fontSize: '12px', margin: '6px 0 0' }}>
                            💡 可選今天～兩週內，每天可勾選多個時段
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button onClick={() => setStep(1)} className="btn btn-secondary">← 上一步</button>
                        <button
                            onClick={() => {
                                if (!canGoStep3) { setShowStep2Errors(true); return }
                                setShowStep2Errors(false)
                                setStep(3)
                            }}
                            className="btn btn-primary" style={{ flex: 1 }}
                        >
                            下一步：確認送出 →
                        </button>
                    </div>
                    {showStep2Errors && step2Errors.length > 0 && (
                        <div style={{ marginTop: '10px', padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                            {step2Errors.map((e, i) => (
                                <div key={i} style={{ color: '#dc2626', fontSize: '13px', marginBottom: i < step2Errors.length - 1 ? '4px' : 0 }}>⚠️ {e}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ====== Step 3: 確認送出 ====== */}
            {step === 3 && (
                <div className="detail-card">
                    <h3>📋 確認報修資訊</h3>

                    {/* 摘要 */}
                    <div style={{
                        display: 'grid', gap: '10px', marginBottom: '20px',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280' }}>報修類別</span>
                            <span style={{ fontWeight: 'bold' }}>{CATEGORIES.find(c => c.value === category)?.label}</span>
                        </div>
                        <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                            <div style={{ color: '#6b7280', marginBottom: '4px' }}>問題描述</div>
                            <div>{description}</div>
                        </div>
                        {customerName && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                                <span style={{ color: '#6b7280' }}>客戶姓名</span>
                                <span>{customerName}</span>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                            <span style={{ color: '#6b7280' }}>聯絡電話</span>
                            <span>09{phone}</span>
                        </div>
                        <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                            <div style={{ color: '#6b7280', marginBottom: '4px' }}>服務地址</div>
                            <div>{address}</div>
                        </div>
                        {calendarSlots.some(s => s.date && s.periods?.length > 0) && (
                            <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                                <div style={{ color: '#6b7280', marginBottom: '6px' }}>📅 偏好維修時間</div>
                                {calendarSlots.filter(s => s.date && s.periods?.length > 0).map((slot, i) => {
                                    const d = new Date(slot.date + 'T00:00:00')
                                    const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
                                    const periodLabels = slot.periods.map(p => PERIOD_OPTIONS.find(o => o.value === p)?.label || p).join('、')
                                    return (
                                        <div key={i} style={{ fontSize: '14px', marginBottom: '2px' }}>
                                            • {d.getMonth() + 1}/{d.getDate()}（{weekday}）{periodLabels}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {photos.length > 0 && (
                            <div style={{ padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                                <div style={{ color: '#6b7280', marginBottom: '6px' }}>照片 ({photos.length} 張)</div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {previews.map((url, i) => (
                                        <img key={i} src={url} alt="" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px' }} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>


                    {/* 備註 */}
                    <div className="form-group">
                        <label>內部備註 <span style={{ color: '#9ca3af', fontSize: '12px' }}>（門禁、停車、注意事項）</span></label>
                        <textarea rows="2" className="form-input"
                            placeholder="例：大樓需管理室登記、B1 停車場可停..."
                            value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>



                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                        <button onClick={() => setStep(2)} className="btn btn-secondary">← 上一步</button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '14px', fontSize: '16px' }}
                        >
                            {submitting ? '⏳ 送出中...' : '✅ 確認送出報修單'}
                        </button>
                    </div>
                </div>
            )
            }
        </div >
    )
}
