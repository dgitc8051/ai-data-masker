import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

// ============ 建立工單（4 步驟）============
function TicketCreate() {
    const navigate = useNavigate()
    const { user, authFetch, API } = useAuth()

    // 步驟控制
    const [step, setStep] = useState(1)

    // Step 1: 選/建範本
    const [templates, setTemplates] = useState([])
    const [selectedTemplate, setSelectedTemplate] = useState(null)
    const [showNewTemplate, setShowNewTemplate] = useState(false)
    const [newTemplateName, setNewTemplateName] = useState('')
    const [newTemplateFields, setNewTemplateFields] = useState([{ label: '', key: '', enableFrequent: false }])

    // Step 2: 填入資料
    const [fieldValues, setFieldValues] = useState({})
    const [title, setTitle] = useState('')
    const [priority, setPriority] = useState('medium')
    const [createdBy, setCreatedBy] = useState('')
    const [workers, setWorkers] = useState([])
    const [assignedUserIds, setAssignedUserIds] = useState([])
    const [frequentCreators, setFrequentCreators] = useState([])
    const [fieldFrequentValues, setFieldFrequentValues] = useState({})
    const [editingFrequent, setEditingFrequent] = useState(null) // null or 'creator' or 'field_xxx'

    // Step 3: 選擇遮罩欄位
    const [maskedFields, setMaskedFields] = useState([])

    // Step 4: 預覽 & 送出
    const [previewResult, setPreviewResult] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    // ============ 載入範本 ============
    const loadTemplates = () => {
        authFetch(`${API}/api/templates`)
            .then(res => res.json())
            .then(data => setTemplates(data))
    }

    useEffect(() => {
        loadTemplates()
        // 載入常用建立者
        const saved = JSON.parse(localStorage.getItem('frequentCreators') || '[]')
        setFrequentCreators(saved)
        // 載入師傅列表
        authFetch(`${API}/api/users/workers`)
            .then(res => res.json())
            .then(data => setWorkers(data))
            .catch(() => { })
        // 自動帶入登入者名字
        if (user?.name) setCreatedBy(user.name)
    }, []) // eslint-disable-line

    // ============ 常用建立者管理 ============
    const saveCreator = (name) => {
        if (!name.trim()) return
        const saved = JSON.parse(localStorage.getItem('frequentCreators') || '[]')
        // 不重複，最新的放在最前面，最多存 10 個
        const updated = [name, ...saved.filter(n => n !== name)].slice(0, 10)
        localStorage.setItem('frequentCreators', JSON.stringify(updated))
        setFrequentCreators(updated)
    }

    const removeCreator = (name) => {
        const updated = frequentCreators.filter(n => n !== name)
        localStorage.setItem('frequentCreators', JSON.stringify(updated))
        setFrequentCreators(updated)
    }

    // ============ 每個欄位的常用值管理 ============
    const getFreqKey = (templateId, fieldKey) => `freq_${templateId}_${fieldKey}`

    const loadFieldFrequents = (template) => {
        const all = {}
        template.fields.forEach(f => {
            if (f.enableFrequent) {
                const key = getFreqKey(template.id, f.key)
                all[f.key] = JSON.parse(localStorage.getItem(key) || '[]')
            }
        })
        setFieldFrequentValues(all)
    }

    const saveFieldFrequent = (templateId, fieldKey, value) => {
        if (!value.trim()) return
        const key = getFreqKey(templateId, fieldKey)
        const saved = JSON.parse(localStorage.getItem(key) || '[]')
        const updated = [value, ...saved.filter(v => v !== value)].slice(0, 10)
        localStorage.setItem(key, JSON.stringify(updated))
        setFieldFrequentValues(prev => ({ ...prev, [fieldKey]: updated }))
    }

    const removeFieldFrequent = (templateId, fieldKey, value) => {
        const key = getFreqKey(templateId, fieldKey)
        const saved = JSON.parse(localStorage.getItem(key) || '[]')
        const updated = saved.filter(v => v !== value)
        localStorage.setItem(key, JSON.stringify(updated))
        setFieldFrequentValues(prev => ({ ...prev, [fieldKey]: updated }))
    }

    // ============ Step 1: 範本管理 ============
    const handleSelectTemplate = (template) => {
        setSelectedTemplate(template)
        const values = {}
        template.fields.forEach(f => { values[f.key] = '' })
        setFieldValues(values)
        setTitle(template.name)
        loadFieldFrequents(template)
        setStep(2)
    }

    // 新增範本欄位操作
    const addNewField = () => {
        setNewTemplateFields([...newTemplateFields, { label: '', key: '', enableFrequent: false }])
    }
    const removeNewField = (index) => {
        setNewTemplateFields(newTemplateFields.filter((_, i) => i !== index))
    }
    const updateNewField = (index, field, value) => {
        const updated = [...newTemplateFields]
        updated[index] = { ...updated[index], [field]: value }
        if (field === 'label') updated[index].key = 'field_' + index
        setNewTemplateFields(updated)
    }

    // 儲存新範本 → 自動選擇它
    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return alert('請輸入範本名稱')
        const validFields = newTemplateFields.filter(f => f.label.trim())
        if (validFields.length === 0) return alert('至少需要一個欄位')

        try {
            const res = await fetch(`${API}/api/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTemplateName, fields: validFields }),
            })
            const data = await res.json()
            loadTemplates()
            // 直接選擇這個新範本
            handleSelectTemplate(data.template)
            setShowNewTemplate(false)
            setNewTemplateName('')
            setNewTemplateFields([{ label: '', key: '', enableFrequent: false }])
        } catch (err) {
            alert('建立範本失敗')
        }
    }

    // 刪除範本
    const handleDeleteTemplate = async (e, id) => {
        e.stopPropagation()
        if (!confirm('確定刪除這個範本？')) return
        await fetch(`${API}/api/templates/${id}`, { method: 'DELETE' })
        loadTemplates()
    }

    // ============ Step 2: 更新欄位值 ============
    const updateFieldValue = (key, value) => {
        setFieldValues(prev => ({ ...prev, [key]: value }))
    }

    const goToStep3 = () => {
        const hasValue = Object.values(fieldValues).some(v => v.trim())
        if (!hasValue) return alert('請至少填入一個欄位的資料')
        setStep(3)
    }

    // ============ Step 3: 勾選遮罩欄位 ============
    const toggleMaskField = (key) => {
        setMaskedFields(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    const goToStep4 = () => {
        if (maskedFields.length === 0) return alert('請至少選擇一個要遮罩的欄位')
        generatePreview()
        setStep(4)
    }

    // ============ Step 4: 預覽 ============
    const generatePreview = () => {
        const lines = selectedTemplate.fields.map(f => {
            const value = fieldValues[f.key] || ''
            const isMasked = maskedFields.includes(f.key)
            return {
                label: f.label,
                original: value,
                masked: isMasked ? maskPreview(value) : value,
                isMasked,
            }
        })
        setPreviewResult(lines)
    }

    const maskPreview = (text) => {
        if (!text) return ''
        const len = text.length
        if (len <= 2) return '***'
        return text[0] + '*'.repeat(len - 2) + text[len - 1]
    }

    // ============ 送出 ============
    const handleSubmit = async () => {
        setSubmitting(true)
        const fieldLabels = {}
        selectedTemplate.fields.forEach(f => { fieldLabels[f.key] = f.label })

        const creatorName = createdBy || '匿名'

        try {
            const res = await authFetch(`${API}/api/tickets`, {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    field_values: fieldValues,
                    field_labels: fieldLabels,
                    masked_fields: maskedFields,
                    mask_method: 'ai',
                    priority,
                    created_by: creatorName,
                    template_id: selectedTemplate.id,
                    assigned_user_ids: assignedUserIds,
                }),
            })
            const data = await res.json()

            // 送出成功，自動儲存常用值
            selectedTemplate.fields.forEach(f => {
                if (f.enableFrequent && fieldValues[f.key]?.trim()) {
                    saveFieldFrequent(selectedTemplate.id, f.key, fieldValues[f.key].trim())
                }
            })

            // 儲存常用建立者
            if (createdBy.trim()) {
                saveCreator(createdBy.trim())
            }

            alert(`✅ 工單 ${data.ticket.ticket_no} 建立成功！`)
            navigate('/')
        } catch (err) {
            alert('建立失敗')
        }
        setSubmitting(false)
    }

    // ============ 步驟指示器 ============
    const steps = ['選擇範本', '填入資料', '選擇遮罩', '確認送出']

    return (
        <div className="container">
            <h1>📝 建立新工單</h1>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', justifyContent: 'center' }}>
                <Link to="/" className="btn btn-secondary">← 回到首頁</Link>
            </div>

            {/* 步驟進度條 */}
            <div className="csv-steps">
                {steps.map((s, i) => (
                    <span key={i} className={`csv-step ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}>
                        {step > i + 1 ? '✅' : `${i + 1}`} {s}
                    </span>
                ))}
            </div>

            {/* ====== Step 1: 選擇或建立範本 ====== */}
            {step === 1 && (
                <div className="detail-card">
                    <h3>📋 選擇工單範本</h3>
                    <p style={{ color: '#6b7280', fontSize: '14px' }}>
                        選擇現有範本或建立新範本，定義工單需要的欄位
                    </p>

                    {/* 現有範本 */}
                    {templates.length > 0 && (
                        <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
                            {templates.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelectTemplate(t)}
                                    style={{
                                        border: '2px solid #e5e7eb',
                                        borderRadius: '10px',
                                        padding: '14px 16px',
                                        cursor: 'pointer',
                                        background: 'white',
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = '#4f46e5'
                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(79,70,229,0.12)'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = '#e5e7eb'
                                        e.currentTarget.style.boxShadow = 'none'
                                    }}
                                >
                                    <div>
                                        <strong style={{ fontSize: '15px' }}>📄 {t.name}</strong>
                                        <div style={{ marginTop: '6px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                            {t.fields?.map((f, i) => (
                                                <span key={i} className="stat-badge" style={{ fontSize: '12px' }}>{f.label}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteTemplate(e, t.id)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#d1d5db', fontSize: '16px', padding: '4px 8px',
                                        }}
                                        onMouseEnter={e => e.target.style.color = '#ef4444'}
                                        onMouseLeave={e => e.target.style.color = '#d1d5db'}
                                        title="刪除範本"
                                    >✕</button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 建立新範本（內嵌） */}
                    {!showNewTemplate ? (
                        <button
                            onClick={() => setShowNewTemplate(true)}
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                        >
                            ＋ 建立新範本
                        </button>
                    ) : (
                        <div style={{
                            border: '2px solid #4f46e5',
                            borderRadius: '10px',
                            padding: '16px',
                            background: '#f5f3ff',
                        }}>
                            <h4 style={{ margin: '0 0 12px', color: '#4f46e5' }}>✨ 建立新範本</h4>

                            <div className="form-group">
                                <label>範本名稱</label>
                                <input
                                    type="text"
                                    placeholder="例如：冷氣維修通知"
                                    value={newTemplateName}
                                    onChange={e => setNewTemplateName(e.target.value)}
                                    className="form-input"
                                />
                            </div>

                            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                                表單欄位
                            </label>

                            {newTemplateFields.map((field, index) => (
                                <div key={index} style={{ marginBottom: '10px', padding: '10px', background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <span style={{ color: '#9ca3af', fontSize: '14px', minWidth: '24px' }}>{index + 1}.</span>
                                        <input
                                            type="text"
                                            placeholder="欄位名稱（如：客戶姓名）"
                                            value={field.label}
                                            onChange={e => updateNewField(index, 'label', e.target.value)}
                                            className="form-input"
                                            style={{ flex: 1, margin: 0 }}
                                        />
                                        {newTemplateFields.length > 1 && (
                                            <button onClick={() => removeNewField(index)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px' }}>✕</button>
                                        )}
                                    </div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', marginLeft: '32px', fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={field.enableFrequent || false}
                                            onChange={e => updateNewField(index, 'enableFrequent', e.target.checked)}
                                            style={{ width: '14px', height: '14px' }}
                                        />
                                        ⭐ 啟用常用值記憶（填過的內容可快速選取）
                                    </label>
                                </div>
                            ))}

                            <button onClick={addNewField} className="btn btn-secondary" style={{ fontSize: '13px', marginBottom: '12px' }}>
                                + 新增欄位
                            </button>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={handleSaveTemplate} className="btn btn-primary">
                                    ✅ 建立並使用此範本
                                </button>
                                <button onClick={() => { setShowNewTemplate(false); setNewTemplateName(''); setNewTemplateFields([{ label: '', key: '', enableFrequent: false }]) }}
                                    className="btn btn-secondary">取消</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ====== Step 2: 填入客戶資料 ====== */}
            {step === 2 && selectedTemplate && (
                <div className="detail-card">
                    <h3>✍️ 填入客戶資料 — {selectedTemplate.name}</h3>

                    <div className="form-group">
                        <label>工單標題 *</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="form-input" />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '120px' }}>
                            <label style={{ fontSize: '13px', color: '#6b7280' }}>建立者</label>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', margin: '4px 0 0' }}>
                                <input type="text" placeholder="你的名字" value={createdBy}
                                    onChange={e => setCreatedBy(e.target.value)} className="form-input" style={{ margin: 0, flex: 1 }} />
                                <button
                                    onClick={() => {
                                        if (!createdBy.trim()) return alert('請先輸入名字')
                                        saveCreator(createdBy.trim())
                                        alert(`✅ 已加入常用建立者：${createdBy.trim()}`)
                                    }}
                                    style={{
                                        padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
                                        background: '#f9fafb', cursor: 'pointer', fontSize: '13px',
                                        whiteSpace: 'nowrap', transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.target.style.background = '#4f46e5'; e.target.style.color = 'white'; e.target.style.borderColor = '#4f46e5' }}
                                    onMouseLeave={e => { e.target.style.background = '#f9fafb'; e.target.style.color = '#374151'; e.target.style.borderColor = '#e5e7eb' }}
                                    title="加入常用建立者"
                                >＋ 加入常用</button>
                            </div>
                            {frequentCreators.length > 0 && (
                                <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>常用：</span>
                                    {frequentCreators.map(name => (
                                        <span
                                            key={name}
                                            onClick={() => {
                                                if (editingFrequent === 'creator') {
                                                    removeCreator(name)
                                                } else {
                                                    setCreatedBy(name)
                                                }
                                            }}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                                                background: editingFrequent === 'creator' ? '#fef2f2' : (createdBy === name ? '#4f46e5' : '#f3f4f6'),
                                                color: editingFrequent === 'creator' ? '#ef4444' : (createdBy === name ? 'white' : '#374151'),
                                                cursor: 'pointer', transition: 'all 0.2s',
                                                border: editingFrequent === 'creator' ? '1px solid #fca5a5' : (createdBy === name ? '1px solid #4f46e5' : '1px solid #e5e7eb'),
                                            }}
                                        >
                                            {editingFrequent === 'creator' && <span style={{ fontSize: '10px' }}>✕</span>}
                                            {name}
                                        </span>
                                    ))}
                                    <span
                                        onClick={() => setEditingFrequent(editingFrequent === 'creator' ? null : 'creator')}
                                        style={{
                                            fontSize: '11px', color: editingFrequent === 'creator' ? '#4f46e5' : '#9ca3af',
                                            cursor: 'pointer', marginLeft: '4px', textDecoration: 'underline',
                                        }}
                                    >{editingFrequent === 'creator' ? '完成' : '管理'}</span>
                                </div>
                            )}
                        </div>
                        <div style={{ minWidth: '100px' }}>
                            <label style={{ fontSize: '13px', color: '#6b7280' }}>優先級</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)} className="form-input" style={{ margin: '4px 0 0' }}>
                                <option value="low">🟢 低</option>
                                <option value="medium">🟡 中</option>
                                <option value="high">🔴 高</option>
                            </select>
                        </div>
                    </div>

                    {/* 指派師傅 */}
                    {workers.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', color: '#6b7280', display: 'block', marginBottom: '6px' }}>
                                👤 指派師傅 <span style={{ color: '#9ca3af' }}>（不選則所有師傅都可看到）</span>
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {workers.map(w => (
                                    <label key={w.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
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

                    <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />

                    {selectedTemplate.fields.map(field => {
                        const freqValues = fieldFrequentValues[field.key] || []
                        return (
                            <div key={field.key} className="form-group">
                                <label>{field.label} {field.enableFrequent && <span style={{ fontSize: '11px', color: '#9ca3af' }}>(⭐ 常用值)</span>}</label>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder={`請輸入${field.label}`}
                                        value={fieldValues[field.key] || ''}
                                        onChange={e => updateFieldValue(field.key, e.target.value)}
                                        className="form-input"
                                        style={{ margin: 0, flex: 1 }}
                                    />
                                    {field.enableFrequent && (
                                        <button
                                            onClick={() => {
                                                const val = fieldValues[field.key]
                                                if (!val?.trim()) return alert('請先輸入內容')
                                                saveFieldFrequent(selectedTemplate.id, field.key, val.trim())
                                            }}
                                            style={{
                                                padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb',
                                                background: '#f9fafb', cursor: 'pointer', fontSize: '12px',
                                                whiteSpace: 'nowrap', transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={e => { e.target.style.background = '#4f46e5'; e.target.style.color = 'white'; e.target.style.borderColor = '#4f46e5' }}
                                            onMouseLeave={e => { e.target.style.background = '#f9fafb'; e.target.style.color = '#374151'; e.target.style.borderColor = '#e5e7eb' }}
                                            title="加入常用值"
                                        >＋ 常用</button>
                                    )}
                                </div>
                                {field.enableFrequent && freqValues.length > 0 && (
                                    <div style={{ marginTop: '6px', display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>常用：</span>
                                        {freqValues.map(val => (
                                            <span
                                                key={val}
                                                onClick={() => {
                                                    if (editingFrequent === field.key) {
                                                        removeFieldFrequent(selectedTemplate.id, field.key, val)
                                                    } else {
                                                        updateFieldValue(field.key, val)
                                                    }
                                                }}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                    padding: '2px 10px', borderRadius: '20px', fontSize: '12px',
                                                    background: editingFrequent === field.key ? '#fef2f2' : (fieldValues[field.key] === val ? '#4f46e5' : '#f3f4f6'),
                                                    color: editingFrequent === field.key ? '#ef4444' : (fieldValues[field.key] === val ? 'white' : '#374151'),
                                                    cursor: 'pointer', transition: 'all 0.2s',
                                                    border: editingFrequent === field.key ? '1px solid #fca5a5' : (fieldValues[field.key] === val ? '1px solid #4f46e5' : '1px solid #e5e7eb'),
                                                }}
                                            >
                                                {editingFrequent === field.key && <span style={{ fontSize: '10px' }}>✕</span>}
                                                {val}
                                            </span>
                                        ))}
                                        <span
                                            onClick={() => setEditingFrequent(editingFrequent === field.key ? null : field.key)}
                                            style={{
                                                fontSize: '11px', color: editingFrequent === field.key ? '#4f46e5' : '#9ca3af',
                                                cursor: 'pointer', marginLeft: '4px', textDecoration: 'underline',
                                            }}
                                        >{editingFrequent === field.key ? '完成' : '管理'}</span>
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setStep(1)} className="btn btn-secondary">← 上一步</button>
                        <button onClick={goToStep3} className="btn btn-primary">下一步：選擇遮罩欄位 →</button>
                    </div>
                </div>
            )
            }

            {/* ====== Step 3: 選擇要遮罩的欄位 ====== */}
            {
                step === 3 && selectedTemplate && (
                    <div className="detail-card">
                        <h3>🔒 選擇要遮罩的欄位</h3>
                        <p style={{ color: '#6b7280', fontSize: '14px' }}>
                            勾選的欄位會被遮罩處理，師傅只能看到遮罩後的內容
                        </p>

                        <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                            {selectedTemplate.fields.map(field => {
                                const value = fieldValues[field.key] || ''
                                const isChecked = maskedFields.includes(field.key)
                                return (
                                    <label
                                        key={field.key}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '12px',
                                            padding: '12px 16px', borderRadius: '8px',
                                            border: `2px solid ${isChecked ? '#4f46e5' : '#e5e7eb'}`,
                                            background: isChecked ? '#eef2ff' : 'white',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}
                                    >
                                        <input type="checkbox" checked={isChecked} onChange={() => toggleMaskField(field.key)}
                                            style={{ width: '18px', height: '18px' }} />
                                        <div style={{ flex: 1 }}>
                                            <strong>{field.label}</strong>
                                            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{value || '(未填)'}</div>
                                        </div>
                                        {isChecked && value && (
                                            <span style={{ fontSize: '13px', color: '#4f46e5' }}>→ {maskPreview(value)}</span>
                                        )}
                                    </label>
                                )
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setStep(2)} className="btn btn-secondary">← 上一步</button>
                            <button onClick={goToStep4} className="btn btn-primary">下一步：預覽結果 →</button>
                        </div>
                    </div>
                )
            }

            {/* ====== Step 4: 確認 & 送出 ====== */}
            {
                step === 4 && previewResult && (
                    <div className="detail-card">
                        <h3>✅ 確認工單內容</h3>
                        <p style={{ color: '#6b7280', fontSize: '14px' }}>確認以下資料正確後，點擊送出。標示 🔒 的欄位將由 AI 自動遮罩處理。</p>

                        <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
                            {previewResult.map((row, i) => (
                                <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '12px 16px', borderRadius: '8px',
                                    border: row.isMasked ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                                    background: row.isMasked ? '#eef2ff' : 'white',
                                }}>
                                    <div>
                                        <strong>{row.label}</strong>
                                        <div style={{ fontSize: '14px', color: '#374151', marginTop: '2px' }}>
                                            {row.original || '(未填)'}
                                        </div>
                                    </div>
                                    {row.isMasked && (
                                        <span style={{
                                            padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
                                            background: '#4f46e5', color: 'white', whiteSpace: 'nowrap',
                                        }}>🔒 將被 AI 遮罩</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            <span><strong>標題：</strong>{title}</span>
                            <span><strong>建立者：</strong>{createdBy || '匿名'}</span>
                            <span><strong>優先級：</strong>{priority === 'high' ? '🔴 高' : priority === 'medium' ? '🟡 中' : '🟢 低'}</span>
                            <span><strong>遮罩方式：</strong>🤖 AI</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setStep(3)} className="btn btn-secondary">← 上一步</button>
                            <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
                                {submitting ? '⏳ 送出中...' : '✅ 確認送出工單'}
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    )
}

export default TicketCreate
