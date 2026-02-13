import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// ============ 範本管理頁面 ============
function TemplateManager() {
    const [templates, setTemplates] = useState([])
    const [loading, setLoading] = useState(true)

    // 新增/編輯用的表單狀態
    const [formName, setFormName] = useState('')
    const [formFields, setFormFields] = useState([{ label: '', key: '' }])
    const [editingId, setEditingId] = useState(null)  // null=新增模式, 有值=編輯模式
    const [showForm, setShowForm] = useState(false)

    const API = import.meta.env.VITE_API_URL

    // ============ 載入範本 ============
    const loadTemplates = () => {
        fetch(`${API}/api/templates`)
            .then(res => res.json())
            .then(data => {
                setTemplates(data)
                setLoading(false)
            })
            .catch(err => {
                console.error('載入範本失敗:', err)
                setLoading(false)
            })
    }

    useEffect(() => { loadTemplates() }, [])

    // ============ 新增欄位 ============
    const addField = () => {
        setFormFields([...formFields, { label: '', key: '' }])
    }

    // ============ 移除欄位 ============
    const removeField = (index) => {
        setFormFields(formFields.filter((_, i) => i !== index))
    }

    // ============ 更新欄位 ============
    const updateField = (index, prop, value) => {
        const updated = [...formFields]
        updated[index][prop] = value
        // 自動生成 key：把中文轉成 field_0, field_1...
        if (prop === 'label') {
            updated[index].key = 'field_' + index
        }
        setFormFields(updated)
    }

    // ============ 開始編輯 ============
    const startEdit = (template) => {
        setEditingId(template.id)
        setFormName(template.name)
        setFormFields(template.fields || [{ label: '', key: '' }])
        setShowForm(true)
    }

    // ============ 取消編輯 ============
    const cancelEdit = () => {
        setEditingId(null)
        setFormName('')
        setFormFields([{ label: '', key: '' }])
        setShowForm(false)
    }

    // ============ 儲存（新增或更新）============
    const handleSave = async () => {
        if (!formName.trim()) return alert('請輸入範本名稱')

        const validFields = formFields.filter(f => f.label.trim())
        if (validFields.length === 0) return alert('至少需要一個欄位')

        const url = editingId
            ? `${API}/api/templates/${editingId}`
            : `${API}/api/templates`

        const method = editingId ? 'PUT' : 'POST'

        try {
            await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formName,
                    fields: validFields,
                }),
            })
            cancelEdit()
            loadTemplates()
        } catch (err) {
            alert('儲存失敗')
        }
    }

    // ============ 刪除 ============
    const handleDelete = async (id) => {
        if (!confirm('確定要刪除這個範本嗎？')) return

        try {
            await fetch(`${API}/api/templates/${id}`, { method: 'DELETE' })
            loadTemplates()
        } catch (err) {
            alert('刪除失敗')
        }
    }

    // ============ 畫面 ============
    return (
        <div className="container">
            <h1>📋 範本管理</h1>
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '-8px' }}>
                建立工單範本，定義每種工單需要填的欄位
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <Link to="/" className="btn btn-secondary">← 回到首頁</Link>
                {!showForm && (
                    <button onClick={() => setShowForm(true)} className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                        + 新增範本
                    </button>
                )}
            </div>

            {/* ====== 新增/編輯表單 ====== */}
            {showForm && (
                <div className="detail-card" style={{ marginBottom: '20px' }}>
                    <h3>{editingId ? '✏️ 編輯範本' : '➕ 新增範本'}</h3>

                    <div className="form-group">
                        <label>範本名稱</label>
                        <input
                            type="text"
                            placeholder="例如：冷氣維修通知"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            className="form-input"
                        />
                    </div>

                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                        表單欄位
                    </label>

                    {formFields.map((field, index) => (
                        <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                            <span style={{ color: '#9ca3af', fontSize: '14px', minWidth: '30px' }}>
                                {index + 1}.
                            </span>
                            <input
                                type="text"
                                placeholder="欄位名稱（如：客戶姓名）"
                                value={field.label}
                                onChange={e => updateField(index, 'label', e.target.value)}
                                className="form-input"
                                style={{ flex: 1, margin: 0 }}
                            />
                            {formFields.length > 1 && (
                                <button
                                    onClick={() => removeField(index)}
                                    className="btn btn-secondary"
                                    style={{ padding: '6px 12px', fontSize: '13px', color: '#ef4444' }}
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}

                    <button onClick={addField} className="btn btn-secondary" style={{ fontSize: '13px', marginBottom: '16px' }}>
                        + 新增欄位
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleSave} className="btn btn-primary">
                            {editingId ? '💾 儲存修改' : '✅ 建立範本'}
                        </button>
                        <button onClick={cancelEdit} className="btn btn-secondary">取消</button>
                    </div>
                </div>
            )}

            {/* ====== 現有範本列表 ====== */}
            {loading && <p style={{ textAlign: 'center' }}>載入中...</p>}

            {!loading && templates.length === 0 && !showForm && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    <p style={{ fontSize: '48px', margin: '0' }}>📝</p>
                    <p>還沒有任何範本</p>
                    <button onClick={() => setShowForm(true)} className="btn btn-primary">建立第一個範本</button>
                </div>
            )}

            {templates.map(template => (
                <div key={template.id} className="detail-card" style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>📄 {template.name}</h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => startEdit(template)} className="btn btn-secondary" style={{ fontSize: '13px', padding: '4px 12px' }}>
                                ✏️ 編輯
                            </button>
                            <button onClick={() => handleDelete(template.id)} className="btn btn-secondary" style={{ fontSize: '13px', padding: '4px 12px', color: '#ef4444' }}>
                                🗑 刪除
                            </button>
                        </div>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {template.fields?.map((field, i) => (
                            <span key={i} className="stat-badge" style={{ fontSize: '13px' }}>
                                {field.label}
                            </span>
                        ))}
                    </div>

                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '8px 0 0' }}>
                        建立於 {new Date(template.created_at).toLocaleString('zh-TW')}
                    </p>
                </div>
            ))}
        </div>
    )
}

export default TemplateManager
