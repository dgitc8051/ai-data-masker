import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

const menuItems = [
    { icon: '🔧', label: '用戶報修', desc: '線上填寫維修需求', to: '/repair', color: '#ef4444' },
    { icon: '📋', label: '維修進度', desc: '查詢工單處理狀態', to: '/track', color: '#3b82f6' },
    { icon: '📞', label: '聯絡我們', desc: '電話・地址・營業時間', to: '/contact', color: '#10b981' },
    { icon: '👤', label: '內部登入', desc: '員工管理系統入口', to: '/login', color: '#8b5cf6' },
    { icon: '🛠️', label: '服務項目', desc: '專業維修服務一覽', to: '/services', color: '#f59e0b' },
    { icon: '💰', label: '費用參考', desc: '檢測費・維修行情', to: '/pricing', color: '#6366f1' },
]

export default function HomePage() {
    const { user } = useAuth()

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            padding: '0 0 40px 0',
        }}>
            {/* Hero */}
            <div style={{
                textAlign: 'center', padding: '48px 20px 32px',
                background: 'linear-gradient(180deg, rgba(99,102,241,0.15) 0%, transparent 100%)',
            }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🏠</div>
                <h1 style={{
                    fontSize: '28px', fontWeight: '800', color: '#fff',
                    margin: '0 0 8px', letterSpacing: '-0.5px',
                }}>
                    全方位水電維修
                </h1>
                <p style={{
                    color: 'rgba(255,255,255,0.6)', fontSize: '15px', margin: '0',
                    maxWidth: '300px', marginInline: 'auto',
                }}>
                    專業維修 · 快速到府 · 24小時服務
                </p>
                {user && (
                    <Link to="/" style={{
                        display: 'inline-block', marginTop: '16px',
                        padding: '8px 20px', background: 'rgba(255,255,255,0.1)',
                        borderRadius: '20px', color: '#a5b4fc', fontSize: '13px',
                        textDecoration: 'none', border: '1px solid rgba(255,255,255,0.15)',
                    }}>
                        👋 {user.name}，進入管理後台 →
                    </Link>
                )}
            </div>

            {/* 六宮格 */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px', padding: '0 16px', maxWidth: '480px', margin: '0 auto',
            }}>
                {menuItems.map(item => (
                    <Link
                        key={item.to}
                        to={item.to}
                        style={{
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(255,255,255,0.06)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '16px', padding: '24px 8px 20px',
                            textDecoration: 'none', transition: 'all 0.25s',
                            cursor: 'pointer', position: 'relative', overflow: 'hidden',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                            e.currentTarget.style.transform = 'translateY(-4px)'
                            e.currentTarget.style.boxShadow = `0 8px 30px ${item.color}33`
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = 'none'
                        }}
                    >
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '14px',
                            background: `${item.color}22`, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '26px', marginBottom: '10px',
                        }}>
                            {item.icon}
                        </div>
                        <span style={{
                            color: '#fff', fontWeight: '600', fontSize: '14px',
                            marginBottom: '3px',
                        }}>
                            {item.label}
                        </span>
                        <span style={{
                            color: 'rgba(255,255,255,0.4)', fontSize: '11px',
                            textAlign: 'center',
                        }}>
                            {item.desc}
                        </span>
                    </Link>
                ))}
            </div>

            {/* Footer */}
            <div style={{
                textAlign: 'center', marginTop: '40px', padding: '0 20px',
                color: 'rgba(255,255,255,0.3)', fontSize: '12px',
            }}>
                <p style={{ margin: '0 0 4px' }}>© 2026 全方位水電維修 版權所有</p>
                <p style={{ margin: '0' }}>服務專線：0800-123-456</p>
            </div>
        </div>
    )
}
