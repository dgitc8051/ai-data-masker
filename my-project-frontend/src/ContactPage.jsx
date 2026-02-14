import { Link } from 'react-router-dom'

export default function ContactPage() {
    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2439 100%)',
            padding: '20px 16px 40px',
        }}>
            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                <Link to="/home" style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                    textDecoration: 'none', display: 'inline-block', marginBottom: '16px',
                }}>← 返回首頁</Link>

                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>📞</div>
                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 6px', fontWeight: '700' }}>
                        關於與聯絡
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                        認識我們・聯繫方式
                    </p>
                </div>

                {/* 公司簡介 */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                    padding: '24px', marginBottom: '14px',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 12px', fontWeight: '700' }}>
                        🏢 公司簡介
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.8', margin: 0 }}>
                        全方位水電維修成立於 2010 年，深耕大台北地區超過 15 年，
                        擁有逾 50 位持照專業技師，累積服務超過 10 萬戶家庭。
                        我們秉持「快速、透明、安心」的服務理念，
                        全年無休為您的居家安全把關。
                    </p>
                </div>

                {/* 數據亮點 */}
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px', marginBottom: '14px',
                }}>
                    {[
                        { num: '15+', label: '年服務經驗' },
                        { num: '50+', label: '專業技師' },
                        { num: '100K+', label: '服務家庭' },
                    ].map((s, i) => (
                        <div key={i} style={{
                            background: 'rgba(255,255,255,0.06)', borderRadius: '12px',
                            padding: '18px 10px', textAlign: 'center',
                            border: '1px solid rgba(255,255,255,0.08)',
                        }}>
                            <div style={{ color: '#60a5fa', fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>
                                {s.num}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                                {s.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* 服務理念 */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                    padding: '24px', marginBottom: '20px',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <h3 style={{ color: '#fff', fontSize: '17px', margin: '0 0 16px', fontWeight: '700' }}>
                        💎 服務理念
                    </h3>
                    {[
                        { icon: '⚡', title: '快速到府', desc: '一小時內回覆，當日安排維修' },
                        { icon: '💰', title: '透明報價', desc: '到府檢測，維修前告知費用' },
                        { icon: '🛡️', title: '品質保固', desc: '施工後提供 1 年保固服務' },
                        { icon: '👨‍🔧', title: '持照技師', desc: '全員持有甲級水電技術士證照' },
                    ].map((v, i) => (
                        <div key={i} style={{
                            display: 'flex', gap: '12px', alignItems: 'flex-start',
                            marginBottom: i < 3 ? '14px' : 0,
                        }}>
                            <div style={{ fontSize: '22px', flexShrink: 0 }}>{v.icon}</div>
                            <div>
                                <div style={{ color: '#fff', fontSize: '14px', fontWeight: '600', marginBottom: '2px' }}>{v.title}</div>
                                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px' }}>{v.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 分隔線 */}
                <div style={{
                    height: '1px', background: 'rgba(255,255,255,0.1)',
                    margin: '8px 0 24px',
                }} />

                <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 16px', textAlign: 'center' }}>
                    📋 聯繫方式
                </h2>

                {/* 聯絡資訊卡片 */}
                {[
                    { icon: '📱', title: '服務專線', content: '0800-123-456', sub: '24 小時接聽' },
                    { icon: '📞', title: '市話', content: '02-2345-6789', sub: '營業時間內接聽' },
                    { icon: '📍', title: '服務地址', content: '台北市大安區忠孝東路三段 123 號', sub: '近捷運忠孝復興站' },
                    { icon: '🕐', title: '營業時間', content: '週一至週六 08:00 - 20:00', sub: '週日及國定假日休息' },
                    { icon: '📧', title: 'Email', content: 'service@repair-demo.com', sub: '工作日 24 小時內回覆' },
                    { icon: '💬', title: 'LINE 官方帳號', content: '@repair-demo', sub: '加好友享線上報修' },
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

                {/* CTA */}
                <Link to="/repair" style={{
                    display: 'block', textAlign: 'center', padding: '16px',
                    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                    borderRadius: '14px', color: '#fff', fontSize: '16px',
                    fontWeight: '700', textDecoration: 'none', marginTop: '16px',
                }}>
                    📞 立即預約維修
                </Link>
            </div>
        </div>
    )
}
