/**
 * @module Dashboard
 * Dashboard sayfasını kontrol eden ana modül.
 */

const DEMO_DATA = {
  headers: ['tarih', 'yorum', 'puan'],
  rows: [
    { tarih: '2024-01-15', yorum: 'Yemekler gerçekten çok lezzetliydi, harika bir deneyimdi!', puan: 5 },
    { tarih: '2024-01-20', yorum: 'Servis yavaştı ama yemekler güzeldi.', puan: 3 },
    { tarih: '2024-01-25', yorum: 'Hijyen konusunda ciddi sorunlar var, tekrar gelmem.', puan: 1 },
    { tarih: '2024-02-01', yorum: 'Fiyatlar biraz yüksek ama kalite de yüksek.', puan: 4 },
    { tarih: '2024-02-05', yorum: 'Personel çok nazikti, mutlaka tavsiye ederim.', puan: 5 },
    { tarih: '2024-02-10', yorum: 'Bekleme süresi çok uzundu, kabul edilemez.', puan: 2 },
    { tarih: '2024-02-14', yorum: 'Nefis yemekler, mis gibi kokan bir ortam. Mükemmel!', puan: 5 },
    { tarih: '2024-02-18', yorum: 'Yemekler soğuk geldi, hayal kırıklığı yaşadım.', puan: 2 },
    { tarih: '2024-02-22', yorum: 'Çok temiz bir mekan, personel ilgili ve güler yüzlü.', puan: 5 },
    { tarih: '2024-02-28', yorum: 'Fiyat/performans açısından gayet uygun bir yer.', puan: 4 },
    { tarih: '2024-03-05', yorum: 'Kaba davrandılar, bir daha gitmem.', puan: 1 },
    { tarih: '2024-03-10', yorum: 'Lezzetli yemekler, taze malzemeler kullanıyorlar.', puan: 4.5 },
    { tarih: '2024-03-15', yorum: 'Oldukça vasat bir deneyimdi, çok para ödedik.', puan: 2 },
    { tarih: '2024-03-20', yorum: 'Harika bir atmosfer, şahane yemekler. Kesinlikle tavsiye!', puan: 5 },
    { tarih: '2024-03-25', yorum: 'Sipariş karışıklığı yaşandı ama düzelttiler.', puan: 3 },
  ],
  commentCol: 'yorum',
  ratingCol: 'puan',
  dateCol: 'tarih',
};

let currentResult = null;

/**
 * Sayfa başlangıcı: ASENKRON MIMARIYE GECIRILDI
 */
async function init() {
  let csvData = null;
  let fileName = 'Demo Veri';
  let isDemo = false;

  const stored = localStorage.getItem('csvData');
  if (stored) {
    try {
      csvData = JSON.parse(stored);
      fileName = localStorage.getItem('csvFileName') || 'veri.csv';
    } catch {
      csvData = null;
    }
  }

  if (!csvData || !csvData.rows || csvData.rows.length === 0) {
    csvData = DEMO_DATA;
    isDemo = true;
    const banner = document.getElementById('warningBanner');
    if (banner) banner.classList.add('visible');
  }

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('visible');

  try {
    // BURASI GÜNCELLEDİ: API yanıtını asenkron bekliyoruz
    currentResult = await window.analyzeData(csvData);
    renderAll(currentResult, isDemo ? '📊 Demo Veri' : fileName);
  } catch (err) {
    console.error('Analiz hatası:', err);
  } finally {
    if (overlay) overlay.classList.remove('visible');
  }
}

function renderAll(result, fileName) {
  const { stats, catScores, wordFreq, trend } = result;

  const metaEl = document.getElementById('pageMeta');
  if (metaEl) {
    metaEl.innerHTML = `
      <span>📁 ${fileName}</span>
      <span class="badge badge--gray">${stats.total} yorum</span>
    `;
  }

  const el = (id) => document.getElementById(id);
  if (el('statTotal'))    el('statTotal').textContent    = stats.total;
  if (el('statAvg'))      el('statAvg').textContent      = stats.avgRating !== null ? stats.avgRating + ' / 5' : '–';
  if (el('statPos'))      el('statPos').textContent      = stats.positiveRate + '%';
  if (el('statNeg'))      el('statNeg').textContent      = stats.negativeRate + '%';

  renderSentimentPie(stats);
  renderCategoryBar(catScores);
  renderTrendLine(trend);
  renderWordCloud(wordFreq);
  renderScoreBars(catScores);

  renderReviews('all');
}

function renderReviews(filter) {
  if (!currentResult) return;

  const container = document.getElementById('reviewsList');
  if (!container) return;

  let reviews = currentResult.reviews;

  if (filter === 'pos') {
    reviews = reviews.filter(r => r.sentiment === 'positive');
  }

  if (filter === 'neg') {
    reviews = reviews.filter(r => r.sentiment === 'negative');
  }

  if (!reviews.length) {
    container.innerHTML = '<div style="padding:20px;color:#6b6460;text-align:center">Bu filtrede yorum bulunamadı.</div>';
    return;
  }

  container.innerHTML = reviews.map(r => {
    const emoji = r.sentiment === 'positive' ? '😊' : '😞';
    const text = r.text || '(Yorum metni yok)';
    const date = r.tarih || r.date || r[Object.keys(r).find(k =>
      k.toLowerCase().includes('tarih') || k.toLowerCase().includes('date')
    ) || ''] || '';

    const catTags = (r.categories || [])
      .map(c => `<span class="cat-tag">${c}</span>`)
      .join('');

    const ratingBadge = r.puan !== null && r.puan !== undefined
      ? `<span class="badge badge--gold">★ ${r.puan}</span>`
      : '';

    const overallScore = r.overallScore !== undefined && r.overallScore !== null
      ? `<div class="overall-score">⭐ Genel Puan: ${r.overallScore}/10</div>`
      : '';

    const detailScores = r.categoryDetails && Object.keys(r.categoryDetails).length > 0
      ? Object.entries(r.categoryDetails).map(([cat, detail]) => `
          <div class="detail-box">
            <strong>${cat}</strong> → ⭐ ${detail.score}/10
            <br>
            <small>${detail.reason}</small>
          </div>
        `).join('')
      : '';

    return `
      <div class="review-item">
        <span class="review-item__emoji">${emoji}</span>

        <div class="review-item__body">
          <div class="review-item__text">${text}</div>

          <div class="review-item__meta">
            ${date ? `<span class="review-item__date">📅 ${date}</span>` : ''}
            ${ratingBadge}
            <div class="review-item__cats">${catTags}</div>
            ${overallScore}
            ${detailScores}
          </div>
        </div>
      </div>
    `;
  }).join('');
}
document.addEventListener('DOMContentLoaded', () => {
  init();

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderReviews(tab.dataset.filter);
    });
  });

  const reportBtn = document.getElementById('reportBtn');
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      window.location.href = 'rapor.html';
    });
  }
});
  