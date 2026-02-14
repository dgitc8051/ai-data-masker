import { Link } from 'react-router-dom'

const PRICING_DATA = [
    {
        category: '水管',
        color: '#3b82f6',
        icon: '🚿',
        items: [
            { name: '水龍頭更換', price: '$800 - 1,500' },
            { name: '馬桶阻塞排除', price: '$1,000 - 2,500' },
            { name: '水管漏水修繕', price: '$1,500 - 5,000' },
            { name: '水管重新配管', price: '$3,000 - 10,000' },
        ],
    },
    {
        category: '電路',
        color: '#f59e0b',
        icon: '⚡',
        items: [
            { name: '插座/開關更換', price: '$500 - 1,200' },
            { name: '跳電/短路檢修', price: '$800 - 2,000' },
            { name: '電線重拉', price: '$2,000 - 8,000' },
            { name: '配電盤檢修', price: '$1,500 - 4,000' },
        ],
    },
    {
        category: '冷氣',
        color: '#06b6d4',
        icon: '❄️',
        items: [
            { name: '清洗保養（壁掛）', price: '$2,000 - 3,500' },
            { name: '清洗保養（吊隱）', price: '$3,500 - 5,000' },
            { name: '冷媒填充', price: '$2,500 - 4,000' },
            { name: '不冷/異音檢修', price: '$1,000 - 3,000' },
        ],
    },
    {
        category: '熱水器',
        color: '#ef4444',
        icon: '🔥',
        items: [
            { name: '點火故障檢修', price: '$800 - 2,000' },
            { name: '零件更換', price: '$1,000 - 3,000' },
            { name: '整台更換（含安裝）', price: '$8,000 - 15,000' },
        ],
    },
]

const DISTANCE_DATA = [
    { zone: '台北市中心', surcharge: '免加成', color: '#10b981' },
    { zone: '新北市', surcharge: '+$200', color: '#f59e0b' },
    { zone: '桃園 / 基隆', surcharge: '+$500', color: '#f97316' },
    { zone: '其他地區', surcharge: '另行報價', color: '#6b7280' },
]

export default function PricingPage() {
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
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>💰</div>
                    <h1 style={{ color: '#fff', fontSize: '24px', margin: '0 0 6px', fontWeight: '700' }}>
                        費用參考
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                        基礎檢測費 + 維修行情參考
                    </p>
                </div>

                {/* 基礎檢測費 */}
                <div style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                    borderRadius: '16px', padding: '24px', marginBottom: '16px',
                    border: '1px solid rgba(99,102,241,0.3)',
                    textAlign: 'center',
                }}>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>
                        🔍 到府基礎檢測費
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: '800', color: '#fff', marginBottom: '6px' }}>
                        $300
                    </div>
                    <div style={{
                        display: 'inline-block', padding: '4px 14px', borderRadius: '20px',
                        background: 'rgba(16,185,129,0.2)', color: '#34d399', fontSize: '13px', fontWeight: '600',
                    }}>
                        ✅ 維修即折抵工資
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', margin: '12px 0 0', lineHeight: '1.6' }}>
                        師傅到場檢查問題後報價，同意維修則檢測費折抵<br />
                        若僅檢測不維修，僅收取基礎檢測費
                    </p>
                </div>

                {/* 距離加成 */}
                <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                    padding: '20px', marginBottom: '20px',
                    border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <h3 style={{ color: '#fff', fontSize: '15px', margin: '0 0 14px', fontWeight: '700' }}>
                        🚗 距離加成
                    </h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {DISTANCE_DATA.map((d, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px',
                            }}>
                                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{d.zone}</span>
                                <span style={{ color: d.color, fontWeight: '700', fontSize: '14px' }}>{d.surcharge}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 各類維修價格 */}
                <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '700', margin: '0 0 16px', textAlign: 'center' }}>
                    🔧 常見維修參考價格
                </h2>

                {PRICING_DATA.map((cat, ci) => (
                    <div key={ci} style={{
                        background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
                        padding: '20px', marginBottom: '12px',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px',
                        }}>
                            <div style={{
                                width: '36px', height: '36px', borderRadius: '10px',
                                background: `${cat.color}22`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                            }}>{cat.icon}</div>
                            <h3 style={{ color: cat.color, fontSize: '16px', margin: 0, fontWeight: '700' }}>
                                {cat.category}
                            </h3>
                        </div>

                        <div style={{ display: 'grid', gap: '6px' }}>
                            {cat.items.map((item, ii) => (
                                <div key={ii} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px',
                                }}>
                                    <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{item.name}</span>
                                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{item.price}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {/* 注意事項 */}
                <div style={{
                    background: 'rgba(245,158,11,0.1)', borderRadius: '12px',
                    padding: '16px 18px', marginTop: '8px',
                    border: '1px solid rgba(245,158,11,0.2)',
                }}>
                    <div style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600', marginBottom: '8px' }}>
                        ⚠️ 注意事項
                    </div>
                    <ul style={{
                        color: 'rgba(255,255,255,0.5)', fontSize: '12px', lineHeight: '1.8',
                        margin: 0, paddingLeft: '16px',
                    }}>
                        <li>以上為參考價格，實際費用依現場狀況報價</li>
                        <li>師傅到場後會先檢測並報價，確認後才施工</li>
                        <li>所有價格皆為未稅價</li>
                        <li>特殊零件需另計材料費</li>
                    </ul>
                </div>

                {/* CTA */}
                <div style={{ display: 'grid', gap: '10px', marginTop: '20px' }}>
                    <Link to="/repair" style={{
                        display: 'block', textAlign: 'center', padding: '16px',
                        background: 'linear-gradient(135deg, #ef4444, #f97316)',
                        borderRadius: '14px', color: '#fff', fontSize: '16px',
                        fontWeight: '700', textDecoration: 'none',
                    }}>
                        🔧 立即報修
                    </Link>
                    <Link to="/contact" style={{
                        display: 'block', textAlign: 'center', padding: '14px',
                        background: 'rgba(255,255,255,0.08)', borderRadius: '14px',
                        color: 'rgba(255,255,255,0.7)', fontSize: '14px',
                        fontWeight: '600', textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        📞 聯繫客服詢問詳細報價
                    </Link>
                </div>
            </div>
        </div>
    )
}
