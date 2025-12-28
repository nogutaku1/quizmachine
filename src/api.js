// ===================================
// OpenAI API クライアント（重複防止機能付き）
// ===================================

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// 出題済み問題の追跡用（セッション中の重複防止）
const ASKED_QUESTIONS_KEY = 'quizmachine_asked_questions';

/**
 * 問題のハッシュを生成（重複判定用）
 */
function hashQuestion(question) {
  // 問題文から空白を除去して正規化
  const normalized = question.replace(/\s+/g, '').toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  return hash.toString();
}

/**
 * 出題済み問題リストを取得
 */
function getAskedQuestions() {
  try {
    const stored = sessionStorage.getItem(ASKED_QUESTIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * 出題済み問題リストに追加
 */
function addAskedQuestion(questionHash) {
  try {
    const asked = getAskedQuestions();
    asked.push(questionHash);
    // 最新1000問のみ保持（メモリ節約）
    if (asked.length > 1000) {
      asked.shift();
    }
    sessionStorage.setItem(ASKED_QUESTIONS_KEY, JSON.stringify(asked));
  } catch (e) {
    console.warn('Failed to save asked question:', e);
  }
}

/**
 * 問題が出題済みかどうかをチェック
 */
function isQuestionAsked(question) {
  const hash = hashQuestion(question);
  const asked = getAskedQuestions();
  return asked.includes(hash);
}

/**
 * ゲーム開始時に出題履歴をリセット
 */
export function resetAskedQuestions() {
  try {
    sessionStorage.removeItem(ASKED_QUESTIONS_KEY);
    console.log('Asked questions history cleared');
  } catch (e) {
    console.warn('Failed to clear asked questions:', e);
  }
}

/**
 * 出題済み問題数を取得
 */
export function getAskedQuestionsCount() {
  return getAskedQuestions().length;
}

/**
 * OpenAI APIを使用してクイズを生成（重複防止付き）
 * @param {number} retryCount - リトライ回数（内部使用）
 * @returns {Promise<{category: string, question: string, options: string[], correctIndex: number, explanation: string}>}
 */
export async function generateQuiz(retryCount = 0) {
  const MAX_RETRIES = 3; // 重複時の最大リトライ回数

  const categories = [
    { name: '国語', topics: ['漢字の読み書き', '慣用句・ことわざ', '文学作品と作者', '敬語の使い方', '古文の基礎知識', '四字熟語', '類義語・対義語', '文法'] },
    { name: '算数・数学', topics: ['方程式', '図形の性質', '確率・統計', '関数とグラフ', '計算の工夫', '比例・反比例', '平方根', '三角形と角度'] },
    { name: '理科', topics: ['電気と磁気', '植物のつくり', '化学反応', '地震・火山', '人体の仕組み', '天体・宇宙', '光と音', '物質の状態変化', '遺伝と細胞'] },
    { name: '社会（地理）', topics: ['世界の国々と首都', '日本の都道府県', '特産品・産業', '気候と地形', '河川と海流', '農業・工業地帯', '人口と都市'] },
    { name: '社会（歴史）', topics: ['江戸時代', '戦国武将', '明治維新', '世界史の出来事', '文化史', '古代文明', '鎌倉・室町時代', '近代日本', '第二次世界大戦'] },
    { name: '社会（公民）', topics: ['日本国憲法', '三権分立', '経済の仕組み', '国際機関', '選挙制度', '地方自治', '基本的人権'] },
    { name: '英語', topics: ['基本英単語', '英文法', '日常会話表現', '英語のことわざ', '前置詞', '時制', '比較級・最上級'] },
    { name: '音楽', topics: ['有名な作曲家', '楽器の種類', '音楽用語', '日本の伝統音楽', '世界の民族音楽'] },
    { name: '保健体育', topics: ['オリンピック', 'スポーツのルール', '健康と栄養', '有名なアスリート'] },
    { name: '美術', topics: ['有名な画家と作品', '美術用語', '日本の伝統芸術', '色彩の基礎'] },
    { name: '一般常識', topics: ['日本文化', 'スポーツ', '科学技術', '時事問題', '世界の文化', '食文化', '環境問題'] }
  ];

  const category = categories[Math.floor(Math.random() * categories.length)];
  const topic = category.topics[Math.floor(Math.random() * category.topics.length)];
  const randomSeed = Math.floor(Math.random() * 100000);
  const askedCount = getAskedQuestionsCount();

  const prompt = `あなたは日本の中学校教師です。以下の条件で4択クイズを1問だけ作成してください。

【条件】
- カテゴリ: ${category.name}
- トピック: ${topic}
- 難易度: 中学3年生までの一般常識レベル
- ランダムシード: ${randomSeed}
- 出題済み問題数: ${askedCount}（これまでと異なる問題を必ず出題すること）

【重要】
- 絶対に過去に出題されていない新しい問題を作成すること
- 問題は具体的で明確であること
- 正解の位置（correctIndex）は0〜3でランダムにすること
- 間違いの選択肢も合理的なものにすること

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
            content: 'あなたはクイズ生成AIです。指定されたJSON形式のみで回答してください。Markdownは使用しないでください。毎回必ず異なる問題を生成してください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 1.2, // 多様性を高めるために温度を上げる
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

    // 重複チェック
    if (isQuestionAsked(quiz.question)) {
      console.log(`Duplicate question detected (attempt ${retryCount + 1}/${MAX_RETRIES}): ${quiz.question.substring(0, 30)}...`);

      if (retryCount < MAX_RETRIES) {
        // リトライ
        return generateQuiz(retryCount + 1);
      }
      // 最大リトライ超えたらそのまま使用（完全な重複防止は難しいため）
      console.warn('Max retries reached, using potentially duplicate question');
    }

    // 出題済みリストに追加
    addAskedQuestion(hashQuestion(quiz.question));

    return shuffleQuiz(quiz);
  } catch (error) {
    console.error('Quiz generation error:', error);

    // フォールバック問題（様々なパターン）
    const fallbacks = [
      { category: '社会（地理）', question: '日本で一番高い山は？', options: ['富士山', '北岳', '奥穂高岳', '槍ヶ岳'], correctIndex: 0, explanation: '富士山は標高3,776mで日本一高い山です。' },
      { category: '理科', question: '水の化学式は？', options: ['CO2', 'H2O', 'NaCl', 'O2'], correctIndex: 1, explanation: '水はH2O（水素2つと酸素1つ）で構成されています。' },
      { category: '社会（歴史）', question: '鎌倉幕府を開いた人物は？', options: ['源頼朝', '平清盛', '足利尊氏', '徳川家康'], correctIndex: 0, explanation: '源頼朝は1185年に鎌倉幕府を開きました。' },
      { category: '国語', question: '「急がば回れ」の意味は？', options: ['急いで走れ', '遠回りでも確実な道を選べ', '回り道をするな', '急いで回転しろ'], correctIndex: 1, explanation: '急いでいる時こそ、安全で確実な方法を取るべきという意味です。' },
      { category: '英語', question: '「Thank you」の意味は？', options: ['さようにら', 'こんにちは', 'ありがとう', 'おはよう'], correctIndex: 2, explanation: 'Thank youは感謝を表す英語表現です。' },
      { category: '理科', question: '太陽系で最も大きい惑星は？', options: ['土星', '木星', '天王星', '海王星'], correctIndex: 1, explanation: '木星は太陽系最大の惑星で、地球の約11倍の直径があります。' },
      { category: '社会（歴史）', question: '本能寺の変で織田信長を討った人物は？', options: ['豊臣秀吉', '明智光秀', '徳川家康', '柴田勝家'], correctIndex: 1, explanation: '1582年、明智光秀が本能寺で織田信長を討ちました。' },
      { category: '国語', question: '「雨降って地固まる」の意味は？', options: ['雨が降ると地面が柔らかくなる', '困難を乗り越えると絆が強まる', '天気が変わりやすい', '雨の日は外出しない方がいい'], correctIndex: 1, explanation: '揉め事の後はかえって良い結果になる、という意味のことわざです。' },
      { category: '算数・数学', question: '三角形の内角の和は何度？', options: ['90度', '180度', '270度', '360度'], correctIndex: 1, explanation: '三角形の内角の和は常に180度です。' },
      { category: '英語', question: '「I am a student」の「am」の意味は？', options: ['持っている', '〜です', '行く', '食べる'], correctIndex: 1, explanation: 'amはbe動詞で「〜です」という意味を表します。' }
    ];

    // フォールバックも重複チェック
    const availableFallbacks = fallbacks.filter(fb => !isQuestionAsked(fb.question));

    if (availableFallbacks.length > 0) {
      const selectedFallback = availableFallbacks[Math.floor(Math.random() * availableFallbacks.length)];
      addAskedQuestion(hashQuestion(selectedFallback.question));
      return shuffleQuiz(selectedFallback);
    }

    // 全フォールバックが使用済みの場合、ランダムに選択
    return shuffleQuiz(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  }
}

/**
 * クイズの選択肢をシャッフルし、correctIndexを更新する
 */
function shuffleQuiz(quiz) {
  const originalOptions = [...quiz.options];
  const correctAnswer = originalOptions[quiz.correctIndex];

  for (let i = quiz.options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [quiz.options[i], quiz.options[j]] = [quiz.options[j], quiz.options[i]];
  }

  quiz.correctIndex = quiz.options.indexOf(correctAnswer);
  return quiz;
}
