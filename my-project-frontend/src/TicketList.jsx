import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

const STATUS_MAP = {
    all: { label: '全部', color: '#6b7280' },
    new: { label: '新案件', color: '#3b82f6' },
    need_more_info: { label: '待補件', color: '#f59e0b' },
    info_submitted: { label: '補件完成待審核', color: '#f97316' },
    dispatched: { label: '已派工', color: '#06b6d4' },
    unaccepted: { label: '未接案', color: '#e11d48' },
    time_proposed: { label: '待確認時間', color: '#8b5cf6' },
    scheduled: { label: '已排定', color: '#059669' },
    reschedule: { label: '改期中', color: '#f59e0b' },
    in_progress: { label: '處理中', color: '#f97316' },
    done: { label: '完工', color: '#10b981' },
    closed: { label: '結案', color: '#9ca3af' },
    cancelled: { label: '已取消', color: '#ef4444' },
    // 舊狀態相容
    pending: { label: '待處理', color: '#f59e0b' },
    processing: { label: '處理中', color: '#3b82f6' },
    completed: { label: '已完成', color: '#10b981' },
}

const CATEGORY_COLORS = {
    '水管': '#3b82f6',
    '電路': '#f59e0b',
    '冷氣': '#06b6d4',
    '熱水器': '#ef4444',
    '其他': '#8b5cf6',
}

export default function TicketList() {
    const { user, authFetch, API, logout } = useAuth()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    const fetchTickets = async () => {
        setLoading(true)
        try {
            let url = `${API}/api/tickets?`
            if (statusFilter !== 'all') url += `status=${statusFilter}&`
            if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`
            const res = await authFetch(url)
            const data = await res.json()
            setTickets(data)
        } catch (err) {
            console.error('載入失敗:', err)
        }
        setLoading(false)
    }

    useEffect(() => { fetchTickets() }, [statusFilter]) // eslint-disable-line

    const handleSearch = (e) => {
        e.preventDefault()
        fetchTickets()
    }

    const isAdmin = user?.role === 'admin'

    // 統計
    const totalCount = tickets.length

    return (
        <div className="container">
            {/* 頂部使用者列 */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'white', borderRadius: '10px',
                marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 'bold' }}>{user?.name}</span>
                    <span style={{
                        padding: '2px 10px', borderRadius: '12px', fontSize: '11px',
                        background: isAdmin ? '#4f46e5' : '#10b981', color: 'white',
                    }}>
                        {isAdmin ? '管理員' : '師傅'}
                    </span>
                </div>
                <button onClick={logout} style={{
                    background: 'none', border: 'none', color: '#6b7280',
                    cursor: 'pointer', fontSize: '13px',
                }}>登出</button>
            </div>

            <h1 className="page-title">📋 工單管理</h1>

            {/* 功能按鈕 */}
            {isAdmin && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                    <Link to="/repair" className="btn btn-primary" style={{ background: '#10b981' }}>🔧 報修填單</Link>
                    <Link to="/create" className="btn btn-primary">+ 遮罩工單</Link>
                    <Link to="/csv" className="btn btn-secondary">📊 CSV 遮罩</Link>
                    <Link to="/users" className="btn btn-secondary">👥 使用者管理</Link>
                    <Link to="/line-customers" className="btn btn-secondary" style={{ background: '#06b6d4', color: '#fff' }}>📱 LINE 客戶</Link>
                </div>
            )}

            {/* 搜尋列 */}
            <form onSubmit={handleSearch} style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text" className="form-input"
                        placeholder="🔍 搜尋：案件編號、姓名、電話、地址..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>搜尋</button>
                </div>
            </form>

            {/* 狀態篩選 */}
            <div style={{
                display: 'flex', gap: '6px', marginBottom: '20px', overflowX: 'auto',
                padding: '4px 0',
            }}>
                {Object.entries(STATUS_MAP).filter(([k]) => {
                    const workerStatuses = ['all', 'unaccepted', 'dispatched', 'time_proposed', 'scheduled', 'reschedule', 'in_progress', 'done', 'closed', 'cancelled']
                    const adminStatuses = ['all', 'new', 'need_more_info', 'info_submitted', 'dispatched', 'unaccepted', 'time_proposed', 'scheduled', 'reschedule', 'in_progress', 'done', 'closed', 'cancelled']
                    return (isAdmin ? adminStatuses : workerStatuses).includes(k)
                })
                    .map(([key, st]) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            style={{
                                padding: '6px 14px', borderRadius: '20px', border: 'none',
                                fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                                transition: 'all 0.2s',
                                background: statusFilter === key ? st.color : '#f3f4f6',
                                color: statusFilter === key ? 'white' : '#374151',
                            }}
                        >{st.label}</button>
                    ))}
            </div>

            {/* 統計 */}
            <div style={{
                textAlign: 'center', fontSize: '13px', color: '#9ca3af', marginBottom: '16px',
            }}>
                共 {totalCount} 筆
            </div>

            {/* 工單列表 */}
            {loading ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>⏳ 載入中...</p>
            ) : tickets.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280' }}>目前沒有工單</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tickets.map(ticket => {
                        const displayStatus = (ticket.status === 'dispatched' && !ticket.accepted_at) ? 'unaccepted' : ticket.status
                        const st = STATUS_MAP[displayStatus] || STATUS_MAP.pending
                        const catColor = CATEGORY_COLORS[ticket.category] || '#6b7280'

                        return (
                            <Link
                                to={`/tickets/${ticket.id}`}
                                key={ticket.id}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className="detail-card" style={{
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                    cursor: 'pointer',
                                }}>
                                    {/* 頂部行 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#4f46e5' }}>{ticket.ticket_no}</span>
                                            {ticket.category && (
                                                <span style={{
                                                    padding: '2px 8px', borderRadius: '10px', fontSize: '11px',
                                                    background: catColor + '18', color: catColor,
                                                    fontWeight: 'bold',
                                                }}>{ticket.category}</span>
                                            )}
                                            {ticket.is_urgent && (
                                                <span style={{ fontSize: '12px' }}>🔴</span>
                                            )}
                                        </div>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                                            background: st.color + '18', color: st.color,
                                            fontWeight: 'bold',
                                        }}>{st.label}</span>
                                    </div>

                                    {/* 標題 */}
                                    <div style={{ fontWeight: '600', marginBottom: '6px' }}>{ticket.title}</div>

                                    {/* 地址 / 描述摘要 */}
                                    {ticket.address && (
                                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                                            📍 {ticket.address.substring(0, 40)}{ticket.address.length > 40 ? '...' : ''}
                                        </div>
                                    )}
                                    {ticket.description_summary && (
                                        <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                                            📝 {ticket.description_summary.substring(0, 50)}{ticket.description_summary.length > 50 ? '...' : ''}
                                        </div>
                                    )}

                                    {/* 底部 */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
                                        <span>建立：{ticket.created_by}</span>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {ticket.assigned_users && ticket.assigned_users.length > 0 && (
                                                <span style={{
                                                    display: 'flex', gap: '4px', alignItems: 'center',
                                                }}>
                                                    👷 {ticket.assigned_users.map(u => u.name).join(', ')}
                                                </span>
                                            )}
                                            <span>{new Date(ticket.created_at).toLocaleDateString('zh-TW')}</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
