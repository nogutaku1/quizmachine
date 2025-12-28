// ===================================
// quizmachine - エターナル一般常識クイズ - メインアプリケーション
// ===================================

import './style.css';
import { generateQuiz } from './api.js';
import { saveScore, getRankings, getTopScore } from './supabase.js';

// ===================================
// 状態管理
// ===================================

const state = {
  currentScreen: 'start',
  streak: 0,
  currentQuiz: null,
  isAnswered: false,
  timerInterval: null,
  timeLeft: 15 // 15秒のタイマー
};

// ===================================
// DOM要素
// ===================================

const screens = {
  start: document.getElementById('start-screen'),
  quiz: document.getElementById('quiz-screen'),
  gameover: document.getElementById('gameover-screen'),
  ranking: document.getElementById('ranking-screen')
};

const elements = {
  // スタート画面
  topScore: document.getElementById('top-score'),
  startBtn: document.getElementById('start-btn'),
  rankingBtn: document.getElementById('ranking-btn'),

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
  playerName: document.getElementById('player-name'),
  submitScoreBtn: document.getElementById('submit-score-btn'),
  retryBtn: document.getElementById('retry-btn'),
  homeBtn: document.getElementById('home-btn'),

  // ランキング画面
  rankingLoading: document.getElementById('ranking-loading'),
  rankingList: document.getElementById('ranking-list'),
  backHomeBtn: document.getElementById('back-home-btn')
};

// ===================================
// 画面遷移
// ===================================

function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  screens[screenName].classList.add('active');
  state.currentScreen = screenName;
}

// ===================================
// タイマー機能
// ===================================

function startTimer() {
  state.timeLeft = 15;
  elements.timerProgress.style.width = '100%';

  state.timerInterval = setInterval(() => {
    state.timeLeft -= 0.1;
    const percentage = (state.timeLeft / 15) * 100;
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
  elements.playerName.value = '';
  showScreen('gameover');
}

// ===================================
// スコア登録
// ===================================

async function submitScore() {
  const playerName = elements.playerName.value.trim();

  if (!playerName) {
    elements.playerName.focus();
    elements.playerName.style.borderColor = 'var(--error)';
    setTimeout(() => {
      elements.playerName.style.borderColor = '';
    }, 1000);
    return;
  }

  elements.submitScoreBtn.disabled = true;
  elements.submitScoreBtn.textContent = '登録中...';

  const success = await saveScore(playerName, state.streak);

  if (success) {
    elements.submitScoreBtn.textContent = '登録完了！';
    setTimeout(() => {
      showRanking();
    }, 500);
  } else {
    elements.submitScoreBtn.textContent = '再試行';
    elements.submitScoreBtn.disabled = false;
  }
}

// ===================================
// ランキング表示
// ===================================

async function showRanking() {
  showScreen('ranking');
  elements.rankingLoading.classList.remove('hidden');
  elements.rankingList.classList.add('hidden');

  const rankings = await getRankings();

  elements.rankingLoading.classList.add('hidden');
  elements.rankingList.classList.remove('hidden');

  if (rankings.length === 0) {
    elements.rankingList.innerHTML = '<p class="no-ranking">まだランキングがありません</p>';
    return;
  }

  elements.rankingList.innerHTML = rankings.map((entry, index) => {
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    const topClass = index < 3 ? 'top-3' : '';
    const date = new Date(entry.created_at).toLocaleDateString('ja-JP');

    return `
      <div class="ranking-item ${topClass}">
        <span class="rank ${rankClass}">${index + 1}</span>
        <div class="player-info">
          <div class="player-name">${escapeHtml(entry.player_name)}</div>
          <div class="player-date">${date}</div>
        </div>
        <span class="player-score">${entry.score}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===================================
// 初期化
// ===================================

async function init() {
  // 最高スコアを取得
  const topScore = await getTopScore();
  elements.topScore.textContent = topScore > 0 ? topScore : '--';

  // イベントリスナー設定
  elements.startBtn.addEventListener('click', startGame);
  elements.rankingBtn.addEventListener('click', showRanking);
  elements.submitScoreBtn.addEventListener('click', submitScore);
  elements.retryBtn.addEventListener('click', startGame);
  elements.homeBtn.addEventListener('click', () => showScreen('start'));
  elements.backHomeBtn.addEventListener('click', async () => {
    const topScore = await getTopScore();
    elements.topScore.textContent = topScore > 0 ? topScore : '--';
    showScreen('start');
  });

  // Enterキーでスコア登録
  elements.playerName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitScore();
    }
  });
}

// アプリ起動
init();
