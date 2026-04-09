# app.py - Backend server
from flask import Flask, jsonify, request, render_template
import random
import time
import json
import os

app = Flask(__name__)

# Savollar bazasini yuklash
def load_questions():
    with open('questions.json', 'r', encoding='utf-8') as f:
        return json.load(f)

SAVOLLAR = load_questions()

# Sun'iy intellekt ismlari va emojilari
BOT_ISMLAR = [
    {"ism": "Jasur", "emoji": "😎", "daraja": "Usta"},
    {"ism": "Dilnoza", "emoji": "😇", "daraja": "O'rta"},
    {"ism": "Bobur", "emoji": "🤓", "daraja": "Boshlovchi"},
    {"ism": "Madina", "emoji": "😊", "daraja": "Usta"},
    {"ism": "Sherzod", "emoji": "🔥", "daraja": "Professional"},
    {"ism": "Gulnora", "emoji": "🌸", "daraja": "O'rta"},
    {"ism": "Aziz", "emoji": "🚗", "daraja": "Usta"},
    {"ism": "Nilufar", "emoji": "⭐", "daraja": "Boshlovchi"},
    {"ism": "Bekzod", "emoji": "💪", "daraja": "Professional"},
    {"ism": "Sevara", "emoji": "🎯", "daraja": "O'rta"}
]

BOT_REAKSIYALAR = {
    "to'g'ri": ["✅", "💪", "🏎️", "⚡", "🎉", "👏", "🔥", "💯", "🏆", "✨"],
    "noto'g'ri": ["😅", "🤦", "😬", "💔", "😢", "😭", "🙈", "🤷", "😓", "🌧️"],
    "kutish": ["🤔", "🧐", "📝", "💭", "⏳"]
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/start_duel', methods=['POST'])
def start_duel():
    data = request.json
    savol_soni = data.get('savol_soni', 5)
    
    # Tasodifiy raqib yaratish
    raqib = random.choice(BOT_ISMLAR)
    
    # O'yin uchun savollar tanlash
    if savol_soni > len(SAVOLLAR):
        savol_soni = len(SAVOLLAR)
    
    duel_savollar = random.sample(SAVOLLAR, savol_soni)
    
    # Har bir savol uchun variantlarni aralashtirish
    for savol in duel_savollar:
        variantlar = savol['variantlar'].copy()
        togri_javob = variantlar[savol['javob']]
        random.shuffle(variantlar)
        savol['variantlar'] = variantlar
        savol['javob'] = variantlar.index(togri_javob)
    
    return jsonify({
        "status": "success",
        "raqib": raqib,
        "savollar": duel_savollar,
        "jami_savollar": savol_soni
    })

@app.route('/api/bot_answer', methods=['POST'])
def bot_answer():
    data = request.json
    savol = data['savol']
    bot_darajasi = data.get('bot_darajasi', 'O\'rta')
    
    # Darajaga qarab to'g'ri javob ehtimoli
    ehtimollar = {
        "Boshlovchi": 60,
        "O'rta": 75,
        "Usta": 85,
        "Professional": 92
    }
    
    correct_chance = ehtimollar.get(bot_darajasi, 75)
    
    # Bot "o'ylash" vaqti (1.5 - 4.5 soniya)
    think_time = random.uniform(1.5, 4.5)
    time.sleep(think_time)
    
    # Kutish emojisi
    kutish_emoji = random.choice(BOT_REAKSIYALAR["kutish"])
    
    # Bot javobini hisoblash
    is_correct = random.choices(
        [True, False],
        weights=[correct_chance, 100 - correct_chance],
        k=1
    )[0]
    
    if is_correct:
        javob_index = savol['javob']
        emoji_reaction = random.choice(BOT_REAKSIYALAR["to'g'ri"])
    else:
        wrong_options = [i for i in range(4) if i != savol['javob']]
        javob_index = random.choice(wrong_options)
        emoji_reaction = random.choice(BOT_REAKSIYALAR["noto'g'ri"])
    
    return jsonify({
        "status": "success",
        "javob_index": javob_index,
        "emoji": emoji_reaction,
        "kutish_emoji": kutish_emoji,
        "think_time": round(think_time, 1),
        "is_correct": is_correct
    })

@app.route('/api/all_questions')
def all_questions():
    """O'rganish bo'limi uchun barcha savollar"""
    category = request.args.get('category', 'all')
    
    if category == 'all':
        return jsonify(SAVOLLAR)
    else:
        filtered = [q for q in SAVOLLAR if q.get('kategoriya') == category]
        return jsonify(filtered)

@app.route('/api/categories')
def get_categories():
    """Mavjud kategoriyalar ro'yxati"""
    categories = set(q.get('kategoriya', 'Umumiy') for q in SAVOLLAR)
    return jsonify(list(categories))

@app.route('/api/random_questions')
def random_questions():
    """O'rganish uchun tasodifiy savollar"""
    count = request.args.get('count', 10, type=int)
    if count > len(SAVOLLAR):
        count = len(SAVOLLAR)
    questions = random.sample(SAVOLLAR, count)
    return jsonify(questions)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)