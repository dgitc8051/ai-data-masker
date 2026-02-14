import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { Link } from 'react-router-dom'
import './index.css'

export default function LineCustomers() {
    const { API, authFetch } = useAuth()
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const load = async () => {
        setLoading(true)
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : ''
            const res = await authFetch(`${API}/api/line-customers${params}`)
            const data = await res.json()
            setCustomers(data)
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    useEffect(() => { load() }, []) // eslint-disable-line

    const handleSearch = (e) => {
        e.preventDefault()
        load()
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`確定要刪除 LINE 客戶「${name}」？\n刪除後該用戶下次從 LINE 進入會重新註冊。`)) return
        try {
            await authFetch(`${API}/api/line-customers/${id}`, { method: 'DELETE' })
            load()
        } catch (err) {
            console.error(err)
            alert('刪除失敗')
        }
    }

    return (
        <div className="container">
            <h1 style={{ textAlign: 'center' }}>📱 LINE 客戶名冊</h1>

            <div style={{ marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link to="/" className="btn btn-secondary">← 回工單列表</Link>
            </div>

            {/* 搜尋 */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input
                    type="text" className="form-input"
                    placeholder="搜尋 LINE 暱稱、報修姓名、電話..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary">搜尋</button>
            </form>

            {/* 統計 */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '10px', marginBottom: '20px',
            }}>
                <div style={{
                    textAlign: 'center', padding: '14px', borderRadius: '12px',
                    background: '#eef2ff', border: '1px solid #c7d2fe',
                }}>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#4f46e5' }}>{customers.length}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>LINE 客戶總數</div>
                </div>
                <div style={{
                    textAlign: 'center', padding: '14px', borderRadius: '12px',
                    background: '#ecfdf5', border: '1px solid #a7f3d0',
                }}>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>
                        {customers.filter(c => c.tickets_count > 0).length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>有報修紀錄</div>
                </div>
                <div style={{
                    textAlign: 'center', padding: '14px', borderRadius: '12px',
                    background: '#fff7ed', border: '1px solid #fed7aa',
                }}>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: '#ea580c' }}>
                        {customers.filter(c => c.tickets_count === 0).length}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>僅瀏覽未報修</div>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>⏳ 載入中...</div>
            ) : customers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>目前沒有 LINE 客戶資料</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb' }}>
                                <th style={thStyle}>LINE 頭像</th>
                                <th style={thStyle}>LINE 暱稱</th>
                                <th style={thStyle}>報修姓名</th>
                                <th style={thStyle}>電話</th>
                                <th style={thStyle}>報修次數</th>
                                <th style={thStyle}>最後訪問</th>
                                <th style={thStyle}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.map(c => (
                                <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={tdStyle}>
                                        {c.avatar_url ? (
                                            <img src={c.avatar_url} alt=""
                                                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                background: '#e5e7eb', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: '16px',
                                            }}>👤</div>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: '600' }}>{c.line_display_name}</div>
                                        <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
                                            {c.line_user_id.slice(0, 10)}...
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        {c.customer_name || <span style={{ color: '#d1d5db' }}>—</span>}
                                    </td>
                                    <td style={tdStyle}>
                                        {c.phone || <span style={{ color: '#d1d5db' }}>—</span>}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                        {c.tickets_count > 0 ? (
                                            <span style={{
                                                display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                                                background: '#dcfce7', color: '#16a34a', fontWeight: '700', fontSize: '13px',
                                            }}>{c.tickets_count}</span>
                                        ) : (
                                            <span style={{ color: '#d1d5db' }}>0</span>
                                        )}
                                    </td>
                                    <td style={{ ...tdStyle, fontSize: '12px', color: '#6b7280' }}>
                                        {c.last_visited_at ? new Date(c.last_visited_at).toLocaleString('zh-TW', {
                                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                                        }) : '—'}
                                    </td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => handleDelete(c.id, c.line_display_name)}
                                            style={{
                                                padding: '4px 10px', borderRadius: '6px', border: '1px solid #fca5a5',
                                                background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer',
                                            }}
                                        >🗑 刪除</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

const thStyle = { padding: '10px', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '13px' }
const tdStyle = { padding: '10px', fontSize: '14px' }
