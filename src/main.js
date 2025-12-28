// ===================================
// quizmachine - エターナル一般常識クイズ - メインアプリケーション
// ===================================

import './style.css';
import { generateQuiz, resetAskedQuestions } from './api.js';

// ===================================
// 状態管理
// ===================================

const LOCAL_STORAGE_KEY = 'quizmachine_best_score';

const state = {
  currentScreen: 'start',
  streak: 0,
  currentQuiz: null,
  isAnswered: false,
  timerInterval: null,
  timeLeft: 30 // 30秒のタイマー
};

// ===================================
// DOM要素
// ===================================

const screens = {
  start: document.getElementById('start-screen'),
  quiz: document.getElementById('quiz-screen'),
  gameover: document.getElementById('gameover-screen')
};

const elements = {
  // スタート画面
  topScore: document.getElementById('top-score'),
  startBtn: document.getElementById('start-btn'),

  // クイズ画面
  streakCount: document.getElementById('streak-count'),
  timerProgress: document.getElementById('timer-progress'),
  loadingQuiz: document.getElementById('loading-quiz'),
  quizContent: document.getElementById('quiz-content'),
  questionCategory: document.getElementById('question-category'),
  questionText: document.getElementById('question-text'),
  optionsContainer: document.getElementById('options-container'),
  resultFeedback: document.getElementById('result-feedback'),
  explanation: document.getElementById('explanation'),

  // ゲームオーバー画面
  finalScore: document.getElementById('final-score'),
  shareXBtn: document.getElementById('share-x-btn'),
  retryBtn: document.getElementById('retry-btn'),
  homeBtn: document.getElementById('home-btn')
};

// ===================================
// ローカルストレージ（個人ベストスコア）
// ===================================

function getBestScore() {
  try {
    const score = localStorage.getItem(LOCAL_STORAGE_KEY);
    return score ? parseInt(score, 10) : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(score) {
  try {
    const currentBest = getBestScore();
    if (score > currentBest) {
      localStorage.setItem(LOCAL_STORAGE_KEY, score.toString());
      return true; // 新記録
    }
    return false;
  } catch {
    return false;
  }
}

// ===================================
// 画面遷移
// ===================================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
  state.currentScreen = screenName;
}

// ===================================
// タイマー機能
// ===================================

function startTimer() {
  state.timeLeft = 30;
  elements.timerProgress.style.width = '100%';

  state.timerInterval = setInterval(() => {
    state.timeLeft -= 0.1;
    const percentage = (state.timeLeft / 30) * 100;
    elements.timerProgress.style.width = `${Math.max(0, percentage)}%`;

    if (state.timeLeft <= 0) {
      stopTimer();
      handleTimeout();
    }
  }, 100);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function handleTimeout() {
  if (!state.isAnswered) {
    state.isAnswered = true;
    showFeedback(false, state.currentQuiz.correctIndex);
  }
}

// ===================================
// クイズロジック
// ===================================

async function startGame() {
  // 新しいゲーム開始時に出題履歴をリセット
  resetAskedQuestions();
  state.streak = 0;
  elements.streakCount.textContent = '0';
  showScreen('quiz');
  await loadNextQuiz();
}

async function loadNextQuiz() {
  // ローディング表示
  elements.loadingQuiz.classList.remove('hidden');
  elements.quizContent.classList.add('hidden');
  elements.resultFeedback.classList.add('hidden');
  stopTimer();

  try {
    // クイズを生成
    state.currentQuiz = await generateQuiz();
    state.isAnswered = false;

    // クイズを表示
    displayQuiz(state.currentQuiz);

    // タイマー開始
    startTimer();
  } catch (error) {
    console.error('Error loading quiz:', error);
    // エラー時はホームに戻る
    showScreen('start');
  }
}

function displayQuiz(quiz) {
  elements.questionCategory.textContent = quiz.category;
  elements.questionText.textContent = quiz.question;

  // オプションボタンを生成
  elements.optionsContainer.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];

  quiz.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'option-btn';
    button.innerHTML = `<span class="option-label">${labels[index]}</span>${option}`;
    button.addEventListener('click', () => handleAnswer(index));
    elements.optionsContainer.appendChild(button);
  });

  // 表示切り替え
  elements.loadingQuiz.classList.add('hidden');
  elements.quizContent.classList.remove('hidden');
}

function handleAnswer(selectedIndex) {
  if (state.isAnswered) return;

  state.isAnswered = true;
  stopTimer();

  const isCorrect = selectedIndex === state.currentQuiz.correctIndex;

  // ボタンの状態を更新
  const buttons = elements.optionsContainer.querySelectorAll('.option-btn');
  buttons.forEach((btn, index) => {
    btn.disabled = true;
    if (index === state.currentQuiz.correctIndex) {
      btn.classList.add('correct');
    } else if (index === selectedIndex && !isCorrect) {
      btn.classList.add('incorrect');
    }
  });

  if (isCorrect) {
    state.streak++;
    elements.streakCount.textContent = state.streak;
  }

  // 正解・不正解どちらも正答と解説を表示
  setTimeout(() => {
    showFeedback(isCorrect);
  }, 800);
}

function showFeedback(isCorrect) {
  elements.quizContent.classList.add('hidden');
  elements.resultFeedback.classList.remove('hidden');
  elements.resultFeedback.classList.remove('correct', 'incorrect');
  elements.resultFeedback.classList.add(isCorrect ? 'correct' : 'incorrect');

  const feedbackText = elements.resultFeedback.querySelector('.feedback-text');
  feedbackText.textContent = isCorrect ? '🎉 正解！' : '😢 不正解...';

  // 正答を表示
  const correctAnswer = state.currentQuiz.options[state.currentQuiz.correctIndex];
  elements.explanation.innerHTML = `
    <div style="margin-bottom: 10px; font-weight: bold; color: var(--success);">
      正解: ${correctAnswer}
    </div>
    <div>${state.currentQuiz.explanation}</div>
  `;

  if (isCorrect) {
    // 正解なら次の問題へ
    setTimeout(() => {
      loadNextQuiz();
    }, 2000);
  } else {
    // 不正解ならゲームオーバーへ
    setTimeout(() => {
      endGame();
    }, 3000);
  }
}


function endGame() {
  stopTimer();
  elements.finalScore.textContent = state.streak;

  // ベストスコアを更新
  const isNewRecord = saveBestScore(state.streak);

  showScreen('gameover');

  // 新記録の場合は表示を更新
  if (isNewRecord) {
    elements.topScore.textContent = state.streak;
  }
}

// ===================================
// Xでシェア
// ===================================

function shareOnX() {
  const score = state.streak;
  const text = `🎉 エターナル一般常識クイズで${score}問連続正解しました！\n\nOpenAIが作問する一般常識クイズに挑戦してみませんか？\n\n#エターナル一般常識クイズ`;
  const url = window.location.href;

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(twitterUrl, '_blank', 'width=550,height=420');
}

// ===================================
// 初期化
// ===================================

function init() {
  // ローカルストレージからベストスコアを取得
  const bestScore = getBestScore();
  elements.topScore.textContent = bestScore > 0 ? bestScore : '--';

  // イベントリスナー設定
  elements.startBtn.addEventListener('click', startGame);
  elements.shareXBtn.addEventListener('click', shareOnX);
  elements.retryBtn.addEventListener('click', startGame);
  elements.homeBtn.addEventListener('click', () => {
    // ホームに戻る際にベストスコアを再表示
    const bestScore = getBestScore();
    elements.topScore.textContent = bestScore > 0 ? bestScore : '--';
    showScreen('start');
  });
}

// アプリ起動
init();
