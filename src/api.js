// ===================================
// OpenAI API クライアント
// ===================================

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

/**
 * OpenAI APIを使用してクイズを生成
 * @returns {Promise<{category: string, question: string, options: string[], correctIndex: number, explanation: string}>}
 */
export async function generateQuiz() {
  const categories = [
    { name: '国語', topics: ['漢字の読み書き', '慣用句・ことわざ', '文学作品と作者', '敬語の使い方', '古文の基礎知識'] },
    { name: '算数・数学', topics: ['方程式', '図形の性質', '確率・統計', '関数とグラフ', '計算の工夫'] },
    { name: '理科', topics: ['電気と磁気', '植物のつくり', '化学反応', '地震・火山', '人体の仕組み', '天体・宇宙'] },
    { name: '社会（地理）', topics: ['世界の国々と首都', '日本の都道府県', '特産品・産業', '気候と地形'] },
    { name: '社会（歴史）', topics: ['江戸時代', '戦国武将', '明治維新', '世界史の出来事', '文化史'] },
    { name: '社会（公民）', topics: ['日本国憲法', '三権分立', '経済の仕組み', '国際機関'] },
    { name: '英語', topics: ['基本英単語', '英文法', '日常会話表現', '英語のことわざ'] },
    { name: '音楽', topics: ['有名な作曲家', '楽器の種類', '音楽用語'] },
    { name: '一般常識', topics: ['日本文化', 'スポーツ', '科学技術', '時事問題'] }
  ];

  const category = categories[Math.floor(Math.random() * categories.length)];
  const topic = category.topics[Math.floor(Math.random() * category.topics.length)];
  const randomSeed = Math.floor(Math.random() * 10000);

  const prompt = `あなたは日本の中学校教師です。以下の条件で4択クイズを1問だけ作成してください。

【条件】
- カテゴリ: ${category.name}
- トピック: ${topic}
- 難易度: 中学3年生までの一般常識レベル
- ランダムシード: ${randomSeed}（この数値を参考に、毎回違う問題を出題してください）

【重要】
- 必ず毎回異なる問題を作成すること
- 正解の位置（correctIndex）は0〜3でランダムにすること

以下のJSON形式のみで回答してください。説明文や装飾は不要です：
{"category":"${category.name}","question":"問題文","options":["選択肢A","選択肢B","選択肢C","選択肢D"],"correctIndex":0,"explanation":"解説文"}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたはクイズ生成AIです。指定されたJSON形式のみで回答してください。Markdownは使用しないでください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 1.0,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Response Error:', response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // JSONをパース（Markdownコードブロックが含まれる場合に対応）
    let jsonStr = content.trim();
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const quiz = JSON.parse(jsonStr);

    // バリデーション
    if (!quiz.question || !Array.isArray(quiz.options) || quiz.options.length !== 4) {
      throw new Error('Invalid quiz format');
    }

    return quiz;
  } catch (error) {
    console.error('Quiz generation error:', error);

    // フォールバック問題（様々なパターン）
    const fallbacks = [
      { category: '社会（地理）', question: '日本で一番高い山は？', options: ['富士山', '北岳', '奥穂高岳', '槍ヶ岳'], correctIndex: 0, explanation: '富士山は標高3,776mで日本一高い山です。' },
      { category: '理科', question: '水の化学式は？', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctIndex: 1, explanation: '水はH2O（水素2つと酸素1つ）で構成されています。' },
      { category: '社会（歴史）', question: '鎌倉幕府を開いた人物は？', options: ['源頼朝', '平清盛', '足利尊氏', '徳川家康'], correctIndex: 0, explanation: '源頼朝は1185年に鎌倉幕府を開きました。' },
      { category: '国語', question: '「急がば回れ」の意味は？', options: ['急いで走れ', '遠回りでも確実な道を選べ', '回り道をするな', '急いで回転しろ'], correctIndex: 1, explanation: '急いでいる時こそ、安全で確実な方法を取るべきという意味です。' },
      { category: '英語', question: '「Thank you」の意味は？', options: ['さようなら', 'こんにちは', 'ありがとう', 'おはよう'], correctIndex: 2, explanation: 'Thank youは感謝を表す英語表現です。' }
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}
