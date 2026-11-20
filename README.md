# Mühlet Süre — Yasal Süre Hesaplayıcı

Avukatlar için ücretsiz son gün hesaplayıcı. e-Tebligat (5. gün kuralı), adli tatil (HMK, CMK, İYUK politikaları), resmî tatiller ve hafta sonları dahil. Hesabın her adımını kanun dayanağıyla gösterir. Uygulamada yorum farkı olan durumlarda en erken (temkinli) tarihi son gün olarak gösterir, diğer tarihi uyarı olarak verir.

> ⚠️ **Test sürümü.** Süre kuralları ve tatil tarihleri henüz bir avukat tarafından doğrulanmadı. Sitenin üstündeki uyarı bandını, doğrulama tamamlanmadan kaldırmayın.

Site tamamen statiktir: sunucu, veritabanı ya da kurulum gerekmez. Girilen bilgiler hiçbir yere gönderilmez, hesap tarayıcıda yapılır.

## Klasör yapısı

```
index.html            Sayfa
css/style.css         Görünüm
js/rules.js           13 süre kuralı (kanun dayanağı ve sürümleriyle)
js/holidays.js        2025–2027 resmî tatil ve dini bayram tarihleri
js/engine.js          Hesaplama motoru (arayüzden bağımsız)
js/app.js             Arayüz: form, sonuç, takvim dosyası, kopyalama
tests/engine.test.mjs Motorun otomatik testleri
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

`index.html` içinde:
- `[E-POSTA-ADRESIN]` → kendi e-posta adresin (2 yerde)
- `[TARİH]` → kuralların avukat tarafından son doğrulandığı tarih

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
