// script.js - Barcha JavaScript funksiyalar

// ========== GLOBAL O'ZGARUVCHILAR ==========
let currentDuelData = null;
let currentQuestionIndex = 0;
let userScore = 0;
let botScore = 0;
let userAnswers = [];
let botAnswers = [];
let timerInterval = null;
let gameActive = false;
let botAnswered = false;
let userAnswered = false;
let statistics = {
    totalDuels: 0,
    wins: 0,
    winrate: 0,
    bestStreak: 0,
    currentStreak: 0
};

// LocalStorage'dan statistika yuklash
function loadStatistics() {
    const saved = localStorage.getItem('yhqDuelStats');
    if (saved) {
        statistics = JSON.parse(saved);
    }
    updateStatsDisplay();
}

// Statistikani saqlash
function saveStatistics() {
    localStorage.setItem('yhqDuelStats', JSON.stringify(statistics));
}

// Statistika ko'rinishini yangilash
function updateStatsDisplay() {
    document.getElementById('total-duels').textContent = statistics.totalDuels;
    document.getElementById('wins').textContent = statistics.wins;
    document.getElementById('winrate').textContent = statistics.winrate + '%';
    document.getElementById('best-streak').textContent = statistics.bestStreak;
}

// ========== NAVIGATSIYA ==========
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Aktiv klassni yangilash
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Seksiyalarni ko'rsatish/yashirish
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById(`${tab}-section`).classList.add('active');
        
        // Agar o'rganish bo'limi ochilgan bo'lsa, savollarni yuklash
        if (tab === 'learn') {
            loadLearnQuestions();
        }
        
        // Statistika bo'limi ochilgan bo'lsa
        if (tab === 'stats') {
            updateStatsDisplay();
        }
    });
});

// ========== DUEL FUNKSIYALARI ==========
document.getElementById('start-duel-btn').addEventListener('click', startDuel);

async function startDuel() {
    const questionCount = parseInt(document.getElementById('question-count').value);
    
    try {
        const response = await fetch('/api/start_duel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ savol_soni: questionCount })
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            currentDuelData = data;
            currentQuestionIndex = 0;
            userScore = 0;
            botScore = 0;
            userAnswers = [];
            botAnswers = [];
            gameActive = true;
            botAnswered = false;
            userAnswered = false;
            
            // Bot ma'lumotlarini ko'rsatish
            document.getElementById('bot-name').textContent = data.raqib.ism;
            document.getElementById('bot-level').textContent = data.raqib.daraja;
            
            // Ekranlarni almashtirish
            document.getElementById('duel-start-screen').style.display = 'none';
            document.getElementById('duel-game-screen').style.display = 'block';
            
            // Ballarni yangilash
            updateScores();
            
            // Birinchi savolni yuklash
            loadQuestion(0);
        }
    } catch (error) {
        console.error('Duel boshlashda xato:', error);
        alert('Duelni boshlashda xatolik yuz berdi. Qayta urinib ko\'ring.');
    }
}

function loadQuestion(index) {
    if (!gameActive || index >= currentDuelData.savollar.length) {
        endDuel();
        return;
    }
    
    const question = currentDuelData.savollar[index];
    
    // Raund indikatorini yangilash
    document.getElementById('round-indicator').textContent = 
        `${index + 1}/${currentDuelData.savollar.length}`;
    
    // Kategoriya va qiyinlik
    document.getElementById('question-category').textContent = 
        question.kategoriya || 'Umumiy';
    
    const difficultyBadge = document.querySelector('.difficulty-badge');
    difficultyBadge.textContent = question.qiyinlik === 'oson' ? 'Oson' : 
                                 question.qiyinlik === 'orta' ? 'O\'rta' : 'Qiyin';
    difficultyBadge.dataset.difficulty = question.qiyinlik;
    
    // Savol matni
    document.getElementById('question-text').textContent = question.savol;
    
    // Variantlarni yaratish
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    question.variantlar.forEach((variant, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = `${String.fromCharCode(65 + i)}) ${variant}`;
        btn.dataset.index = i;
        btn.addEventListener('click', () => handleUserAnswer(i, question));
        optionsContainer.appendChild(btn);
    });
    
    // Holatlarni reset qilish
    botAnswered = false;
    userAnswered = false;
    document.getElementById('bot-thinking').style.display = 'none';
    document.getElementById('bot-answered').style.display = 'none';
    document.getElementById('bot-emoji').textContent = '🤖';
    document.getElementById('user-emoji').textContent = '😊';
    
    // Variantlarni faollashtirish
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'wrong');
    });
    
    // Taymerni boshlash
    startTimer(question);
    
    // Bot javobini simulyatsiya qilish (parallel)
    simulateBotAnswer(question);
}

function startTimer(question) {
    // Qiyinlikka qarab vaqt
    let timeLimit = 15;
    if (question.qiyinlik === 'qiyin') timeLimit = 20;
    if (question.qiyinlik === 'oson') timeLimit = 12;
    
    let timeLeft = timeLimit;
    const timerDisplay = document.getElementById('timer-display');
    const progressCircle = document.getElementById('timer-progress');
    const circumference = 283;
    
    timerDisplay.textContent = timeLeft;
    progressCircle.style.strokeDashoffset = 0;
    
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (!gameActive) {
            clearInterval(timerInterval);
            return;
        }
        
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        
        // Progress aylanasini yangilash
        const progress = (timeLeft / timeLimit) * circumference;
        progressCircle.style.strokeDashoffset = circumference - progress;
        
        // Vaqt tugaganda
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            
            if (!userAnswered && gameActive) {
                // Foydalanuvchi javob bermadi - noto'g'ri deb hisoblanadi
                handleUserAnswer(-1, question);
            }
        }
        
        // Oxirgi 5 soniyada qizil rang
        if (timeLeft <= 5) {
            progressCircle.style.stroke = '#ef4444';
        } else {
            progressCircle.style.stroke = '#2563eb';
        }
    }, 1000);
}

async function simulateBotAnswer(question) {
    // Bot o'ylash ko'rinishini ko'rsatish
    document.getElementById('bot-thinking').style.display = 'flex';
    document.getElementById('bot-answered').style.display = 'none';
    
    // Tasodifiy kutish emojisi
    const thinkingEmojis = ['🤔', '🧐', '📝', '💭', '⏳'];
    const thinkingEmoji = thinkingEmojis[Math.floor(Math.random() * thinkingEmojis.length)];
    document.getElementById('thinking-emoji').textContent = thinkingEmoji;
    
    try {
        const response = await fetch('/api/bot_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                savol: question,
                bot_darajasi: currentDuelData.raqib.daraja
            })
        });
        
        const data = await response.json();
        
        if (data.status === 'success' && gameActive && !botAnswered) {
            botAnswered = true;
            
            // Bot javobini saqlash
            botAnswers.push({
                questionIndex: currentQuestionIndex,
                answerIndex: data.javob_index,
                isCorrect: data.is_correct,
                emoji: data.emoji
            });
            
            // Agar to'g'ri bo'lsa ball qo'shish
            if (data.is_correct) {
                botScore++;
                updateScores();
            }
            
            // Bot emojisini yangilash
            document.getElementById('bot-emoji').textContent = data.emoji;
            
            // Bot holat panelini yangilash
            document.getElementById('bot-thinking').style.display = 'none';
            document.getElementById('bot-answered').style.display = 'flex';
            document.getElementById('bot-answer-emoji').textContent = data.emoji;
            
            // Ikkala tomon ham javob bergan bo'lsa, keyingi savolga o'tish
            checkAndProceed();
        }
    } catch (error) {
        console.error('Bot javobida xato:', error);
    }
}

function handleUserAnswer(selectedIndex, question) {
    if (!gameActive || userAnswered) return;
    
    userAnswered = true;
    clearInterval(timerInterval);
    
    const isCorrect = selectedIndex === question.javob;
    const options = document.querySelectorAll('.option-btn');
    
    // To'g'ri javobni ko'rsatish
    options.forEach((btn, i) => {
        btn.disabled = true;
        if (i === question.javob) {
            btn.classList.add('correct');
        } else if (i === selectedIndex && !isCorrect) {
            btn.classList.add('wrong');
        }
    });
    
    // Foydalanuvchi javobini saqlash
    userAnswers.push({
        questionIndex: currentQuestionIndex,
        answerIndex: selectedIndex,
        isCorrect: isCorrect
    });
    
    // Emoji reaksiya
    const userEmoji = isCorrect ? '🎉' : '😵';
    document.getElementById('user-emoji').textContent = userEmoji;
    
    // Ballni yangilash
    if (isCorrect) {
        userScore++;
        updateScores();
    }
    
    // Ikkala tomon ham javob bergan bo'lsa, keyingi savolga o'tish
    checkAndProceed();
}

function checkAndProceed() {
    if (userAnswered && botAnswered) {
        setTimeout(() => {
            if (gameActive) {
                currentQuestionIndex++;
                if (currentQuestionIndex < currentDuelData.savollar.length) {
                    loadQuestion(currentQuestionIndex);
                } else {
                    endDuel();
                }
            }
        }, 1500);
    }
}

function updateScores() {
    document.getElementById('user-score').textContent = userScore;
    document.getElementById('bot-score').textContent = botScore;
}

function endDuel() {
    gameActive = false;
    clearInterval(timerInterval);
    
    const totalQuestions = currentDuelData.savollar.length;
    const percentage = Math.round((userScore / totalQuestions) * 100);
    const passed = userScore >= 18; // 20 tadan 18 ta
    
    // Statistikani yangilash
    statistics.totalDuels++;
    if (userScore > botScore) {
        statistics.wins++;
        statistics.currentStreak++;
    } else {
        statistics.currentStreak = 0;
    }
    
    if (statistics.currentStreak > statistics.bestStreak) {
        statistics.bestStreak = statistics.currentStreak;
    }
    
    statistics.winrate = Math.round((statistics.wins / statistics.totalDuels) * 100);
    saveStatistics();
    
    // O'yin ekranini yashirish
    document.getElementById('duel-game-screen').style.display = 'none';
    document.getElementById('duel-result-screen').style.display = 'block';
    
    // Natijalarni ko'rsatish
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const examResult = document.getElementById('exam-result');
    
    if (userScore > botScore) {
        resultIcon.textContent = '🏆';
        resultTitle.textContent = 'G\'alaba!';
        resultMessage.textContent = 'Siz sun\'iy intellektni mag\'lub etdingiz!';
    } else if (userScore < botScore) {
        resultIcon.textContent = '😔';
        resultTitle.textContent = 'Mag\'lubiyat';
        resultMessage.textContent = 'Bu safar raqib kuchliroq chiqdi.';
    } else {
        resultIcon.textContent = '🤝';
        resultTitle.textContent = 'Durang!';
        resultMessage.textContent = 'Kuchlar teng keldi!';
    }
    
    document.getElementById('final-user-score').textContent = `${userScore}/${totalQuestions}`;
    document.getElementById('final-bot-score').textContent = `${botScore}/${totalQuestions}`;
    document.getElementById('final-percentage').textContent = `${percentage}%`;
    
    // Imtihon natijasi
    if (passed) {
        examResult.className = 'exam-result passed';
        examResult.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <h3>Tabriklaymiz! Siz imtihondan o'tdingiz!</h3>
            <p>Siz haydovchilik guvohnomasini olishingiz mumkin.</p>
        `;
    } else {
        examResult.className = 'exam-result failed';
        examResult.innerHTML = `
            <i class="fas fa-times-circle"></i>
            <h3>Afsuski, imtihondan o'ta olmadingiz</h3>
            <p>Yana tayyorlanib, qayta urinib ko'ring. Sizga 18 ta to'g'ri javob kerak.</p>
        `;
    }
}

// ========== O'RGANISH FUNKSIYALARI ==========
async function loadLearnQuestions(category = 'all') {
    try {
        let url = '/api/all_questions';
        if (category !== 'all') {
            url += `?category=${category}`;
        }
        
        const response = await fetch(url);
        const questions = await response.json();
        
        const container = document.getElementById('questions-list');
        container.innerHTML = '';
        
        questions.forEach((q, index) => {
            const card = createQuestionCard(q, index + 1);
            container.appendChild(card);
        });
        
        // Kategoriyalarni yuklash
        loadCategories();
    } catch (error) {
        console.error('Savollarni yuklashda xato:', error);
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        
        const select = document.getElementById('category-filter');
        select.innerHTML = '<option value="all">Barcha kategoriyalar</option>';
        
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Kategoriyalarni yuklashda xato:', error);
    }
}

function createQuestionCard(question, number) {
    const card = document.createElement('div');
    card.className = 'question-card';
    
    const correctOption = question.variantlar[question.javob];
    
    card.innerHTML = `
        <div class="question-card-header">
            <span class="question-number">${number}</span>
            <span class="question-category">${question.kategoriya || 'Umumiy'}</span>
            <span class="difficulty-badge" data-difficulty="${question.qiyinlik}">
                ${question.qiyinlik === 'oson' ? 'Oson' : question.qiyinlik === 'orta' ? 'O\'rta' : 'Qiyin'}
            </span>
        </div>
        <h4>${question.savol}</h4>
        <div class="answer-section">
            <div class="options-list">
                ${question.variantlar.map((v, i) => `
                    <div class="option-item ${i === question.javob ? 'correct' : ''}">
                        <strong>${String.fromCharCode(65 + i)})</strong> ${v}
                        ${i === question.javob ? ' ✅' : ''}
                    </div>
                `).join('')}
            </div>
            ${question.izoh ? `<div class="explanation">📝 ${question.izoh}</div>` : ''}
        </div>
    `;
    
    card.addEventListener('click', () => {
        card.classList.toggle('expanded');
    });
    
    return card;
}

// Kategoriya filtri
document.getElementById('category-filter')?.addEventListener('change', (e) => {
    loadLearnQuestions(e.target.value);
});

// Tasodifiy 10 ta savol
document.getElementById('random-learn-btn')?.addEventListener('click', async () => {
    try {
        const response = await fetch('/api/random_questions?count=10');
        const questions = await response.json();
        
        const container = document.getElementById('questions-list');
        container.innerHTML = '';
        
        questions.forEach((q, index) => {
            const card = createQuestionCard(q, index + 1);
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Tasodifiy savollarni yuklashda xato:', error);
    }
});

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    
    // Streak ko'rsatish
    document.querySelector('.user-streak').textContent = `🔥 ${statistics.currentStreak}`;
});

// Javoblarni ko'rish tugmasi
document.getElementById('review-answers-btn')?.addEventListener('click', () => {
    // O'rganish bo'limiga o'tish
    document.querySelector('[data-tab="learn"]').click();
});
