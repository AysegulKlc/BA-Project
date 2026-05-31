from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
import json
import re
import os
app = Flask(__name__)
CORS(app)

import os

API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=API_KEY)
MODEL_ID = "gemini-2.5-flash"

SISTEM_TALIMATI = """
Sen restoran müşteri yorumlarını analiz eden bir sistemsin.

Görevin:
1. Yorumu genel olarak positive / negative / neutral olarak sınıflandır.
2. Yorumu kategorilere ayır.
3. Her kategori için:
   - sentiment ver: positive / negative / neutral
   - 10 üzerinden score ver
   - kısa reason yaz
   - yorumdan kısa evidence çıkar
4. Genel yorum için 10 üzerinden overallScore ver.

Kategoriler:
- Yemek Kalitesi
- Servis
- Hijyen
- Fiyat
- Personel
- Bekleme Süresi
- Porsiyon
- Teslimat
- Sipariş Doğruluğu
- Ambiyans
- Menü Çeşitliliği

Puanlama mantığı:
- 9-10: çok iyi
- 7-8: iyi
- 5-6: nötr / orta
- 3-4: kötü
- 1-2: çok kötü

Önemli kurallar:
- Sadece yorumda gerçekten geçen kategorileri seç.
- Zıtlık içeren cümlelerde kategorileri ayrı değerlendir.
Örnek: "Yemek güzeldi ama servis yavaştı"
Yemek Kalitesi positive olabilir, Servis negative olabilir.
- Eğer yorumda "eksik ürün", "yanlış ürün", "istediğim gibi gelmedi" varsa Sipariş Doğruluğu kategorisini kullan.
- Eğer "kirli", "kokmuş", "bozuk", "saç", "hijyen" gibi ifadeler varsa Hijyen kategorisini kullan.
- Eğer "geç geldi", "bekledim", "1 saat", "yavaş" gibi ifadeler varsa Bekleme Süresi kategorisini kullan.
- Eğer "az", "küçük", "minik", "doymadım" varsa Porsiyon kategorisini kullan.

SADECE geçerli JSON array döndür.
Markdown, açıklama, ```json etiketi kullanma.

Format:
[
  {
    "id": 0,
    "sentiment": "negative",
    "overallScore": 3,
    "categories": ["Servis", "Hijyen"],
    "catSentiments": {
      "Servis": "negative",
      "Hijyen": "negative"
    },
    "categoryDetails": {
      "Servis": {
        "score": 3,
        "sentiment": "negative",
        "reason": "Müşteri siparişin eksik gönderildiğini belirtiyor.",
        "evidence": "eksik gönderildiğini tespit ettim"
      },
      "Hijyen": {
        "score": 4,
        "sentiment": "negative",
        "reason": "Müşteri ürün kalitesi veya hijyen algısı açısından olumsuz bir ifade kullanıyor.",
        "evidence": "hizmet anlayışı"
      }
    },
    "summary": "Yorum genel olarak olumsuzdur; temel problem servis ve sipariş doğruluğu ile ilgilidir."
  }
]
"""

def clean_json_text(text):
    text = text.replace("```json", "").replace("```", "").strip()
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        text = match.group(0)
    return text

@app.route('/api/analyze', methods=['POST'])
def analyze_reviews():
    try:
        data = request.json
        rows = data.get("rows", [])
        comment_col = data.get("commentCol", "review")

        reviews_to_process = rows[:1500]

        yorum_metinleri = ""
        for i, row in enumerate(reviews_to_process):
            text = row.get(comment_col, "")
            yorum_metinleri += f'ID: {i} | Yorum: "{text}"\n'

        prompt = f"{SISTEM_TALIMATI}\n\nAnaliz edilecek yorumlar:\n{yorum_metinleri}"

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )

        ai_raw_text = clean_json_text(response.text)

        print("========== GEMINI CEVABI ==========")
        print(ai_raw_text)
        print("===================================")

        gemini_result = json.loads(ai_raw_text)

        return jsonify({
            "status": "success",
            "data": gemini_result
        })

    except Exception as e:
        import traceback
        traceback.print_exc()

        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)