import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import './index.css'

export default function UserManage() {
    const { authFetch, API, user: currentUser } = useAuth()
    const [users, setUsers] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', username: '', password: '', role: 'worker', phone: '' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)
    const [pwModal, setPwModal] = useState(null) // { id, name }
    const [newPassword, setNewPassword] = useState('')

    const loadUsers = async () => {
        try {
            const res = await authFetch(`${API}/api/users`)
            if (res.ok) setUsers(await res.json())
        } catch (e) { /* ignore */ }
        setLoading(false)
    }

    useEffect(() => { loadUsers() }, []) // eslint-disable-line

    const handleCreate = async (e) => {
        e.preventDefault()
        setError('')
        try {
            const res = await authFetch(`${API}/api/users`, {
                method: 'POST',
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || '建立失敗')
            setShowForm(false)
            setForm({ name: '', username: '', password: '', role: 'worker', phone: '' })
            loadUsers()
            alert(`✅ 使用者「${data.user.name}」已建立`)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`確定要刪除使用者「${name}」嗎？\n⚠️ 此操作無法復原`)) return
        try {
            const res = await authFetch(`${API}/api/users/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            loadUsers()
            alert(`✅ 已刪除使用者「${name}」`)
        } catch (err) {
            alert(`❌ ${err.message}`)
        }
    }

    const handleUnbindLine = async (id, name) => {
        if (!confirm(`確定要解除「${name}」的 LINE 綁定嗎？\n解除後將不再收到 LINE 通知。`)) return
        try {
            const res = await authFetch(`${API}/api/users/${id}/line`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            loadUsers()
            alert(`✅ ${data.message}`)
        } catch (err) {
            alert(`❌ ${err.message}`)
        }
    }

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 3) {
            alert('密碼至少需 3 個字元')
            return
        }
        try {
            const res = await authFetch(`${API}/api/users/${pwModal.id}/password`, {
                method: 'PATCH',
                body: JSON.stringify({ password: newPassword }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            setPwModal(null)
            setNewPassword('')
            alert(`✅ ${data.message}`)
        } catch (err) {
            alert(`❌ ${err.message}`)
        }
    }

    const handleUpdatePhone = async (id, name, currentPhone) => {
        const phone = prompt(`請輸入「${name}」的手機號碼：`, currentPhone || '')
        if (phone === null) return
        if (!phone.trim()) {
            alert('手機號碼不可空白')
            return
        }
        try {
            const res = await authFetch(`${API}/api/users/${id}/phone`, {
                method: 'PATCH',
                body: JSON.stringify({ phone: phone.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            loadUsers()
            alert(`✅ ${data.message}`)
        } catch (err) {
            alert(`❌ ${err.message}`)
        }
    }

    return (
        <div className="container">
            <h1 style={{ textAlign: 'center' }}>👥 使用者管理</h1>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <Link to="/" className="btn btn-secondary">← 回到首頁</Link>
            </div>

            <div className="detail-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0 }}>使用者列表</h3>
                    <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
                        {showForm ? '取消' : '＋ 新增使用者'}
                    </button>
                </div>

                {showForm && (
                    <form onSubmit={handleCreate} style={{
                        padding: '16px', background: '#f9fafb', borderRadius: '10px', marginBottom: '16px',
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>姓名</label>
                                <input type="text" className="form-input" placeholder="例：王大明" required
                                    value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>帳號</label>
                                <input type="text" className="form-input" placeholder="登入帳號" required
                                    value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>密碼</label>
                                <input type="password" className="form-input" placeholder="登入密碼" required
                                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>角色</label>
                                <select className="form-input" value={form.role}
                                    onChange={e => setForm({ ...form, role: e.target.value })}>
                                    <option value="worker">師傅</option>
                                    <option value="admin">管理員</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>手機號碼</label>
                                <input type="tel" className="form-input" placeholder="09xxxxxxxx"
                                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                        </div>
                        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px' }}>❌ {error}</p>}
                        <button type="submit" className="btn btn-primary">✅ 建立使用者</button>
                    </form>
                )}

                {loading ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af' }}>載入中...</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb' }}>
                                    <th style={thStyle}>姓名</th>
                                    <th style={thStyle}>帳號</th>
                                    <th style={thStyle}>手機</th>
                                    <th style={thStyle}>角色</th>
                                    <th style={thStyle}>LINE</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={tdStyle}>{u.name}</td>
                                        <td style={{ ...tdStyle, color: '#6b7280' }}>{u.username}</td>
                                        <td style={tdStyle}>
                                            {u.phone ? (
                                                <span style={{ color: '#059669', fontSize: '13px' }}>📞 {u.phone}</span>
                                            ) : (
                                                <span style={{ color: '#d1d5db', fontSize: '12px' }}>未設定</span>
                                            )}
                                        </td>
                                        <td style={tdStyle}>
                                            <span style={{
                                                padding: '2px 10px', borderRadius: '20px', fontSize: '12px',
                                                background: u.role === 'admin' ? '#fef3c7' : '#dbeafe',
                                                color: u.role === 'admin' ? '#92400e' : '#1e40af',
                                            }}>
                                                {u.role === 'admin' ? '👑 管理員' : '🔧 師傅'}
                                            </span>
                                        </td>
                                        <td style={tdStyle}>
                                            {u.line_bound ? (
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: '20px', fontSize: '12px',
                                                    background: '#d1fae5', color: '#065f46',
                                                }}>
                                                    ✅ {u.line_display_name || '已綁定'}
                                                </span>
                                            ) : (
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: '20px', fontSize: '12px',
                                                    background: '#f3f4f6', color: '#9ca3af',
                                                }}>
                                                    未綁定
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => { setPwModal({ id: u.id, name: u.name }); setNewPassword('') }}
                                                    style={btnStyle('#eef2ff', '#4f46e5', '#c7d2fe')}
                                                >🔑 改密碼</button>

                                                <button
                                                    onClick={() => handleUpdatePhone(u.id, u.name, u.phone)}
                                                    style={btnStyle('#f0fdfa', '#059669', '#6ee7b7')}
                                                >📞 設定手機</button>

                                                {u.line_bound && (
                                                    <button
                                                        onClick={() => handleUnbindLine(u.id, u.name)}
                                                        style={btnStyle('#fefce8', '#a16207', '#fef08a')}
                                                    >🔗 解綁LINE</button>
                                                )}

                                                {u.id !== currentUser?.id && (
                                                    <button
                                                        onClick={() => handleDelete(u.id, u.name)}
                                                        style={btnStyle('#fef2f2', '#ef4444', '#fca5a5')}
                                                    >🗑 刪除</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 修改密碼 Modal */}
            {pwModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000,
                }} onClick={() => setPwModal(null)}>
                    <div style={{
                        background: 'white', borderRadius: '16px', padding: '28px',
                        width: '360px', maxWidth: '90vw',
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 4px' }}>🔑 修改密碼</h3>
                        <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 20px' }}>
                            {pwModal.name}
                        </p>
                        <div className="form-group" style={{ margin: '0 0 16px' }}>
                            <label>新密碼</label>
                            <input
                                type="password" className="form-input"
                                placeholder="輸入新密碼（至少 3 字元）"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div style={{
                            background: '#fff7ed', borderRadius: '8px', padding: '10px 12px',
                            marginBottom: '16px',
                        }}>
                            <p style={{ color: '#9a3412', fontSize: '12px', margin: 0 }}>
                                ⚠️ 修改密碼後，該使用者需要重新登入。LINE 綁定不受影響。
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setPwModal(null)}
                                className="btn btn-secondary" style={{ flex: 1 }}>取消</button>
                            <button onClick={handleChangePassword}
                                className="btn btn-primary" style={{ flex: 1 }}>確認修改</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const thStyle = { padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '13px' }
const tdStyle = { padding: '10px', fontSize: '14px' }
const btnStyle = (bg, color, border) => ({
    padding: '4px 10px', borderRadius: '6px', fontSize: '11px',
    border: `1px solid ${border}`, background: bg, color,
    cursor: 'pointer', whiteSpace: 'nowrap',
})
