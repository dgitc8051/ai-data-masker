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

    // ============ 呼叫 API 的函數 ============
    const handleMask = async () => {
      setLoading(true)  // 開始載入

      try {
        // 發送 POST 請求到 Laravel API
        const response = await fetch('http://localhost:8080/api/mask', {
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
  fetch('http://localhost:8080/api/mask-ai', {                     
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
      <div className="container">
        <h1>個資遮罩工具</h1>

        {/* 輸入區塊 */}
        <div className="input-section">
          <label>輸入包含個資的文字：</label>
          <textarea
            value={inputText}                           // 綁定狀態
            onChange={(e) => setInputText(e.target.value)}  // 輸入時更新狀態
            placeholder="例如：王小明的電話是0912345678，身分證A123456789"
            rows={5}
          />
        </div>

         {/* 遮罩類型選擇 */}                                          
  <div className="mask-options">                                
    <label>選擇要遮罩的類型：</label>                           
    <div className="checkbox-group">                            
      <label>                                                   
        <input                                                  
          type="checkbox"                                       
          checked={maskTypes.phone}                             
          onChange={(e) => setMaskTypes({...maskTypes, phone:   
  e.target.checked})}                                           
        /> 電話                                                 
      </label>                                                  
      <label>                                                   
        <input                                                  
          type="checkbox"                                       
          checked={maskTypes.email}                             
          onChange={(e) => setMaskTypes({...maskTypes, email:   
  e.target.checked})}                                           
        /> Email                                                
      </label>                                                  
      <label>                                                   
        <input                                                  
          type="checkbox"                                       
          checked={maskTypes.idCard}                            
          onChange={(e) => setMaskTypes({...maskTypes, idCard:  
  e.target.checked})}                                           
        /> 身分證                                               
      </label>                                                  
      <label>                                                   
        <input                                                  
          type="checkbox"                                       
          checked={maskTypes.creditCard}                        
          onChange={(e) => setMaskTypes({...maskTypes,          
  creditCard: e.target.checked})}                               
        /> 信用卡                                               
      </label>                                                  
      <label>                                                   
        <input                                                  
          type="checkbox"                                       
          checked={maskTypes.account}                           
          onChange={(e) => setMaskTypes({...maskTypes, account: 
  e.target.checked})}                                           
        /> 帳號                                                 
      </label>                                                  
      <label>                                                   
        <input                                                  
          type="checkbox"                                       
          checked={maskTypes.address}                           
          onChange={(e) => setMaskTypes({...maskTypes, address: 
  e.target.checked})}                                           
        /> 地址                                                 
      </label>                                                  
    </div>                                                      
  </div>       
  {/* 用途選擇 */}                                                                
  <div className="purpose-section">                                               
    <label>使用用途：</label>                                                     
    <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>         
      <option value="內部使用">內部使用</option>                                  
      <option value="分享給工程">分享給工程</option>                              
      <option value="教育訓練">教育訓練</option>                                  
      <option value="對外文件">對外文件</option>                                  
    </select>                                                                     
  </div>     

        {/* 按鈕：loading 或沒輸入時停用 */}
        <button onClick={handleMask} disabled={loading || !inputText}>
          {loading ? '處理中...' : '一鍵遮罩'}
        </button>
          <button onClick={handleAiMask} disabled={loading || !inputText}> 
    {loading ? '處理中...' : 'AI 智慧遮罩'}                        
  </button>  

{/* 統計結果 */}                                                       
  {Object.keys(stats).length > 0 && (                                    
    <div className="stats-section">                                      
      <label>偵測結果：</label>                                          
      <span>                                                             
        {Object.entries(stats).map(([type, count]) => `${type}           
  x${count}`).join('、')}                                                
      </span>                                                            
    </div>                                                               
  )}                 


        {/* 輸出區塊：有結果才顯示 */}
        {maskedText && (
          <div className="output-section">
            <label>遮罩結果：</label>
            <textarea value={maskedText} readOnly rows={5} />

             {/* 新增：複製按鈕 */}
    <button 
        onClick={() => {
          navigator.clipboard.writeText(maskedText)
          alert('已複製到剪貼簿！')
        }}
        className="copy-btn"
      >
        複製結果
      </button>
          </div>
        )}
      </div>
    )
  }

  export default App