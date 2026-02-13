import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import './index.css'

export default function UserManage() {
    const { authFetch, API, user: currentUser } = useAuth()
    const [users, setUsers] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', username: '', password: '', role: 'worker' })
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(true)

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
            setForm({ name: '', username: '', password: '', role: 'worker' })
            loadUsers()
            alert(`✅ 使用者「${data.user.name}」已建立`)
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`確定要刪除使用者「${name}」嗎？`)) return
        try {
            const res = await authFetch(`${API}/api/users/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            loadUsers()
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
                        {error && <p style={{ color: '#ef4444', fontSize: '13px', margin: '0 0 12px' }}>❌ {error}</p>}
                        <button type="submit" className="btn btn-primary">✅ 建立使用者</button>
                    </form>
                )}

                {loading ? (
                    <p style={{ textAlign: 'center', color: '#9ca3af' }}>載入中...</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>姓名</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>帳號</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>角色</th>
                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #e5e7eb' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '10px' }}>{u.name}</td>
                                    <td style={{ padding: '10px', color: '#6b7280' }}>{u.username}</td>
                                    <td style={{ padding: '10px' }}>
                                        <span style={{
                                            padding: '2px 10px', borderRadius: '20px', fontSize: '12px',
                                            background: u.role === 'admin' ? '#fef3c7' : '#dbeafe',
                                            color: u.role === 'admin' ? '#92400e' : '#1e40af',
                                        }}>
                                            {u.role === 'admin' ? '👑 管理員' : '🔧 師傅'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                        {u.id !== currentUser?.id && (
                                            <button
                                                onClick={() => handleDelete(u.id, u.name)}
                                                style={{
                                                    padding: '4px 12px', borderRadius: '6px', fontSize: '12px',
                                                    border: '1px solid #fca5a5', background: '#fef2f2', color: '#ef4444',
                                                    cursor: 'pointer',
                                                }}
                                            >刪除</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
