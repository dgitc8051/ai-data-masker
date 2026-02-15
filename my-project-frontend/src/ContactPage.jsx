import { Link } from 'react-router-dom'
import LiffCloseButton from './LiffCloseButton'

export default function ContactPage() {
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
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>📞</div>
                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 6px', fontWeight: '700' }}>
                        聯絡我們
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                        歡迎來電或來店諮詢
                    </p>
                </div>

                {/* Contact Cards */}
                {[
                    { icon: '📱', title: '服務專線', content: '0800-123-456', sub: '24 小時接聽' },
                    { icon: '📞', title: '市話', content: '02-2345-6789', sub: '營業時間內接聽' },
                    { icon: '📍', title: '服務地址', content: '台北市大安區忠孝東路三段 123 號', sub: '近捷運忠孝復興站' },
                    { icon: '🕐', title: '營業時間', content: '週一至週六 08:00 - 20:00', sub: '週日及國定假日休息' },
                    { icon: '📧', title: 'Email', content: 'service@repair-demo.com', sub: '工作日 24 小時內回覆' },
                    { icon: '💬', title: 'LINE 官方帳號', content: '@962zuxtq', sub: '加好友享線上報修' },
                ].map((item, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                        padding: '18px 20px', marginBottom: '10px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'flex-start', gap: '14px',
                    }}>
                        <div style={{
                            fontSize: '24px', width: '44px', height: '44px',
                            borderRadius: '12px', background: 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>{item.icon}</div>
                        <div>
                            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '4px' }}>
                                {item.title}
                            </div>
                            <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>
                                {item.content}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                                {item.sub}
                            </div>
                        </div>
                    </div>
                ))}


            </div>
        </div>
    )
}
