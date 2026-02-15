import { useEffect, useState } from 'react'
import liff from '@line/liff'

/**
 * LIFF 關閉按鈕 - 右上角 X
 * 只有在 LIFF 環境中才會顯示
 */
export default function LiffCloseButton() {
    const [inLiff, setInLiff] = useState(false)

    useEffect(() => {
        // 檢查是否在 LIFF 環境中
        try {
            if (liff.isInClient && liff.isInClient()) {
                setInLiff(true)
            }
        } catch (e) {
            // LIFF 未初始化時忽略
        }
    }, [])

    if (!inLiff) return null

    return (
        <button
            onClick={() => {
                try { liff.closeWindow() } catch (e) { window.close() }
            }}
            style={{
                position: 'fixed', top: '12px', right: '12px', zIndex: 9999,
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'rgba(0,0,0,0.5)', border: 'none',
                color: '#fff', fontSize: '18px', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', backdropFilter: 'blur(4px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            aria-label="關閉"
        >
            ✕
        </button>
    )
}
