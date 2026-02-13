import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import TW from './twAddress'

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
    const isLoggedIn = !!user

    const [step, setStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [workers, setWorkers] = useState([])

    // Step 1: 故障資訊
    const [category, setCategory] = useState('')
    const [description, setDescription] = useState('')
    const [photos, setPhotos] = useState([])     // File objects
    const [previews, setPreviews] = useState([])  // preview URLs

    // Step 2: 聯絡方式
    const [customerName, setCustomerName] = useState('')
    const [phone, setPhone] = useState('')
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
    const canGoStep3 = phone.trim() && city && district && addressDetail.trim()

    // 送出
    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('category', category)
            formData.append('title', `${category}報修 - ${address.substring(0, 20)}`)
            formData.append('description', description)
            formData.append('customer_name', customerName)
            formData.append('phone', phone)
            formData.append('address', address)
            formData.append('preferred_time_slot', preferredTimeSlot)
            if (notes) formData.append('notes_internal', notes)
            if (assignedUserIds.length > 0) {
                assignedUserIds.forEach(id => formData.append('assigned_user_ids[]', id))
            }
            photos.forEach(file => formData.append('attachments[]', file))

            const token = localStorage.getItem('auth_token')
            const endpoint = isLoggedIn ? `${API}/api/tickets` : `${API}/api/repair-tickets`
            const headers = { 'Accept': 'application/json' }
            if (token) headers['Authorization'] = `Bearer ${token}`
            const res = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: formData,
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.message || '建立失敗')
            alert(`✅ 報修單 ${data.ticket.ticket_no} 已建立！我們會盡快與您聯繫。`)
            if (isLoggedIn) {
                navigate('/')
            } else {
                // 公開用戶：重置表單
                setStep(1)
                setCategory('')
                setDescription('')
                setPhotos([])
                setPreviews([])
                setCustomerName('')
                setPhone('')
                setCity('')
                setDistrict('')
                setAddressDetail('')
                setPreferredTimeSlot('')
                setNotes('')
            }
        } catch (err) {
            alert(`❌ ${err.message}`)
        }
        setSubmitting(false)
    }

    const steps = ['故障資訊', '聯絡方式', '確認送出']

    return (
        <div className="container">
            <h1>🔧 報修填單</h1>

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
                        <input type="tel" className="form-input" placeholder="例：0912345678"
                            value={phone} onChange={e => setPhone(e.target.value)} />
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
                            <span>{phone}</span>
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
