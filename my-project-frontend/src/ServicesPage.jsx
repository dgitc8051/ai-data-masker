import { Link } from 'react-router-dom'
import LiffCloseButton from './LiffCloseButton'

const services = [
    {
        icon: '🚿', title: '水管維修',
        items: ['水管漏水', '馬桶阻塞', '水龍頭更換', '熱水器安裝', '排水管疏通'],
        color: '#3b82f6',
    },
    {
        icon: '💡', title: '電路維修',
        items: ['插座故障', '跳電處理', '配線檢修', '照明安裝', '電表更換'],
        color: '#f59e0b',
    },
    {
        icon: '❄️', title: '冷氣空調',
        items: ['冷氣安裝', '冷氣清洗', '冷氣維修', '冷媒補充', '移機服務'],
        color: '#06b6d4',
    },
    {
        icon: '🔨', title: '居家修繕',
        items: ['門窗維修', '牆面修補', '地板維修', '油漆粉刷', '防水工程'],
        color: '#8b5cf6',
    },
    {
        icon: '🏗️', title: '裝潢拆除',
        items: ['舊屋翻新', '隔間拆除', '廚房改造', '浴室翻修', '系統櫃安裝'],
        color: '#ef4444',
    },
    {
        icon: '🔧', title: '其他服務',
        items: ['鐵捲門維修', '監視器安裝', '對講機維修', '鎖具更換', '緊急搶修'],
        color: '#10b981',
    },
]

export default function ServicesPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
            padding: '20px 16px 40px',
        }}>
            <LiffCloseButton />
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                <Link to="/home" style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                    textDecoration: 'none', display: 'inline-block', marginBottom: '16px',
                }}>← 返回首頁</Link>

                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>🛠️</div>
                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 6px', fontWeight: '700' }}>
                        服務項目
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                        專業團隊，全方位居家維修服務
                    </p>
                </div>

                {services.map((svc, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                        padding: '20px', marginBottom: '12px',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                fontSize: '24px', width: '44px', height: '44px', borderRadius: '12px',
                                background: `${svc.color}22`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>{svc.icon}</div>
                            <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: '700', margin: 0 }}>
                                {svc.title}
                            </h3>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {svc.items.map((item, j) => (
                                <span key={j} style={{
                                    padding: '4px 12px', borderRadius: '8px', fontSize: '13px',
                                    background: `${svc.color}18`, color: svc.color,
                                }}>
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}

                {/* CTA */}
                <Link to="/repair" style={{
                    display: 'block', textAlign: 'center', padding: '16px',
                    background: 'linear-gradient(135deg, #ef4444, #f97316)',
                    borderRadius: '14px', color: '#fff', fontSize: '16px',
                    fontWeight: '700', textDecoration: 'none', marginTop: '20px',
                }}>
                    🔧 立即線上報修
                </Link>
            </div>
        </div>
    )
}
