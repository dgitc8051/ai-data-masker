import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'

// ============ 師傅工單列表 + 詳情 ============
function WorkerView() {
    const { id } = useParams()  // 如果有 id，顯示詳情；沒有就顯示列表

    return id ? <WorkerDetail id={id} /> : <WorkerList />
}

// ============ 師傅工單列表 ============
function WorkerList() {
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const API = import.meta.env.VITE_API_URL

    useEffect(() => {
        fetch(`${API}/api/tickets?view=worker`)
            .then(res => res.json())
            .then(data => {
                setTickets(data)
                setLoading(false)
            })
    }, [])

    const statusLabels = {
        pending: '⏳ 待處理',
        processing: '🔄 處理中',
        completed: '✅ 已完成',
        closed: '📁 已關閉',
    }
    const priorityLabels = {
        low: '🟢 低',
        medium: '🟡 中',
        high: '🔴 高',
    }

    const pendingCount = tickets.filter(t => t.status === 'pending').length
    const processingCount = tickets.filter(t => t.status === 'processing').length

    return (
        <div className="container">
            <h1>🔧 師傅工單系統</h1>
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '-8px' }}>
                查看指派的工單，更新處理狀態
            </p>

            {/* 統計 */}
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <div className="stat-card stat-pending">
                    <div className="stat-number">{pendingCount}</div>
                    <div className="stat-label">待處理</div>
                </div>
                <div className="stat-card stat-processing">
                    <div className="stat-number">{processingCount}</div>
                    <div className="stat-label">處理中</div>
                </div>
            </div>

            {loading && <p style={{ textAlign: 'center' }}>載入中...</p>}

            {!loading && tickets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    <p style={{ fontSize: '48px', margin: '0' }}>📭</p>
                    <p>目前沒有指派的工單</p>
                </div>
            )}

            {tickets.map(ticket => (
                <Link
                    to={`/worker/${ticket.id}`}
                    key={ticket.id}
                    className="ticket-card"
                >
                    <div className="ticket-header">
                        <span className="ticket-no">{ticket.ticket_no}</span>
                        <span className="ticket-priority">{priorityLabels[ticket.priority] || ticket.priority}</span>
                    </div>
                    <h3 className="ticket-title">{ticket.title}</h3>
                    <div className="ticket-footer">
                        <span>{statusLabels[ticket.status] || ticket.status}</span>
                        <span>{new Date(ticket.created_at).toLocaleString('zh-TW')}</span>
                    </div>
                </Link>
            ))}
        </div>
    )
}

// ============ 師傅工單詳情 ============
function WorkerDetail({ id }) {
    const [ticket, setTicket] = useState(null)
    const [loading, setLoading] = useState(true)
    const [commentText, setCommentText] = useState('')
    const [commentAuthor, setCommentAuthor] = useState('')
    const API = import.meta.env.VITE_API_URL

    const statusLabels = {
        pending: '⏳ 待處理',
        processing: '🔄 處理中',
        completed: '✅ 已完成',
        closed: '📁 已關閉',
    }
    const priorityLabels = {
        low: '🟢 低',
        medium: '🟡 中',
        high: '🔴 高',
    }

    const loadTicket = () => {
        fetch(`${API}/api/tickets/${id}?view=worker`)
            .then(res => res.json())
            .then(data => {
                setTicket(data)
                setLoading(false)
            })
    }

    useEffect(() => { loadTicket() }, [id])

    // 師傅更新狀態（只能改成「處理中」或「已完成」）
    const handleStatusChange = async (newStatus) => {
        await fetch(`${API}/api/tickets/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        })
        loadTicket()
    }

    // 新增留言
    const handleComment = async () => {
        if (!commentText.trim()) return alert('請輸入留言')
        await fetch(`${API}/api/tickets/${id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                author: commentAuthor || '師傅',
                content: commentText,
            }),
        })
        setCommentText('')
        loadTicket()
    }

    if (loading) return <div className="container"><p>載入中...</p></div>
    if (!ticket) return <div className="container"><p>找不到工單</p></div>

    return (
        <div className="container">
            <div style={{ marginBottom: '20px' }}>
                <Link to="/worker" className="btn btn-secondary">← 回到工單列表</Link>
            </div>

            {/* 工單資訊 */}
            <div className="detail-card">
                <div className="detail-header">
                    <span className="ticket-no">{ticket.ticket_no}</span>
                    <span>{priorityLabels[ticket.priority]}</span>
                </div>
                <h2 style={{ margin: '8px 0 16px' }}>{ticket.title}</h2>

                <div className="detail-info-grid">
                    <div><strong>狀態：</strong>{statusLabels[ticket.status]}</div>
                    <div><strong>建立時間：</strong>{new Date(ticket.created_at).toLocaleString('zh-TW')}</div>
                </div>

                {/* 師傅只能看到的狀態按鈕 */}
                <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ lineHeight: '36px' }}>更新狀態：</strong>
                    {['processing', 'completed'].map(s => (
                        <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className={`btn ${ticket.status === s ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: '13px', padding: '6px 14px' }}
                        >
                            {statusLabels[s]}
                        </button>
                    ))}
                </div>
            </div>

            {/* 遮罩後的工單內容（師傅只看到這個） */}
            <div className="detail-card">
                <h3>📋 工單內容</h3>
                <pre className="preview-text">{ticket.masked_text}</pre>
            </div>

            {/* 留言區 */}
            <div className="detail-card">
                <h3>💬 留言（{ticket.comments?.length || 0} 則）</h3>

                {ticket.comments?.map(comment => (
                    <div key={comment.id} className="comment-item">
                        <div className="comment-header">
                            <strong>{comment.author}</strong>
                            <span className="comment-time">{new Date(comment.created_at).toLocaleString('zh-TW')}</span>
                        </div>
                        <p className="comment-content">{comment.content}</p>
                    </div>
                ))}

                {ticket.comments?.length === 0 && (
                    <p style={{ color: '#9ca3af', fontSize: '14px' }}>還沒有留言</p>
                )}

                <div style={{ marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px' }}>
                    <div className="form-group">
                        <label>你的名字</label>
                        <input
                            type="text"
                            placeholder="選填，預設「師傅」"
                            value={commentAuthor}
                            onChange={e => setCommentAuthor(e.target.value)}
                            className="form-input"
                        />
                    </div>
                    <div className="form-group">
                        <label>回覆內容</label>
                        <textarea
                            rows="3"
                            placeholder="輸入回覆..."
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            className="form-input"
                        />
                    </div>
                    <button onClick={handleComment} className="btn btn-primary">送出回覆</button>
                </div>
            </div>
        </div>
    )
}

export default WorkerView
