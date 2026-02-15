import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import TW from './twAddress'
import liff from '@line/liff'

const CATEGORIES = [
    { value: '水管', label: '🔧 水管/馬桶', icon: '🚿' },
    { value: '電路', label: '⚡ 電路/開關', icon: '💡' },
    { value: '冷氣', label: '❄️ 冷氣/空調', icon: '🌀' },
    { value: '熱水器', label: '🔥 熱水器', icon: '♨️' },
    { value: '其他', label: '🔩 其他設備', icon: '🛠️' },
]

const TIME_SLOTS = [
    '上午（09:00-12:00）',
    '下午（13:00-17:00）',
    '晚上（18:00-21:00）',
    '週末皆可',
    '盡快處理',
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
    const [description, setDescription] = useState('')
    const [photos, setPhotos] = useState([])     // File objects
    const [previews, setPreviews] = useState([])  // preview URLs

    // Step 2: 聯絡方式
    const [customerName, setCustomerName] = useState('')
    const [phone, setPhone] = useState('') // 只存後8碼
    const [city, setCity] = useState('')
    const [district, setDistrict] = useState('')
    const [addressDetail, setAddressDetail] = useState('')
    const [preferredTimeSlot, setPreferredTimeSlot] = useState('')

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

    // 照片處理
    const handlePhotos = (e) => {
        const files = Array.from(e.target.files).slice(0, 5) // 最多 5 張
        setPhotos(files)
        setPreviews(files.map(f => URL.createObjectURL(f)))
    }

    const removePhoto = (index) => {
        URL.revokeObjectURL(previews[index])
        setPhotos(prev => prev.filter((_, i) => i !== index))
        setPreviews(prev => prev.filter((_, i) => i !== index))
    }

    // 驗證
    const canGoStep2 = category && description.trim()
    const address = city && district ? `${city}${district}${addressDetail}` : ''
    const canGoStep3 = phone.trim().length === 8 && city && district && addressDetail.trim()

    // 送出
    const handleSubmit = async () => {
        setSubmitting(true)
        addDebug('===== SUBMIT START =====')
        addDebug(`API: ${API}`)
        addDebug(`photos: ${photos.length}, sizes: ${photos.map(f => `${(f.size / 1024).toFixed(0)}KB`).join(',') || 'none'}`)
        try {
            const formData = new FormData()
            formData.append('category', category)
            formData.append('title', `${category}報修 - ${address.substring(0, 20)}`)
            formData.append('description', description)
            formData.append('customer_name', customerName)
            formData.append('phone', `09${phone}`)
            formData.append('address', address)
            formData.append('preferred_time_slot', preferredTimeSlot)
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
                padding: '20px',
            }}>
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
                    <Link to="/track" style={{
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
            <h1>🔧 報修填單</h1>

            {/* 🔧 Debug panel - visible in LINE in-app browser */}
            {debugLogs.length > 0 && (
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
                {isLoggedIn && <Link to="/" className="btn btn-secondary">← 回到首頁</Link>}
                {!isLoggedIn && <Link to="/login" className="btn btn-secondary">🔒 客服登入</Link>}
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
                        onClick={() => setStep(2)}
                        disabled={!canGoStep2}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '14px', fontSize: '16px' }}
                    >
                        下一步：聯絡方式 →
                    </button>
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
                        <label>偏好時段</label>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {TIME_SLOTS.map(slot => (
                                <div
                                    key={slot}
                                    onClick={() => setPreferredTimeSlot(slot)}
                                    style={{
                                        padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
                                        fontSize: '13px', transition: 'all 0.2s',
                                        background: preferredTimeSlot === slot ? '#4f46e5' : '#f3f4f6',
                                        color: preferredTimeSlot === slot ? 'white' : '#374151',
                                        border: preferredTimeSlot === slot ? '1px solid #4f46e5' : '1px solid #e5e7eb',
                                    }}
                                >{slot}</div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button onClick={() => setStep(1)} className="btn btn-secondary">← 上一步</button>
                        <button
                            onClick={() => setStep(3)}
                            disabled={!canGoStep3}
                            className="btn btn-primary" style={{ flex: 1 }}
                        >
                            下一步：確認送出 →
                        </button>
                    </div>
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
                        {preferredTimeSlot && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: '8px' }}>
                                <span style={{ color: '#6b7280' }}>偏好時段</span>
                                <span>{preferredTimeSlot}</span>
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

                    {/* 指派師傅 */}
                    {workers.length > 0 && (
                        <div className="form-group">
                            <label>指派師傅 <span style={{ color: '#9ca3af', fontSize: '12px' }}>（不選 = 所有師傅可見）</span></label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {workers.map(w => (
                                    <label key={w.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '8px 16px', borderRadius: '20px', cursor: 'pointer',
                                        fontSize: '13px', transition: 'all 0.2s',
                                        background: assignedUserIds.includes(w.id) ? '#4f46e5' : '#f3f4f6',
                                        color: assignedUserIds.includes(w.id) ? 'white' : '#374151',
                                        border: assignedUserIds.includes(w.id) ? '1px solid #4f46e5' : '1px solid #e5e7eb',
                                    }}>
                                        <input type="checkbox" style={{ display: 'none' }}
                                            checked={assignedUserIds.includes(w.id)}
                                            onChange={() => {
                                                setAssignedUserIds(prev =>
                                                    prev.includes(w.id)
                                                        ? prev.filter(id => id !== w.id)
                                                        : [...prev, w.id]
                                                )
                                            }}
                                        />
                                        {assignedUserIds.includes(w.id) ? '✓ ' : ''}{w.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

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
            )}
        </div>
    )
}
