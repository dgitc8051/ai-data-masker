<?php                                                            
                                                                   
  namespace App\Services;                                          
                                                                   
  use Illuminate\Support\Facades\Http;                             
                                                                   
  class AiMaskService                                              
  {                                                                
      // Ollama API 位址（Docker 容器內連到本機）                  
      protected string $baseUrl =                                  
  'http://host.docker.internal:11434';                             
                                                                   
      /**                                                          
       * 偵測個資                                                  
       */                                                          
      public function detectPii(string $text): array               
      {                                                            
          // 給 AI 的提示詞                                        
          $prompt = "分析以下文字，找出所有個人資料（PII），並以   
  JSON 格式回傳。                                                  
  只回傳 JSON，不要有其他文字。                                    
                                                                   
  格式範例：                                                       
  {\"items\": [{\"text\": \"0912345678\", \"type\": \"phone\"},    
  {\"text\": \"wang@gmail.com\", \"type\": \"email\"}]}            
                                                                   
  類型包含：phone, email, id_card, credit_card, name, address      
                                                                   
  文字內容：                                                       
  {$text}";                                                        
                                                                   
          // 發送 POST 請求給 Ollama API                           
          $response =                                              
  Http::timeout(60)->post("{$this->baseUrl}/api/generate", [       
              'model' => 'llama3.2',                               
              'prompt' => $prompt,                                 
              'stream' => false,                                   
          ]);                                                      
                                                                   
          // 取得 AI 回傳的文字                                    
          $result = $response->json('response', '');               
                                                                   
          // 用正則取出 JSON 部分                                  
          preg_match('/\{.*\}/s', $result, $matches);              
                                                                   
          if (!empty($matches[0])) {                               
              $decoded = json_decode($matches[0], true);           
              return $decoded['items'] ?? [];                      
          }                                                        
                                                                   
          return [];                                               
      }                                                            
                                                                   
      /**                                                          
       * 用 AI 執行遮罩                                            
       */                                                          
      public function maskWithAi(string $text): array              
      {                                                            
          $piiItems = $this->detectPii($text);                     
          $masked = $text;                                         
                                                                   
          // 類型對應的中文標籤                                    
          $typeLabels = [                                          
              'phone' => '電話',                                   
              'email' => 'Email',                                  
              'id_card' => '身分證',                               
              'credit_card' => '信用卡',                           
              'name' => '姓名',                                    
              'address' => '地址',                                 
          ];                                                       
                                                                   
          // 遍歷每個個資並替換                                    
          foreach ($piiItems as $item) {                           
              $label = $typeLabels[$item['type']] ?? '個資';       
              $masked = str_replace($item['text'], "[{$label}]",   
  $masked);                                                        
          }                                                        
                                                                   
          return [                                                 
              'masked' => $masked,                                 
              'detected' => $piiItems,                             
          ];                                                       
      }                                                            
  }                        