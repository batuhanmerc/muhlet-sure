// Sitenin ortak ayarları ve tüm sayfalarda aynı olan parçalar (üst menü, alt bilgi).
// Alan adı değişince sadece BASE_URL'i değiştirip `npm run build` çalıştırın.

export const SITE = {
  name: 'Mühlet Süre',
  BASE_URL: 'https://batuhanmerc.github.io/muhlet-sure/',
  email: '[E-POSTA-ADRESIN]',          // İletişim adresi: kendi adresinizi yazın
  owner: '[AD SOYAD]',                 // Veri sorumlusu / site sahibi
  rulesUpdated: '20 Kasım 2026',       // Süre kurallarının son gözden geçirildiği tarih
  year: 2026,
};

const LOGO = `<svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true"><rect x="1" y="1" width="26" height="26" rx="7" fill="#1f3a5f"/><path d="M8 9h12M8 14h8M8 19h5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="20" cy="19" r="2.6" fill="#e2884a"/></svg>`;

// root: sayfanın site köküne göre konumu ('./' ya da '../')
// current: menüde vurgulanacak bağlantı
export function header(root, current = '') {
  const a = (href, key, label, extra = '') =>
    `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}${extra}</a>`;
  const home = root === './' ? '' : root;
  return `<div class="beta" role="status">
  <strong>Test sürümü:</strong> Süre kuralları henüz bir avukat tarafından doğrulanmadı. Sonuçları mutlaka kendiniz kontrol edin.
</div>

<header class="site-header">
  <div class="wrap header-row">
    <a class="brand" href="${root}">${LOGO}<span>Mühlet Süre</span></a>
    <nav aria-label="Ana menü">
      ${a(`${home}#hesapla`, 'hesapla', 'Hesapla')}
      ${a(`${home}#surelerim`, 'surelerim', 'Sürelerim', ' <span class="count" id="nav-count" hidden></span>')}
      ${a(`${root}sureler/`, 'sureler', 'Süre rehberi')}
      ${a(`${root}sss.html`, 'sss', 'SSS')}
    </nav>
  </div>
</header>`;
}

export function footer(root) {
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="f-brand">
      <a class="brand" href="${root}">${LOGO}<span>Mühlet Süre</span></a>
      <p>Avukatlar için ücretsiz yasal süre hesaplayıcı. Evrakınız ve kayıtlarınız cihazınızdan çıkmaz.</p>
    </div>
    <div>
      <h2>Araç</h2>
      <ul>
        <li><a href="${root === './' ? '' : root}#hesapla">Süre hesapla</a></li>
        <li><a href="${root === './' ? '' : root}#evrak">Evraktan süre bul</a></li>
        <li><a href="${root === './' ? '' : root}#surelerim">Sürelerim</a></li>
        <li><a href="${root}sureler/">Süre rehberi</a></li>
      </ul>
    </div>
    <div>
      <h2>Bilgi</h2>
      <ul>
        <li><a href="${root}sss.html">Sık sorulan sorular</a></li>
        <li><a href="${root}gizlilik.html">Gizlilik ve KVKK</a></li>
        <li><a href="${root}kullanim-kosullari.html">Kullanım koşulları</a></li>
        <li><a href="mailto:${SITE.email}">İletişim ve hata bildirimi</a></li>
      </ul>
    </div>
  </div>
  <div class="wrap f-bottom">
    <span>© ${SITE.year} Mühlet Süre</span>
    <span>Süre kuralları son gözden geçirme: ${SITE.rulesUpdated}</span>
    <span>Hukuki görüş değildir. Son kontrol ve sorumluluk avukattadır.</span>
  </div>
</footer>`;
}

// Ortak <head> içeriği
export function head({ root, title, description, path = '', jsonld = null, noindex = false }) {
  const url = SITE.BASE_URL + path;
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#1f3a5f">
<meta property="og:type" content="website">
<meta property="og:locale" content="tr_TR">
<meta property="og:site_name" content="Mühlet Süre">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE.BASE_URL}img/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}img/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}img/icon-192.png">
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${root}css/style.css">${jsonld ? `\n<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}`;
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
