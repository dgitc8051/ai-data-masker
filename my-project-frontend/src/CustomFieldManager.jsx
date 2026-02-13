import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ============ 自訂遮罩欄位管理 ============
function CustomFieldManager() {
    const [fields, setFields] = useState([])
    const [loading, setLoading] = useState(true)

    // 新增用的表單
    const [label, setLabel] = useState('')
    const [maskType, setMaskType] = useState('full')
    const [keepChars, setKeepChars] = useState(1)

    const API = import.meta.env.VITE_API_URL

    // ============ 載入 ============
    const loadFields = () => {
        fetch(`${API}/api/custom-fields`)
            .then(res => res.json())
            .then(data => {
                setFields(data)
                setLoading(false)
            })
    }

    useEffect(() => { loadFields() }, [])

    // ============ 新增 ============
    const handleAdd = async () => {
        if (!label.trim()) return alert('請輸入欄位名稱')

        await fetch(`${API}/api/custom-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, mask_type: maskType, keep_chars: keepChars }),
        })

        setLabel('')
        setMaskType('full')
        setKeepChars(1)
        loadFields()
    }

    // ============ 刪除 ============
    const handleDelete = async (id) => {
        if (!confirm('確定刪除？')) return
        await fetch(`${API}/api/custom-fields/${id}`, { method: 'DELETE' })
        loadFields()
    }

    // ============ 預覽遮罩效果 ============
    const previewMask = (text, type, keep) => {
        if (type === 'full') return '*'.repeat(text.length)
        return text.substring(0, keep) + '*'.repeat(Math.max(0, text.length - keep))
    }

    return (
        <div className="container">
            <h1>🏷️ 自訂遮罩欄位</h1>
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '-8px' }}>
                新增系統沒有的遮罩類型，例如：性別、公司名稱
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <Link to="/" className="btn btn-secondary">← 回到首頁</Link>
            </div>

            {/* ====== 系統預設欄位 ====== */}
            <div className="detail-card" style={{ marginBottom: '20px' }}>
                <h3>🔒 系統預設遮罩（不可刪除）</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['電話', 'Email', '身分證', '信用卡', '帳號', '地址'].map(name => (
                        <span key={name} className="stat-badge">{name}</span>
                    ))}
                </div>
            </div>

            {/* ====== 新增自訂欄位 ====== */}
            <div className="detail-card" style={{ marginBottom: '20px' }}>
                <h3>➕ 新增自訂欄位</h3>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                        <label style={{ fontSize: '13px', color: '#6b7280' }}>欄位名稱</label>
                        <input
                            type="text"
                            placeholder="例如：性別"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            className="form-input"
                            style={{ margin: '4px 0 0' }}
                        />
                    </div>

                    <div style={{ minWidth: '120px' }}>
                        <label style={{ fontSize: '13px', color: '#6b7280' }}>遮罩方式</label>
                        <select
                            value={maskType}
                            onChange={e => setMaskType(e.target.value)}
                            className="form-input"
                            style={{ margin: '4px 0 0' }}
                        >
                            <option value="full">全部替換 (***)  </option>
                            <option value="partial">保留前幾字</option>
                        </select>
                    </div>

                    {maskType === 'partial' && (
                        <div style={{ minWidth: '80px' }}>
                            <label style={{ fontSize: '13px', color: '#6b7280' }}>保留幾字</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={keepChars}
                                onChange={e => setKeepChars(parseInt(e.target.value) || 1)}
                                className="form-input"
                                style={{ margin: '4px 0 0' }}
                            />
                        </div>
                    )}

                    <button onClick={handleAdd} className="btn btn-primary" style={{ height: '38px' }}>
                        新增
                    </button>
                </div>

                {label && (
                    <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
                        預覽：「{label}」值為「王小明」→ 遮罩後：「{previewMask('王小明', maskType, keepChars)}」
                    </p>
                )}
            </div>

            {/* ====== 已有的自訂欄位 ====== */}
            <div className="detail-card">
                <h3>🏷️ 已建立的自訂欄位（{fields.length}）</h3>

                {loading && <p>載入中...</p>}
                {!loading && fields.length === 0 && (
                    <p style={{ color: '#9ca3af' }}>還沒有自訂欄位</p>
                )}

                {fields.map(field => (
                    <div key={field.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0', borderBottom: '1px solid #f3f4f6'
                    }}>
                        <div>
                            <strong>{field.label}</strong>
                            <span style={{ fontSize: '13px', color: '#6b7280', marginLeft: '8px' }}>
                                {field.mask_type === 'full'
                                    ? '全部替換'
                                    : `保留前 ${field.keep_chars} 字`
                                }
                            </span>
                        </div>
                        <button
                            onClick={() => handleDelete(field.id)}
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '4px 10px', color: '#ef4444' }}
                        >
                            🗑 刪除
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default CustomFieldManager
