from flask import Flask, request, jsonify
from flask_cors import CORS
from google import genai
from google.genai import types
import json

app = Flask(__name__)
CORS(app)  # Tarayıcıdan gelen istekleri kabul etmek için

# Senin hazırladığın güvenli Gemini kurulumu
API_KEY = "BURAYA_GEMINI_API_KEY_YAPISTIR"
client = genai.Client(api_key=API_KEY)
MODEL_ID = "gemini-2.5-flash"  # En güncel ve kararlı sürüm

# Web arayüzümüzün (Dashboard) beklediği o detaylı Aspect-Based format
SISTEM_TALIMATI = """
Müşteri yorumlarını analiz et. SADECE aşağıda verilen saf JSON formatında bir Array döndür. 
Markdown (```json) etiketleri veya ekstra açıklamalar KESİNLİKLE olmayacak.

Zıtlık içeren cümlelerde (örn: 'Yemek güzeldi ama servis yavaştı') kategorilerin duygularını ayrı ayrı yakala.

FORMAT:
[
  {
    "id": 0,
    "sentiment": "positive veya negative",
    "categories": ["Yemek Kalitesi", "Servis", "Hijyen", "Fiyat", "Personel", "Bekleme Süresi"],
    "catSentiments": {
      "Yemek Kalitesi": "positive",
      "Servis": "negative"
    }
  }
]
"""


@app.route('/api/analyze', methods=['POST'])
def analyze_reviews():
    try:
        data = request.json
        rows = data.get('rows', [])
        comment_col = data.get('commentCol', 'yorum')

        # Kota koruması için ilk 60 yorumu pakete alalım
        reviews_to_process = rows[:60]

        # Gemini'ye toplu formatta gönderiyoruz
        yorum_metinleri = ""
        for i, r in enumerate(reviews_to_process):
            text = r.get(comment_col, '')
            yorum_metinleri += f"ID: {i} | Yorum: \"{text}\"\n"

        prompt = f"{SISTEM_TALIMATI}\n\nYorumlar:\n{yorum_metinleri}"

        response = client.models.generate_content(
            model=MODEL_ID,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1
            )
        )

        # Google'dan gelen ham cevabı temizleyip JSON'a çeviriyoruz
        ai_raw_text = response.text.replace("```json", "").replace("```", "").strip()
        gemini_result = json.loads(ai_raw_text)

        return jsonify({
            "status": "success",
            "data": geminiResult
        })

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


if __name__ == '__main__':
    # Sunucuyu 5000 portunda ayağa kaldırıyoruz
    app.run(host='127.0.0.1', port=5000, debug=True)

