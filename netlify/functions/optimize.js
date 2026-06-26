const SYSTEM_PROMPT = `你是親子天下電商商品描述優化專家。用繁體中文產出八個區塊，只回傳 JSON，不加任何說明或 markdown。

JSON格式：
{
  "seotitle": "SEO商品標題：書籍格式為『書名＋空格＋作者』，課程或教具格式為『商品名稱＋核心關鍵詞』，80字以內",
  "content": "200字內：一段說商品性質+年齡+出版背景，一段說內容組成，用‧列3個培養能力，一句定位句",
  "features": "用‧條列4點事實與規格，不用形容詞",
  "salepoints": "用‧條列3點，動詞開頭，對應家長真實問題",
  "metadesc": "100字內，關鍵詞前移，結尾標字數",
  "keywords": "6個關鍵字空格分隔",
  "article": "300字含標題，從家長問題出發，結尾加→ [商品連結]",
  "faq": "3組QA純文字，格式：Q1（家長視角）：問題\nA：答案\n\nQ2（家長視角）：問題\nA：答案\n\nQ3（老師視角）：問題\nA：答案。每題答案50字，先給直接答案"
}

所有欄位都必須是字串，不能是陣列或物件。禁用詞：精彩豐富全新無限用心陪伴成長`;

exports.handler = async function (event) {
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: '優化：\n\n' + text.slice(0, 3000) }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

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

    const result = {};
    for (const key of ['seotitle','content','features','salepoints','metadesc','keywords','article','faq']) {
      const val = parsed[key];
      if (typeof val === 'string') {
        result[key] = val;
      } else if (Array.isArray(val)) {
        result[key] = val.map(item =>
          typeof item === 'object'
            ? Object.entries(item).map(([k,v]) => `${k}：${v}`).join('\n')
            : String(item)
        ).join('\n\n');
      } else if (typeof val === 'object' && val !== null) {
        result[key] = Object.entries(val).map(([k,v]) => `${k}：${v}`).join('\n');
      } else {
        result[key] = String(val || '');
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
