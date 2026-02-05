import { useState } from 'react'  // React 的 Hook，用來管理狀態
import './App.css'

function App() {
  // ============ 狀態管理 ============
  // useState 會回傳 [目前的值, 修改值的函數]
  const [inputText, setInputText] = useState('')      // 使用者輸入的文字
  const [maskedText, setMaskedText] = useState('')    // 遮罩後的結果
  const [loading, setLoading] = useState(false)       // 是否正在載入
  const [stats, setStats] = useState({})
  const [purpose, setPurpose] = useState('內部使用')
  const [maskTypes, setMaskTypes] = useState({
    phone: true,      // 電話                                   
    email: true,      // Email                                  
    idCard: true,     // 身分證                                 
    creditCard: true, // 信用卡                                 
    account: true,    // 帳號                                   
    address: true,    // 地址                                   
  })

  // ============ 範例文字 ============
  // 定義一個包含各種個資類型的範例，讓使用者可以快速測試
  // 使用模板字串（反引號 ``）可以建立多行文字
  const exampleText = `王小明的手機:0912-345-678
市話:02-12345678
Email:abc@gmail.com
身分證:A123456789
信用卡:1234-5678-9012-3456
帳號:12345678901
地址:台北市中正區忠孝東路100號`;

  // ============ 呼叫 API 的函數 ============
  const handleMask = async () => {
    setLoading(true)  // 開始載入

    try {
      // 發送 POST 請求到 Laravel API
      const response = await fetch('https://helpful-spirit-production.up.railway.app/api/mask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',  // 告訴後端我們送的是 JSON
        },
        body: JSON.stringify({ text: inputText, types: maskTypes, purpose: purpose }),  // 把輸入的文字轉成 JSON 送出
      })

      const data = await response.json()  // 解析回傳的 JSON
      setMaskedText(data.masked)          // 把遮罩結果存到狀態
      setStats(data.stats || {})
    } catch (error) {
      console.error('錯誤:', error)
      setMaskedText('發生錯誤，請確認 API 是否運行中')
    }

    setLoading(false)  // 結束載入
  }

  // ============ AI 遮罩函數 ============                       
  const handleAiMask = async () => {
    setLoading(true)
    try {
      const response = await
        fetch('https://helpful-spirit-production.up.railway.app/api/mask-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: inputText }),
        })
      const data = await response.json()
      setMaskedText(data.masked)
      setStats({ 'AI偵測': data.detected.length })
    } catch (error) {
      console.error('錯誤:', error)
      setMaskedText('發生錯誤')
    }
    setLoading(false)
  }

  // ============ 畫面渲染 ============
  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">                                                                                 
      <div className="max-w-2xl mx-auto">
        {/* 標題卡片 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">個資遮罩工具</h1>
          <p className="text-gray-600">
            自動偵測文字中的敏感個人資訊，並將其替換為遮罩文字。
          </p>
        </div>

        {/* 輸入區塊 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            輸入包含個資的文字：
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="點擊「產生範例」按鈕可快速填入測試資料"
            rows={5}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent
  resize-none"
          />
          <button
            onClick={() => setInputText(exampleText)}
            className="mt-2 px-4 py-2 bg-gray-500 text-black rounded-lg hover:bg-gray-600 transition"
          >
            產生範例
          </button>
        </div>

        {/* 選項區塊 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            選擇要遮罩的類型：
          </label>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { key: 'phone', label: '電話' },
              { key: 'email', label: 'Email' },
              { key: 'idCard', label: '身分證' },
              { key: 'creditCard', label: '信用卡' },
              { key: 'account', label: '帳號' },
              { key: 'address', label: '地址' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maskTypes[key]}
                  onChange={(e) => setMaskTypes({ ...maskTypes, [key]: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <label className="block text-sm font-medium text-gray-700 mb-2">
            使用用途：
          </label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="內部使用">內部使用</option>
            <option value="分享給工程">分享給工程</option>
            <option value="教育訓練">教育訓練</option>
            <option value="對外文件">對外文件</option>
          </select>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handleMask}
            disabled={loading || !inputText}
            className="flex-1 py-3 bg-blue-600 text-black rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300
  disabled:cursor-not-allowed transition"
          >
            {loading ? '處理中...' : '一鍵遮罩'}
          </button>
          <button
            onClick={handleAiMask}
            disabled={loading || !inputText}
            className="flex-1 py-3 bg-purple-600 text-black rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300
  disabled:cursor-not-allowed transition"
          >
            {loading ? '處理中...' : 'AI 智慧遮罩'}
          </button>
        </div>

        {/* 統計結果 */}
        {Object.keys(stats).length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <span className="font-medium text-green-800">偵測結果：</span>
            <span className="text-green-700 ml-2">
              {Object.entries(stats).map(([type, count]) => `${type} x${count}`).join('、')}
            </span>
          </div>
        )}

        {/* 輸出區塊 */}
        {maskedText && (
          <div className="bg-black rounded-lg shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              遮罩結果：
            </label>
            <textarea
              value={maskedText}
              readOnly
              rows={5}
              className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 resize-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(maskedText)
                alert('已複製到剪貼簿！')
              }}
              className="mt-2 px-4 py-2 bg-green-600 text-black rounded-lg hover:bg-green-700 transition"
            >
              複製結果
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App