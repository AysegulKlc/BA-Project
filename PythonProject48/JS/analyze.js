/**
 * @module SentimentAnalyzer
 * Full-Stack Mükemmelleştirilmiş Hibrit Analiz Motoru.
 * 1. Sayısal veri seti kalıntılarını (Örn: 4;4;1;) otomatik temizler.
 * 2. Önce lokal Python sunucusuna (Flask) gider, hata anında gelişmiş yerel motora kayar.
 */

localStorage.removeItem('geminiApiKey');

// --- DUYGU SÖZLÜKLERİ (Ekran görüntüsündeki hatalı kelimeler eklenerek güçlendirildi) ---
const POSITIVE_WORDS = [
  'harika', 'mükemmel', 'lezzetli', 'güzel', 'iyi', 'fevkalade', 'nefis',
  'muhteşem', 'şahane', 'taze', 'kaliteli', 'temiz', 'hızlı', 'nazik',
  'güler yüzlü', 'ilgili', 'tatmin', 'beğendim', 'tavsiye', 'başarılı',
  'enfes', 'doyurucu', 'bol', 'çeşitli', 'keyifli', 'memnun', 'harikulade',
  'süper', 'kusursuz', 'ideal', 'doğal', 'tatlı', 'mis gibi', 'pişmiş',
  'sıcak', 'hızlı servis', 'güvenilir', 'şık', 'samimi', 'hoş', 'tesekkurler', 'teşekkürler'
];

const NEGATIVE_WORDS = [
  'berbat', 'kötü', 'rezalet', 'iğrenç', 'soğuk', 'bayat', 'bozuk',
  'kirli', 'pis', 'yavaş', 'geç', 'kaba', 'ilgisiz', 'sinir', 'hayal kırıklığı',
  'pahalı', 'fahiş', 'uzun bekleme', 'tatsız', 'çiğ', 'yavan', 'eksik',
  'tuzlu', 'acı', 'ekşi', 'yanmış', 'az', 'yetersiz', 'düşük kalite',
  'zavallı', 'saçma', 'vasat', 'sıradan', 'para israf', 'israf', 'bekleme',
  'soğumuş', 'pişmemiş', 'ücret', 'şikayet', 'haksız', 'hatalı', 'yanlış',
  // Sahnede elenen olumsuz kelimeler eklendi:
  'kokmuş', 'kokmus', 'ayıp', 'ayip', 'az pişmiş', 'az pismis', 'yollanır mı', 'yollanir mi',
  'birdaha sipariş vermem', 'vermem', 'saçma', 'sacma', 'bekledik'
];

const NEGATORS = ['değil', 'hiç', 'asla', 'hiçbir', 'yok', 'olmadı', 'olmaz', 'etmedi', 'etmez', 'yapmadı', 'yapmaz', 'istemiyorum', 'vermem'];
const STOP_WORDS = new Set(['ve','bir','bu','ile','de','da','için','ama','fakat','çünkü','ki','mi','mı','mu','mü','ya','yani','hem','gibi','kadar','sonra','önce','her','bazı','hiç','ne','nasıl','neden','niçin','ise','bile','sadece','zaten','pek','şu','o','biz','siz','onlar','ben','sen','ol','olan','oldu','var','yok','olarak']);

const CATEGORY_KEYWORDS = {
  'Yemek Kalitesi': {
    positive: ['lezzetli', 'nefis', 'taze', 'doyurucu', 'bol', 'kaliteli yemek', 'enfes', 'leziz', 'mis gibi', 'pişmiş', 'yemek', 'yemekler', 'lezzeti', 'tad'],
    negative: ['bayat', 'soğuk yemek', 'pişmemiş', 'yanmış', 'tatsız', 'yavan', 'ekşi', 'çiğ', 'bozuk yemek', 'kötü tat', 'soğuk', 'tatsızdı', 'kokmuş', 'kokmus', 'hamburger', 'köftesi', 'koftesi']
  },
  'Servis': {
    positive: ['hızlı servis', 'zamanında', 'iyi servis', 'verimli', 'düzgün', 'akıcı', 'organize', 'süratli', 'anında', 'servis', 'paket', 'sipariş', 'siparisimi'],
    negative: ['yavaş', 'yavaş servis', 'geç geldi', 'bekledik', 'uzun bekleme', 'ihmalkar', 'unutuldu', 'karışık sipariş', 'hatalı sipariş', 'eksik', 'gönderildi', 'yollanır mı', 'yollanir mi']
  },
  'Hijyen': {
    positive: ['temiz', 'hijyenik', 'steril', 'düzgün', 'bakımlı', 'tertemiz', 'pırıl pırıl', 'hijyen', 'temizliği'],
    negative: ['kirli', 'pis', 'hijyensiz', 'iğrenç', 'çöp', 'böcek', 'kötü koku', 'hamam böceği', 'toz', 'saç', 'kıl', 'peynirli']
  },
  'Fiyat': {
    positive: ['uygun fiyat', 'makul', 'hesaplı', 'ekonomik', 'para değer', 'ucuz', 'fiyat performans', 'fiyatı'],
    negative: ['pahalı', 'fahiş', 'kazıklandık', 'haksız fiyat', 'aşırı pahalı', 'para israf', 'çok para', 'fiyatlar', 'para']
  },
  'Personel': {
    positive: ['nazik', 'güler yüzlü', 'yardımsever', 'ilgili', 'samimi', 'profesyonel', 'kibarlık', 'sıcakkanlı', 'personel', 'garson', 'çalışanlar', 'ekip'],
    negative: ['kaba', 'ilgisiz', 'sinirli', 'saygısız', 'itici', 'umursamaz', 'tepeden bakan', 'garsonlar']
  },
  'Bekleme Süresi': {
    positive: ['hızlı', 'beklemedik', 'anında', 'çabuk', 'kısa süre', 'süratli'],
    negative: ['uzun bekleme', 'çok bekledik', 'saatler', 'sıra', 'bekleme süresi', 'gecikme', 'geç servis', 'dakika', 'bekletildik', 'hour']
  }
};

// --- HAM METİN TEMİZLEME MOTORU (Önemli Değişiklik) ---
function cleanRawText(text) {
  if (!text) return "";
  // Başta bulunan "-;10;2;" veya "4;4;1;" gibi tüm sayısal/noktalı kalıntıları uçurur
  return text.replace(/^[\d\s\-\;]+;/, '').trim();
}

function getWordFrequency(reviews) {
  const freq = {};
  reviews.forEach(r => {
    if (!r.text) return;
    const words = r.text.toLowerCase().replace(/[^\w\sçğışöü]/gi, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 60);
}

function getTrendData(reviews, dateCol, ratingCol) {
  if (!dateCol || !ratingCol) return { labels: [], values: [] };
  const groups = {};
  reviews.forEach(r => {
    const date = r[dateCol]; const rating = r[ratingCol];
    if (!date || rating === null || rating === undefined) return;
    if (!groups[date]) groups[date] = [];
    groups[date].push(Number(rating));
  });
  return {
    labels: Object.keys(groups).sort().map(d => `${d.split('-')[2]}.${d.split('-')[1]}.${d.split('-')[0]}`),
    values: Object.keys(groups).sort().map(d => Math.round((groups[d].reduce((a, b) => a + b, 0) / groups[d].length) * 10) / 10)
  };
}

// --- GELİŞMİŞ LOKAL DUYGU ANALİZİ (Geliştirildi) ---
function advancedClauseAnalyze(text) {
  const cleaned = cleanRawText(text);
  if (!cleaned) return { sentiment: 'positive', categories: ['Yemek Kalitesi'], catSentiments: {} };

  const lower = cleaned.toLowerCase();
  // "rağmen", "ama", "fakat" içeren cümlelerde zıtlık kontrolü
  const clauses = lower.split(/,?\s+(?:ama|fakat|ancak|lakin|yalnız|rağmen)\s+/);

  let finalCategories = new Set();
  let catSentiments = {};
  let negCount = 0; let posCount = 0;

  clauses.forEach(clause => {
    let clauseCats = [];
    for (const [cat, dict] of Object.entries(CATEGORY_KEYWORDS)) {
      if ([...dict.positive, ...dict.negative].some(kw => clause.includes(kw))) {
        clauseCats.push(cat); finalCategories.add(cat);
      }
    }

    let pScore = 0; let nScore = 0;
    POSITIVE_WORDS.forEach(w => { if (clause.includes(w)) pScore++; });
    NEGATIVE_WORDS.forEach(w => { if (clause.includes(w)) nScore++; });

    // "İyi pişsin diye söylememe rağmen az pişmiş geldi" kombinasyon koruması
    if (clause.includes('iyi pişsin') || clause.includes('iyi pismis')) pScore--;

    NEGATORS.forEach(w => { if (clause.includes(w)) { let tmp = pScore; pScore = nScore; nScore = tmp; } });

    let clauseSent = pScore >= nScore ? 'positive' : 'negative';

    // Net negatif kelime barındırıyorsa baskıla
    if (NEGATIVE_WORDS.some(nw => clause.includes(nw))) clauseSent = 'negative';

    if (clauseSent === 'negative') negCount++; else posCount++;
    clauseCats.forEach(cat => { catSentiments[cat] = clauseSent; });
  });

  if (finalCategories.size === 0) finalCategories.add('Yemek Kalitesi');

  // Eğer cümlenin herhangi bir yerinde net bir olumsuzluk veya uyarı varsa genel duygu negatiftir
  let overallSentiment = (negCount >= posCount || NEGATIVE_WORDS.some(nw => lower.includes(nw))) ? 'negative' : 'positive';

  finalCategories.forEach(cat => {
    if (!catSentiments[cat]) catSentiments[cat] = overallSentiment;
  });

  return { sentiment: overallSentiment, categories: Array.from(finalCategories), catSentiments };
}

function calcCategoryScores(reviews) {
  const scores = {}; const counts = {};
  Object.keys(CATEGORY_KEYWORDS).forEach(cat => { scores[cat] = 0; counts[cat] = 0; });
  reviews.forEach(r => {
    if (!r.catSentiments) return;
    Object.entries(r.catSentiments).forEach(([cat, sent]) => {
      if (cat in scores) { counts[cat]++; if (sent === 'positive') scores[cat]++; }
    });
  });
  const result = {};
  Object.keys(CATEGORY_KEYWORDS).forEach(cat => {
    result[cat] = counts[cat] > 0 ? Math.round((scores[cat] / counts[cat]) * 100) : 50;
  });
  return result;
}

function localAnalyzeData(cleanedData) {
  const { rows, commentCol, ratingCol, dateCol } = cleanedData;
  const reviews = rows.map(row => {
    const text = commentCol ? row[commentCol] : null;
    const cleanText = cleanRawText(text); // Ekrandaki gösterimi temizle
    const analysis = advancedClauseAnalyze(text);
    return {
      ...row,
      [commentCol]: cleanText, // Tabloda düzgün görünmesi için temiz metni eşitle
      text: cleanText,
      puan: ratingCol ? row[ratingCol] : null,
      sentiment: analysis.sentiment,
      categories: analysis.categories,
      catSentiments: analysis.catSentiments
    };
  });

  return {
    reviews,
    stats: { total: reviews.length, positiveCount: reviews.filter(r => r.sentiment === 'positive').length, negativeCount: reviews.length - reviews.filter(r => r.sentiment === 'positive').length, positiveRate: reviews.length > 0 ? Math.round((reviews.filter(r => r.sentiment === 'positive').length / reviews.length) * 100) : 0, negativeRate: reviews.length > 0 ? Math.round(((reviews.length - reviews.filter(r => r.sentiment === 'positive').length) / reviews.length) * 100) : 0, avgRating: rows.map(r => r[ratingCol]).filter(p => p !== null && !isNaN(p)).length ? Math.round((rows.map(r => r[ratingCol]).filter(p => p !== null && !isNaN(p)).reduce((a, b) => a + b, 0) / rows.map(r => r[ratingCol]).filter(p => p !== null && !isNaN(p)).length) * 10) / 10 : null },
    catScores: calcCategoryScores(reviews),
    wordFreq: getWordFrequency(reviews),
    trend: getTrendData(rows, dateCol, ratingCol)
  };
}

// --- ANA SUNUCU KÖPRÜSÜ ---
async function analyzeData(cleanedData) {
  const { rows, commentCol, ratingCol, dateCol } = cleanedData;

  try {
    const response = await fetch('http://127.0.0.1:5000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: rows,
        commentCol: commentCol
      })
    });

    if (!response.ok) throw new Error();

    const serverResponse = await response.json();
    const geminiResult = serverResponse.data;

    const reviews = rows.map((row, index) => {
      const text = commentCol ? row[commentCol] : null;
      const cleanText = cleanRawText(text);
      const aiData = geminiResult.find(g => g.id === index);
      const localFallback = advancedClauseAnalyze(text);

      return {
        ...row,
        [commentCol]: cleanText,
        text: cleanText,
        puan: ratingCol ? row[ratingCol] : null,
        sentiment: aiData ? aiData.sentiment : localFallback.sentiment,
        categories: aiData ? aiData.categories : localFallback.categories,
        catSentiments: aiData ? aiData.catSentiments : localFallback.catSentiments
      };
    });

    const total = reviews.length;
    const positiveCount = reviews.filter(r => r.sentiment === 'positive').length;
    const negativeCount = total - positiveCount;
    const ratings = reviews.map(r => r.puan).filter(p => p !== null && !isNaN(p));

    return {
      reviews,
      stats: { total, positiveCount, negativeCount, positiveRate: total > 0 ? Math.round((positiveCount / total) * 100) : 0, negativeRate: total > 0 ? Math.round((negativeCount / total) * 100) : 0, avgRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null },
      catScores: calcCategoryScores(reviews),
      wordFreq: getWordFrequency(reviews),
      trend: getTrendData(rows, dateCol, ratingCol)
    };

  } catch (error) {
    console.warn("Python sunucusuna bağlanılamadı, lokal akıllı filtre devrede.");
    return localAnalyzeData(cleanedData);
  }
}

window.analyzeData = analyzeData;