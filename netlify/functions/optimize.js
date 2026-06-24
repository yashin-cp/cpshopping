const SYSTEM_PROMPT = `你是親子天下電商商品描述優化專家。使用者會貼上商品原始描述，你必須產出以下七個區塊，使用繁體中文，格式嚴格按照指示。

請用 JSON 格式回覆，包含以下七個欄位：
{
  "content": "商品內文（AI友善版）200-300字，四段結構：第一段說清楚刊物性質+適讀年齡+出版背景；第二段具體說明內容組成；第三段用‧符號列出3-5個培養能力；第四段一句定位句",
  "features": "商品特色，用‧符號條列4-6點，全部用事實與名詞，不寫幫助培養等動作動詞",
  "salepoints": "銷售重點，用‧符號條列3-5點，每點動詞開頭，場景具體，對應家長真實問題",
  "metadesc": "Meta Description，120字以內一段連續文字，核心關鍵詞前移，結尾加字數統計",
  "keywords": "8個關鍵字以空格分隔，涵蓋刊物名稱x2、年齡受眾x2、能力主題x2、場景需求x2",
  "article": "導購短文400-600字含標題，第一段從家長問題出發，第二段介紹商品內容，第三段說孩子學到什麼，第四段說適合誰，結尾購買引導句",
  "faq": "5組QA，家長視角3題、老師視角2題，每題答案80-120字，先給直接答案再補充細節"
}

改寫原則：形容詞換成動詞+具體數字；禁用詞：精彩、豐富、全新體驗、立即訂閱、開啟、無限、用心、陪伴成長；只回傳 JSON，不要加任何說明文字或 markdown 符號。`;

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { text } = body;
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing text field' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key not configured on server' })
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: '請優化以下商品描述：\n\n' + text }],
      }),
    });

    const data = await response.json();
    if (data.error) {
      return {
        statusCode: 502,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.error.message })
      };
    }

    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
