# Mühlet Süre — Yasal Süre Hesaplayıcı

Avukatlar için ücretsiz son gün hesaplayıcı ve tarayıcıda çalışan süre listesi (**Sürelerim**). e-Tebligat (5. gün kuralı), adli tatil (HMK, CMK, İYUK politikaları), resmî tatiller ve hafta sonları dahil. Hesabın her adımını kanun dayanağıyla gösterir. Uygulamada yorum farkı olan durumlarda en erken (temkinli) tarihi son gün olarak gösterir, diğer tarihi uyarı olarak verir.

> ⚠️ **Test sürümü.** Süre kuralları ve tatil tarihleri henüz bir avukat tarafından doğrulanmadı. Sitenin üstündeki uyarı bandını, doğrulama tamamlanmadan kaldırmayın.

Site tamamen statiktir: sunucu, veritabanı ya da kurulum gerekmez. Girilen bilgiler hiçbir yere gönderilmez, hesap tarayıcıda yapılır.

## Evrakı bırak, süre gelsin

- Avukat UYAP'tan indirdiği UDF ya da PDF evrakını sayfaya bırakır (ya da metni yapıştırır).
- Evrak **tarayıcıda** okunur, hiçbir yere gönderilmez. PDF okumak için pdf.js kütüphanesi sitenin içinde gelir (`vendor/pdfjs`, Apache 2.0 lisansı); internetten indirilmez.
- `js/classify.js` anahtar sözcüklerle belge türünü tahmin eder (hukuk/ceza/idari karar, bölge adliye kararı, bilirkişi raporu, dava dilekçesi, cevap dilekçesi, ödeme emri, vergi ihbarnamesi) ve karar tarihini bulur.
- Sonuç **sadece öneridir**: kullanıcı "forma aktar"a basınca işlem ve (ceza işlerinde) karar tarihi forma girilir; ulaşma tarihini kullanıcı girer ve hesaplamayı kendisi başlatır.
- **Doğrulanması gereken:** UDF dosyasının iç yapısı (ZIP içinde `content.xml`, metin CDATA içinde) gerçek UYAP örnekleriyle test edilmedi. Danışman avukattan kişisel bilgileri silinmiş 5–10 gerçek UDF/PDF evrak alıp `tests/classify.test.mjs`'e test olarak ekleyin.
- Taranmış (görüntü) PDF'lerde metin olmadığı için tanıma çalışmaz; kullanıcıya metni yapıştırması söylenir.

## Sürelerim nasıl çalışır?

- Hesaplanan süre, kısa bir dosya koduyla (en fazla 60 karakter) ve isteğe bağlı kısa bir notla (en fazla 140 karakter) kaydedilir. Müvekkil bilgisi istenmez.
- Kayıtlar **sadece kullanıcının tarayıcısında** (localStorage) durur. Sunucu yok, KVKK açısından veri sitenin sahibine hiç ulaşmaz. Karşılığında başka cihazda görünmez ve tarayıcı verileri silinirse kaybolur. Bu yüzden "Yedek al / Yedeği geri yükle" var.
- Liste, son güne kalan süreyi renkli etiketle gösterir: geçti / bugün / 3 gün / 7 gün.
- "Açık süreleri takvime aktar" her süre için 7 gün, 3 gün kala ve son gün hatırlatmalı bir .ics dosyası indirir. Not alanı takvime gitmez; kısa kod etkinlik başlığında görünür.
- Kurallar ya da tatil verisi güncellendiğinde kayıtlı süreler yeniden hesaplanır; tarih değişiyorsa kendiliğinden değiştirilmez, kullanıcıya gösterilip onayı istenir.

## Klasör yapısı

```
index.html            Ana sayfa (üst menü, alt bilgi ve SSS bölümü build ile doldurulur)
sss.html, gizlilik.html, kullanim-kosullari.html, 404.html   Üretilen sayfalar
sureler/              Süre rehberi: her süre için ayrı sayfa (üretilir)
sitemap.xml, robots.txt, manifest.webmanifest              Üretilen dosyalar
sw.js, js/pwa.js      Telefona kurulabilme ve internetsiz açılma
img/                  Simge ve paylaşım görseli
tools/site.mjs        Site ayarları: adres, e-posta, sahip adı, menü ve alt bilgi
tools/content.mjs     SSS ve süre rehberi metinleri
tools/build.mjs       Sayfa üretici (npm run build)
js/config.js          Bulut ayarı (Supabase adresi ve herkese açık anahtar; boşsa bulut kapalı)
js/cloud.js           Supabase istemcisi: e-posta koduyla giriş, eşitleme
js/account.js         Sürelerim'deki "E-posta ile hatırlatma" bölümü
supabase/             Veritabanı şeması, zamanlayıcı ve sunucu fonksiyonları
KURULUM-HATIRLATMA.md E-posta hatırlatmayı açmak için adım adım kurulum
css/style.css         Görünüm
js/rules.js           13 süre kuralı (kanun dayanağı ve sürümleriyle)
js/holidays.js        2025–2027 resmî tatil ve dini bayram tarihleri
js/engine.js          Hesaplama motoru (arayüzden bağımsız)
js/store.js           Sürelerim: tarayıcıda kayıt, durum, yedek, toplu takvim dosyası
js/app.js             Arayüz: form, sonuç, Sürelerim listesi, takvim dosyası, kopyalama
js/classify.js        Evrak metninden belge türü ve süre önerisi
js/docreader.js       UDF / PDF / TXT dosyasından metin çıkarma (tarayıcıda)
js/evrak.js           Evrakı bırak arayüzü
vendor/pdfjs/         pdf.js (Mozilla, Apache 2.0)
tests/engine.test.mjs Motorun otomatik testleri
tests/store.test.mjs  Sürelerim testleri
tests/classify.test.mjs Belge türü tanıma testleri
.github/workflows/    Her gönderimde testleri GitHub'da çalıştırır
```

## GitHub'a yükleyip yayına almak (kod bilmeden)

1. github.com'da sağ üstteki **+** → **New repository**. Ad: `muhlet-sure`. **Public** seç (GitHub Pages ücretsiz planda public repo ister). **Create repository**.
2. Açılan sayfada **uploading an existing file** linkine tıkla.
3. Bu zip'ten çıkan **klasörün içindekileri** (index.html, css, js, tests, README.md, package.json, .github) sürükleyip bırak. Klasörün kendisini değil, içini sürükle.
   - Not: `.github` gizli bir klasör olduğu için bilgisayarında görünmeyebilir. Görünmezse sorun değil, site yine çalışır; sadece otomatik testler GitHub'da çalışmaz.
4. **Commit changes**.
5. Repoda **Settings → Pages** → Source: **Deploy from a branch**, Branch: **main** / **(root)** → **Save**.
6. 1–2 dakika sonra site şu adreste açılır: `https://KULLANICI-ADIN.github.io/muhlet-sure/`

## Yayından önce değiştirmen gerekenler

`tools/site.mjs` içinde:
- `email: '[E-POSTA-ADRESIN]'` → iletişim e-postan
- `owner: '[AD SOYAD]'` → KVKK metnindeki veri sorumlusu (senin adın)
- `BASE_URL` → kendi alan adına geçince yeni adres

Sonra `npm run build` çalıştır; tüm sayfalar yeniden üretilir. (Ya da değerleri bana yaz, ben üretip göndereyim.)

Metinleri değiştirmek için `tools/content.mjs` (SSS, süre rehberi) ve `tools/build.mjs` (gizlilik, kullanım koşulları) dosyalarını düzenleyip yine `npm run build` çalıştır. Üretilen .html dosyalarını elle düzenleme; bir sonraki build'de üzerine yazılır.

Gizlilik ve kullanım koşulları metinleri taslaktır; yayından önce bir avukata okutulmalıdır.

## Bilgisayarında çalıştırmak ve test etmek

Node.js 18+ gerekir.

```bash
npm test                      # motor testlerini çalıştırır
python -m http.server 8000    # sonra tarayıcıda http://localhost:8000
```

`index.html`'e doğrudan çift tıklarsan sayfa çalışmaz; tarayıcılar JavaScript modüllerini `file://` adresinden yüklemez. Yukarıdaki gibi küçük bir sunucuyla aç.

## Kuralları değiştirmek

- **Yeni kural ya da süre değişikliği:** `js/rules.js`. Bir kanun değişikliğinde eski kuralı silme; `versions` listesine `validFrom` / `validTo` tarihli yeni bir sürüm ekle (CMK istinaf örneğine bak).
- **Yeni yıl tatilleri:** `js/holidays.js` → `religious` içine o yılın Ramazan ve Kurban Bayramı tarihlerini resmî kaynaktan ekle. Sabit tatiller otomatik eklenir.
- Her değişiklikten sonra `npm test` çalıştır ve avukatın hazırladığı örnekleri `tests/engine.test.mjs`'e test olarak ekle.

## Avukata doğrulatılacak varsayımlar

Kodda temkinli seçilen ve doğrulama bekleyen noktalar:

1. **HMK m.104 / İYUK m.8:** Uzatmanın son günü 7 Eylül mü 8 Eylül mü? Erken olan gösteriliyor, diğeri uyarıda.
2. **CMK m.331/4:** Son gün tatildeyse 31 Ağustos + 3 gün. Tebliğ tatil içindeyse sürenin hiç işlemeyeceği yorumu yalnızca uyarı olarak gösteriliyor.
3. **İİK:** İcra dairesi işlemlerinde adli tatil uzatması uygulanmıyor.
4. **e-Tebligat:** 5. gün tatile denk gelirse tebliğin kaymadığı (erken) tarih esas alınıyor, kayan tarih alternatif olarak veriliyor.
5. **Kaydırmayla tatile giren son gün** (ör. 18 Temmuz Cumartesi → 20 Temmuz): uzatma uygulanmıyor, uzatmalı tarih alternatif.
6. **Arife (yarım gün):** iş günü sayılıyor, uyarı veriliyor.
7. **CMK 7499 geçişi:** 1 Haziran 2024 ve sonrası tarihli kararlara yeni süreler uygulanıyor.
8. **Hafta sonu/tatil kaydırma dayanakları:** HMK m.93, İYUK m.8/2, CMK m.39/3, İİK m.19.

## Lisans ve sorumluluk

Bu araç yardımcı bir araçtır, hukuki görüş değildir. Son kontrol ve sorumluluk avukattadır.
