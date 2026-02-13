import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext'

// ============ CSV 上傳遮罩頁面 ============
// 流程：選檔案 → 預覽欄位 → 勾選要遮罩的欄位 → 執行遮罩 → 下載結果
function CsvMask() {
    const { token } = useAuth()
    const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
    const [file, setFile] = useState(null)                // 選擇的檔案
    const [headers, setHeaders] = useState([])            // CSV 的欄位標題
    const [preview, setPreview] = useState([])             // 前 5 列預覽資料
    const [selectedColumns, setSelectedColumns] = useState([])  // 勾選了哪些欄位
    const [maskMethod, setMaskMethod] = useState('ai')    // 遮罩方式
    const [loading, setLoading] = useState(false)          // 是否正在處理
    const [step, setStep] = useState(1)                    // 目前在第幾步
    const [result, setResult] = useState(null)             // 遮罩結果

    // ============ Step 1：上傳檔案 → 預覽 ============
    const handleUpload = async () => {
        if (!file) return alert('請先選擇 CSV 檔案')

        setLoading(true)

        // FormData 是瀏覽器內建的物件，專門用來上傳檔案
        // 一般的 JSON 沒辦法傳檔案，要用 FormData
        const formData = new FormData()
        formData.append('file', file)

        try {
            const response = await fetch(`${API}/api/csv/preview`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                body: formData,
            })

            const data = await response.json()
            setHeaders(data.headers)
            setPreview(data.preview)
            setStep(2)    // 切換到 Step 2
        } catch (error) {
            console.error('上傳失敗:', error)
            alert('上傳失敗，請確認檔案格式')
        }

        setLoading(false)
    }

    // ============ 勾選/取消勾選欄位 ============
    const toggleColumn = (index) => {
        // 如果已經勾選了 → 取消（過濾掉）
        // 如果沒勾選 → 加入
        setSelectedColumns(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)    // 取消勾選
                : [...prev, index]                  // 加入勾選
        )
    }

    // 全選 / 全不選
    const toggleAll = () => {
        if (selectedColumns.length === headers.length) {
            setSelectedColumns([])          // 已全選 → 全取消
        } else {
            setSelectedColumns(headers.map((_, i) => i))  // 全選
        }
    }

    // ============ Step 3：執行遮罩 ============
    const handleMask = async () => {
        if (selectedColumns.length === 0) return alert('請至少選擇一個欄位')

        setLoading(true)

        const formData = new FormData()
        formData.append('file', file)
        formData.append('columns', JSON.stringify(selectedColumns))
        formData.append('mask_method', maskMethod)

        try {
            const response = await fetch(`${API}/api/csv/mask`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
                body: formData,
            })

            const data = await response.json()
            setResult(data)
            setStep(3)    // 切換到結果步驟
        } catch (error) {
            console.error('遮罩失敗:', error)
            alert('遮罩失敗，請稍後再試')
        }

        setLoading(false)
    }

    // ============ 下載遮罩後的 CSV ============
    const handleDownload = () => {
        if (!result) return

        // 透過 fetch 帶 token 下載
        fetch(`${API}/api/csv/download/${result.filename}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = result.filename
                a.click()
                window.URL.revokeObjectURL(url)
            })
    }

    // ============ 重新開始 ============
    const handleReset = () => {
        setFile(null)
        setHeaders([])
        setPreview([])
        setSelectedColumns([])
        setStep(1)
        setResult(null)
    }

    // ============ 畫面 ============
    return (
        <div className="container">
            <h1 className="page-title">📊 CSV / Excel 檔案遮罩</h1>
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: '-8px' }}>
                上傳 CSV 或 Excel 檔案，選擇要遮罩的欄位，下載遮罩後的檔案
            </p>

            <div style={{ marginBottom: '20px' }}>
                <Link to="/" className="btn btn-secondary">← 回到首頁</Link>
            </div>

            {/* ====== 步驟指示器 ====== */}
            <div className="steps-bar">
                <div className={`step-item ${step >= 1 ? 'active' : ''}`}>① 上傳檔案</div>
                <div className={`step-item ${step >= 2 ? 'active' : ''}`}>② 選擇欄位</div>
                <div className={`step-item ${step >= 3 ? 'active' : ''}`}>③ 下載結果</div>
            </div>

            {/* ====== Step 1：上傳檔案 ====== */}
            {step === 1 && (
                <div className="form-card">
                    <div className="form-group">
                        <label>選擇 CSV 或 Excel 檔案</label>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="form-input"
                            onChange={e => setFile(e.target.files[0])}
                        />
                    </div>

                    <div className="form-group">
                        <label>遮罩方式</label>
                        <select
                            className="form-input"
                            value={maskMethod}
                            onChange={e => setMaskMethod(e.target.value)}
                        >
                            <option value="ai">🤖 AI 智慧遮罩（推薦）</option>
                            <option value="regex">⚡ 正則遮罩（較快）</option>
                        </select>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleUpload}
                        disabled={loading || !file}
                        style={{ width: '100%' }}
                    >
                        {loading ? '上傳中...' : '📤 上傳並預覽'}
                    </button>
                </div>
            )}

            {/* ====== Step 2：選擇要遮罩的欄位 ====== */}
            {step === 2 && (
                <div className="form-card">
                    <h3 style={{ margin: '0 0 16px' }}>選擇要遮罩的欄位</h3>

                    {/* 全選按鈕 */}
                    <div style={{ marginBottom: '12px' }}>
                        <button className="btn btn-secondary" onClick={toggleAll}>
                            {selectedColumns.length === headers.length ? '全部取消' : '全部選取'}
                        </button>
                    </div>

                    {/* 欄位勾選列表 */}
                    <div className="column-select-grid">
                        {headers.map((header, index) => (
                            <label key={index} className="column-checkbox">
                                <input
                                    type="checkbox"
                                    checked={selectedColumns.includes(index)}
                                    onChange={() => toggleColumn(index)}
                                />
                                <span>{header}</span>
                            </label>
                        ))}
                    </div>

                    {/* 預覽表格 */}
                    <h4 style={{ margin: '20px 0 8px' }}>📋 資料預覽（前 5 列）</h4>
                    <div className="table-wrapper">
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    {headers.map((h, i) => (
                                        <th
                                            key={i}
                                            className={selectedColumns.includes(i) ? 'selected-col' : ''}
                                        >
                                            {selectedColumns.includes(i) && '🔒 '}{h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, rowIdx) => (
                                    <tr key={rowIdx}>
                                        {row.map((cell, cellIdx) => (
                                            <td
                                                key={cellIdx}
                                                className={selectedColumns.includes(cellIdx) ? 'selected-col' : ''}
                                            >
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* 操作按鈕 */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                        <button className="btn btn-secondary" onClick={handleReset}>
                            ← 重新選檔
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleMask}
                            disabled={loading || selectedColumns.length === 0}
                            style={{ flex: 1 }}
                        >
                            {loading ? '遮罩處理中...' : `🔒 對 ${selectedColumns.length} 個欄位執行遮罩`}
                        </button>
                    </div>
                </div>
            )}

            {/* ====== Step 3：遮罩完成，下載 ====== */}
            {step === 3 && result && (
                <div className="form-card">
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <p style={{ fontSize: '48px', margin: '0' }}>✅</p>
                        <h2 style={{ margin: '8px 0' }}>遮罩完成！</h2>
                        <p style={{ color: '#6b7280' }}>
                            已處理 {result.rows_processed} 列資料
                        </p>
                    </div>

                    {/* 偵測統計 */}
                    {Object.keys(result.stats).length > 0 && (
                        <div className="stats-badges" style={{ justifyContent: 'center', marginBottom: '20px' }}>
                            {Object.entries(result.stats).map(([type, count]) => (
                                <span key={type} className="stat-badge">{type} x{count}</span>
                            ))}
                        </div>
                    )}

                    {/* 下載按鈕 */}
                    <button
                        className="btn btn-primary"
                        onClick={handleDownload}
                        style={{ width: '100%', fontSize: '16px', padding: '14px' }}
                    >
                        📥 下載遮罩後的 CSV
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={handleReset}
                        style={{ width: '100%', marginTop: '12px' }}
                    >
                        🔄 處理另一個檔案
                    </button>
                </div>
            )}
        </div>
    )
}

export default CsvMask
