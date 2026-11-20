// Statik sayfa üretici. Çalıştırma: npm run build
// index.html'deki <!--build:x--> bölgelerini doldurur; SSS, gizlilik, kullanım koşulları,
// 404, süre rehberi sayfalarını, sitemap.xml, robots.txt ve manifest dosyasını üretir.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SITE, header, footer, head, esc } from './site.mjs';
import { FAQ, RULE_PAGES } from './content.mjs';
import { RULES, findRule } from '../js/rules.js';
import { calculate, formatTR, parse } from '../js/engine.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p, s) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), s); };
const unitTR = { day: 'gün', week: 'hafta', month: 'ay' };
const TEBLIG = { e: 'e-Tebligat', fiziki: 'Fiziki tebliğ', tefhim: 'Tefhim' };
const RECESS = {
  HMK: 'Son gün adli tatile (20 Temmuz – 31 Ağustos) denk gelirse süre, tatilin bitiminden itibaren 1 hafta uzamış sayılır (HMK m.104). Adli tatilde görülen işlerde (ör. iş davaları) uzama olmaz.',
  CMK: 'Adli tatile rastlayan süreler, tatilin bittiği günden itibaren 3 gün uzamış sayılır (CMK m.331/4). Tutuklu işlerde uzama olmaz.',
  IYUK: 'Adli tatile denk gelen süreler, tatilin sona ermesinden itibaren 7 gün uzamış sayılır (İYUK m.8/3).',
  IIK: 'Hesaplayıcı icra dairesi işlemlerinde adli tatil uzatması uygulamaz. İcra ve iflas işlerine özgü tatil kurallarını dosyanız için ayrıca kontrol edin.',
};

const lastVersion = (r) => r.versions[r.versions.length - 1];
const pageUrl = (code) => `sureler/${RULE_PAGES[code].slug}.html`;

function page({ root, current, title, description, path, body, jsonld, noindex, scripts = '' }) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
${head({ root, title, description, path, jsonld, noindex })}
</head>
<body>

${header(root, current)}

<main class="wrap page">
${body}
</main>

${footer(root)}
${scripts}
</body>
</html>
`;
}

const faqHtml = (items) => `<div class="faq">
${items.map(([q, a]) => `  <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
</div>`;
const faqLd = (items) => ({ '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const crumbs = (list) => `<nav class="crumbs" aria-label="Konum">${list.map(([href, t]) => href ? `<a href="${href}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`).join(' <span aria-hidden="true">/</span> ')}</nav>`;

// ---------- index.html ----------
function replaceRegion(html, name, content) {
  const re = new RegExp(`(<!--build:${name}-->)[\\s\\S]*?(<!--/build:${name}-->)`);
  if (!re.test(html)) throw new Error(`index.html içinde build:${name} bölgesi yok`);
  return html.replace(re, `$1\n${content}\n$2`);
}
let index = readFileSync(join(ROOT, 'index.html'), 'utf8');
index = replaceRegion(index, 'head', head({
  root: './', path: '',
  title: 'Yasal Süre Hesaplayıcı: İstinaf, Temyiz, İtiraz Süreleri | Mühlet Süre',
  description: 'Avukatlar için ücretsiz yasal süre hesaplayıcı. İstinaf, temyiz, cevap dilekçesi, ödeme emrine itiraz ve idari dava süreleri; e-Tebligat, adli tatil ve resmî tatiller dahil, her adım kanun dayanağıyla.',
  jsonld: [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Mühlet Süre', url: SITE.BASE_URL,
      applicationCategory: 'BusinessApplication', operatingSystem: 'Web', inLanguage: 'tr',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
      description: 'Türk hukukunda yasal sürelerin son gününü kanun dayanağıyla hesaplayan ücretsiz araç.' },
    faqLd(FAQ.slice(0, 5)),
  ],
}));
index = replaceRegion(index, 'header', header('./', 'hesapla'));
index = replaceRegion(index, 'footer', footer('./'));
index = replaceRegion(index, 'faq', faqHtml(FAQ.slice(0, 5)));
writeFileSync(join(ROOT, 'index.html'), index);

// ---------- sss.html ----------
out('sss.html', page({
  root: './', current: 'sss', path: 'sss.html',
  title: 'Sık Sorulan Sorular | Mühlet Süre',
  description: 'e-Tebligatta sürenin başlangıcı, adli tatil, resmî tatiller, 7499 sayılı Kanun ve Mühlet Süre’nin gizliliği hakkında sık sorulan sorular.',
  jsonld: faqLd(FAQ),
  body: `${crumbs([['./', 'Ana sayfa'], [null, 'Sık sorulan sorular']])}
<article class="prose">
<h1>Sık sorulan sorular</h1>
<p class="lead">Aradığınız cevabı bulamazsanız <a href="mailto:${SITE.email}">bize yazın</a>.</p>
${faqHtml(FAQ)}
</article>`,
}));

// ---------- gizlilik.html ----------
out('gizlilik.html', page({
  root: './', current: '', path: 'gizlilik.html',
  title: 'Gizlilik ve KVKK Aydınlatma Metni | Mühlet Süre',
  description: 'Mühlet Süre hangi verileri işler, hangilerini işlemez? Evrakınız ve kayıtlarınız cihazınızdan çıkmaz. KVKK kapsamındaki aydınlatma metni.',
  body: `${crumbs([['./', 'Ana sayfa'], [null, 'Gizlilik ve KVKK']])}
<article class="prose">
<h1>Gizlilik ve KVKK aydınlatma metni</h1>
<p class="muted">Son güncelleme: ${SITE.rulesUpdated}</p>

<div class="callout"><strong>Kısaca:</strong> Mühlet Süre’ye üye olmazsınız, çerez ve ziyaretçi takibi kullanmayız. Yüklediğiniz evrak ve kaydettiğiniz süreler yalnızca sizin tarayıcınızda işlenir; bize ulaşmaz.</div>

<h2>1. Veri sorumlusu</h2>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında veri sorumlusu ${esc(SITE.owner)}’dır (“Mühlet Süre”). İletişim: <a href="mailto:${SITE.email}">${esc(SITE.email)}</a></p>

<h2>2. İşlemediğimiz veriler</h2>
<ul>
  <li><b>Evrak:</b> “Evrakı bırakın” bölümüne yüklediğiniz UDF, PDF ya da metin dosyası tarayıcınızda okunur, hiçbir sunucuya gönderilmez ve sayfa kapandığında silinir.</li>
  <li><b>Sürelerim:</b> Kaydettiğiniz dosya kodu, not ve tarihler yalnızca tarayıcınızın yerel depolama alanında tutulur. Bu verilere erişimimiz yoktur.</li>
  <li><b>Hesaplamalar:</b> Girdiğiniz tarih ve işlem türleri sunucuya gönderilmez.</li>
</ul>
<p>Kayıtlara müvekkil adı, TC kimlik numarası veya dava içeriği yazmamanızı rica ederiz. Avukat–müvekkil gizliliğine ilişkin yükümlülük, cihazınızda tuttuğunuz bilgiler bakımından sizdedir.</p>

<h2>3. İşlenen veriler ve amaçları</h2>
<ul>
  <li><b>Sunucu erişim kayıtları:</b> Site GitHub Pages (GitHub, Inc., ABD) üzerinde barındırılmaktadır. Sayfayı açtığınızda IP adresiniz ve tarayıcı bilgileriniz, hizmetin güvenli sunulması amacıyla barındırma sağlayıcısı tarafından teknik olarak işlenir.</li>
  <li><b>Yazı tipleri:</b> Sayfadaki yazı tipleri Google Fonts (Google LLC, ABD) üzerinden yüklenir. Bu sırada IP adresiniz Google’a iletilir.</li>
  <li><b>İletişim:</b> Bize e-posta gönderirseniz ad, e-posta adresi ve mesaj içeriğiniz yalnızca talebinizi yanıtlamak ve hataları düzeltmek amacıyla işlenir.</li>
</ul>
<p>Bu veriler KVKK m.5/2-f (meşru menfaat) ve m.5/2-c (hizmetin sunulması) hukuki sebeplerine dayanılarak işlenir. Barındırma ve yazı tipi hizmetleri yurt dışında bulunduğundan veriler KVKK m.9 kapsamında yurt dışına aktarılmaktadır.</p>

<h2>4. Çerezler</h2>
<p>Mühlet Süre çerez, reklam ya da ziyaretçi analizi aracı kullanmaz. Sürelerim listesi için kullanılan yerel depolama, yalnızca sizin cihazınızda çalışır ve silinebilir.</p>

<h2>5. Haklarınız</h2>
<p>KVKK m.11 uyarınca kişisel verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltilmesini veya silinmesini isteme ve itiraz etme haklarına sahipsiniz. Taleplerinizi <a href="mailto:${SITE.email}">${esc(SITE.email)}</a> adresine iletebilirsiniz.</p>

<p class="muted">Bu metin hizmet geliştikçe güncellenebilir. Ücretli hizmetler, hesap açma ya da sunucu tarafında veri saklama eklenirse metin yeniden düzenlenecektir.</p>
</article>`,
}));

// ---------- kullanim-kosullari.html ----------
out('kullanim-kosullari.html', page({
  root: './', current: '', path: 'kullanim-kosullari.html',
  title: 'Kullanım Koşulları | Mühlet Süre',
  description: 'Mühlet Süre yasal süre hesaplayıcısının kullanım koşulları: hizmetin niteliği, sorumluluk ve kullanıcının yükümlülükleri.',
  body: `${crumbs([['./', 'Ana sayfa'], [null, 'Kullanım koşulları']])}
<article class="prose">
<h1>Kullanım koşulları</h1>
<p class="muted">Son güncelleme: ${SITE.rulesUpdated}</p>

<h2>1. Hizmetin niteliği</h2>
<p>Mühlet Süre, yasal sürelerin son gününü hesaplamaya yardımcı olan ücretsiz bir araçtır. Sunulan sonuçlar ve açıklamalar <b>hukuki görüş veya danışmanlık değildir</b>; avukatlık hizmeti yerine geçmez.</p>

<h2>2. Sorumluluk</h2>
<p>Hesaplamaların doğru olması için özen gösterilir ve her sonuçta hesabın adımları ile kanun dayanağı gösterilir. Bununla birlikte mevzuat değişiklikleri, içtihat farklılıkları, özel kanun hükümleri, mahkemece verilen ek süreler ve dosyaya özgü durumlar hesaba yansımayabilir. Sürenin kontrolü ve işlemin zamanında yapılması kullanıcının sorumluluğundadır. Hizmetin kullanımından doğabilecek hak kayıplarından Mühlet Süre sorumlu tutulamaz.</p>
<p>Site şu an <b>test sürümündedir</b>; süre kuralları henüz bir avukat tarafından doğrulanmamıştır.</p>

<h2>3. Kullanıcının yükümlülükleri</h2>
<ul>
  <li>Sürelerim kayıtlarına müvekkil adı, TC kimlik numarası, dava içeriği gibi kişisel veya gizli bilgi girmemek.</li>
  <li>Sonuçları işlem yapmadan önce kendisi kontrol etmek.</li>
  <li>Siteyi hukuka aykırı amaçlarla ya da hizmetin işleyişini bozacak şekilde kullanmamak.</li>
</ul>

<h2>4. Veriler</h2>
<p>Evrak ve kayıtlar yalnızca kullanıcının cihazında işlenir. Tarayıcı verilerinin silinmesi hâlinde kayıtlar kaybolur; düzenli yedek almak kullanıcının sorumluluğundadır. Ayrıntılar için <a href="gizlilik.html">Gizlilik ve KVKK</a> sayfasına bakın.</p>

<h2>5. Fikri mülkiyet</h2>
<p>Sitenin tasarımı ve içeriği Mühlet Süre’ye aittir. PDF okuma için Mozilla’nın açık kaynaklı pdf.js kütüphanesi (Apache 2.0 lisansı) kullanılmaktadır.</p>

<h2>6. Değişiklikler ve uygulanacak hukuk</h2>
<p>Bu koşullar güncellenebilir; güncel metin bu sayfada yayımlanır. Koşullara Türk hukuku uygulanır.</p>
</article>`,
}));

// ---------- 404.html ----------
const basePath = new URL(SITE.BASE_URL).pathname;
out('404.html', page({
  root: basePath, current: '', path: '404.html', noindex: true,
  title: 'Sayfa bulunamadı | Mühlet Süre', description: 'Aradığınız sayfa bulunamadı.',
  body: `<div class="notfound">
<p class="eyebrow">404</p>
<h1>Bu sayfa bulunamadı</h1>
<p class="lead">Bağlantı değişmiş ya da yanlış yazılmış olabilir.</p>
<div class="hero-cta"><a class="btn primary" href="${basePath}">Süre hesaplayıcıya dön</a><a class="btn ghost" href="${basePath}sureler/">Süre rehberi</a></div>
</div>`,
}));

// ---------- Süre rehberi ----------
const groups = [...new Set(RULES.map((r) => r.group))];
out('sureler/index.html', page({
  root: '../', current: 'sureler', path: 'sureler/',
  title: 'Yasal Süreler Rehberi: HMK, CMK, İİK, İYUK | Mühlet Süre',
  description: 'Hukuk, ceza, icra ve idari yargıdaki başlıca yasal süreler: kaç gün, ne zaman başlar, adli tatilden nasıl etkilenir. Her süre için örnek hesap.',
  body: `${crumbs([['../', 'Ana sayfa'], [null, 'Süre rehberi']])}
<section class="prose wide">
<h1>Yasal süreler rehberi</h1>
<p class="lead">Her sürenin kanun dayanağı, başlangıcı, adli tatil etkisi ve hesaplayıcının ürettiği örnek hesaplar.</p>
</section>
${groups.map((g) => `<section class="block">
<h2>${esc(g)}</h2>
<div class="grid links">
${RULES.filter((r) => r.group === g).map((r) => { const v = lastVersion(r); return `  <a href="${RULE_PAGES[r.code].slug}.html"><b>${esc(r.name)}</b><span>${v.amount} ${unitTR[v.unit]} · ${esc(v.law.replace(/ \(.*\)/, ''))}</span></a>`; }).join('\n')}
</div>
</section>`).join('\n')}`,
}));

for (const r of RULES) {
  const p = RULE_PAGES[r.code];
  const v = lastVersion(r);
  const examples = p.examples.map(([serviceType, eventDate, decisionDate]) => {
    const res = calculate({ ruleCode: r.code, serviceType, eventDate, decisionDate, recessExempt: false });
    const steps = res.trace.map((s) => `<li><div>${s.dateText ? `<strong>${esc(s.dateText)}</strong>` : ''}<span class="t">${esc(s.text)}</span>${s.basis ? `<span class="b">${esc(s.basis)}</span>` : ''}</div></li>`).join('');
    const alts = res.alternatives.map((a) => `<p class="alt">${esc(a.reason)}: <b>${esc(a.text)}</b>.</p>`).join('');
    const warns = res.warnings.map((w) => `<p class="alt">${esc(w.text)}</p>`).join('');
    return `<div class="example card">
  <p class="ex-head">${TEBLIG[serviceType]}: ${esc(formatTR(parse(eventDate)))}${decisionDate ? ` · karar tarihi ${esc(formatTR(parse(decisionDate)))}` : ''}</p>
  <p class="ex-last">Son gün: <b>${esc(res.lastDayText)} ${esc(res.lastDayWeekday)}</b></p>
  ${alts}${warns}
  <ol class="mini-steps">${steps}</ol>
</div>`;
  }).join('\n');
  const related = RULES.filter((x) => x.group === r.group && x.code !== r.code);
  out(pageUrl(r.code), page({
    root: '../', current: 'sureler', path: pageUrl(r.code),
    title: `${p.title} | Mühlet Süre`,
    description: `${r.name}: ${v.amount} ${unitTR[v.unit]} (${v.law.replace(/ \(.*\)/, '')}). Sürenin başlangıcı, adli tatil etkisi ve örnek hesaplar. Son günü ücretsiz hesaplayın.`,
    jsonld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: SITE.BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Süre rehberi', item: `${SITE.BASE_URL}sureler/` },
      { '@type': 'ListItem', position: 3, name: p.title } ] },
    body: `${crumbs([['../', 'Ana sayfa'], ['./', 'Süre rehberi'], [null, r.name]])}
<article class="rule-page">
<div class="prose wide">
<p class="eyebrow">${esc(r.group)}</p>
<h1>${esc(p.title)}</h1>
<p class="lead">${esc(p.intro)}</p>
</div>

<dl class="facts card">
  <div><dt>Süre</dt><dd>${v.amount} ${unitTR[v.unit]}</dd></div>
  <div><dt>Başlangıç</dt><dd>${esc(r.startLabel)}</dd></div>
  <div><dt>Kanun dayanağı</dt><dd>${esc(v.law)}</dd></div>
  <div class="wide"><dt>Adli tatil</dt><dd>${esc(RECESS[r.court])}</dd></div>
${r.needsDecisionDate ? `  <div class="wide"><dt>Dikkat</dt><dd>7499 öncesi kararlarda eski süre (${r.versions[0].amount} ${unitTR[r.versions[0].unit]}) uygulanabilir. Hesaplayıcı karar tarihine göre doğru sürümü seçer.</dd></div>\n` : ''}</dl>

<div class="cta-band">
  <div><b>Bu süreyi kendi tarihinizle hesaplayın</b><span>e-Tebligatın 5 gün kuralı, adli tatil ve bayramlar otomatik uygulanır.</span></div>
  <a class="btn accent" href="../#${r.code}">Hesaplayıcıyı aç</a>
</div>

<section class="block">
<h2>Örnek hesaplar</h2>
<p class="block-lead">Aşağıdaki sonuçlar hesaplayıcı tarafından üretilmiştir.</p>
<div class="examples">
${examples}
</div>
</section>

<section class="block">
<h2>${esc(r.group)} grubundaki diğer süreler</h2>
<div class="grid links">
${related.map((x) => `  <a href="${RULE_PAGES[x.code].slug}.html"><b>${esc(x.name)}</b><span>${lastVersion(x).amount} ${unitTR[lastVersion(x).unit]}</span></a>`).join('\n')}
</div>
</section>

<p class="disclaimer-box">Bu sayfa bilgilendirme amaçlıdır, hukuki görüş değildir. Özel kanun hükümleri, mahkemece verilen ek süreler ve dosyaya özgü durumlar sonucu değiştirebilir. Son kontrol avukattadır.</p>
</article>`,
  }));
}

// ---------- sitemap, robots, manifest ----------
const urls = ['', 'sureler/', 'sss.html', 'gizlilik.html', 'kullanim-kosullari.html', ...RULES.map((r) => pageUrl(r.code))];
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.BASE_URL}${u}</loc></url>`).join('\n')}
</urlset>
`);
out('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE.BASE_URL}sitemap.xml\n`);
out('manifest.webmanifest', JSON.stringify({
  name: 'Mühlet Süre – Yasal Süre Hesaplayıcı', short_name: 'Mühlet Süre', lang: 'tr',
  start_url: './', scope: './', display: 'standalone', background_color: '#f5f7fa', theme_color: '#1f3a5f',
  description: 'Avukatlar için yasal süre hesaplayıcı.',
  icons: [
    { src: 'img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'img/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2) + '\n');

console.log(`Üretildi: index.html, sss, gizlilik, kullanım koşulları, 404, ${RULES.length + 1} rehber sayfası, sitemap, robots, manifest`);
