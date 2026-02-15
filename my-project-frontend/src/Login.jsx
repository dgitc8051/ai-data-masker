import { useState } from 'react'
import { useAuth } from './AuthContext'
import './index.css'

export default function Login() {
    const { login } = useAuth()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await login(username, password)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', padding: '40px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)', width: '100%', maxWidth: '400px',
            }}>
                <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '24px' }}>🔐 工單系統</h1>
                <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '28px', fontSize: '14px' }}>請登入以繼續</p>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>帳號</label>
                        <input
                            type="text" className="form-input" placeholder="請輸入帳號"
                            value={username} onChange={e => setUsername(e.target.value)}
                            autoFocus autoComplete="username"
                        />
                    </div>
                    <div className="form-group">
                        <label>密碼</label>
                        <input
                            type="password" className="form-input" placeholder="請輸入密碼"
                            value={password} onChange={e => setPassword(e.target.value)}
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <p style={{
                            color: '#ef4444', fontSize: '13px', textAlign: 'center',
                            padding: '8px', background: '#fef2f2', borderRadius: '8px', marginBottom: '16px',
                        }}>❌ {error}</p>
                    )}

                    <button
                        type="submit" className="btn btn-primary" disabled={loading}
                        style={{ width: '100%', padding: '12px', fontSize: '16px' }}
                    >
                        {loading ? '⏳ 登入中...' : '登入'}
                    </button>
                </form>

                <div style={{
                    marginTop: '24px', padding: '12px', background: '#f9fafb',
                    borderRadius: '8px', fontSize: '12px', color: '#9ca3af',
                }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 'bold', color: '#6b7280' }}>預設帳號</p>
                    <p style={{ margin: '2px 0' }}>管理員：admin / admin123</p>
                    <p style={{ margin: '2px 0' }}>師傅：worker1 / worker123</p>
                </div>
            </div>
        </div>
    )
}
