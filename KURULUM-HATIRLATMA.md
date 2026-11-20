# E-posta hatırlatma kurulumu (ücretsiz beta)

Bu rehber, sitedeki **"E-posta ile hatırlatma"** bölümünü çalışır hâle getirir. Kod hazır; yapman gereken, iki ücretsiz hesap açıp birkaç ayarı yapıştırmak. Toplam süre yaklaşık 1–1,5 saat.

**Neler kurulacak:**
- **Supabase:** Giriş sistemi ve veritabanı. Ücretsiz, sunucusu Frankfurt'ta.
- **Resend:** E-posta gönderimi. Ücretsiz planda ayda 3.000 e-posta.
- **Zamanlayıcı:** Her sabah 08.00'de hatırlatmaları gönderir.

> **Önemli ön koşul: kendi alan adın.** Gerçek kullanıcılara e-posta gönderebilmek için `muhletsure.com` gibi bir alan adı gerekiyor; e-postalar `hatirlatma@muhletsure.com` gibi bir adresten gider. Alan adı olmadan sistem sadece **senin kendi e-posta adresinle** test edilebilir. Test için A, C, D ve E bölümlerini yapman yeterli; B bölümü (Resend) alan adını alınca yapılır.

---

## A. Supabase projesini aç (15 dk)

1. **supabase.com** adresine git → **Start your project** → **Continue with GitHub** ile giriş yap.
2. **New project** düğmesine bas ve şunları doldur:
   - **Name:** `muhlet-sure`
   - **Database Password:** Uzun bir şifre üret ve bir yere kaydet.
   - **Region:** **Central EU (Frankfurt)**. Bu seçim KVKK açısından önemli.
   - **Plan:** Free
   → **Create new project**. Projenin hazırlanması 1–2 dakika sürer.
3. Soldaki menüden **SQL Editor** → **New query**'yi seç. Projedeki `supabase/migrations/001_hesap_ve_sureler.sql` dosyasının **tamamını** kopyalayıp yapıştır, sonra **Run**'a bas. "Success. No rows returned" görmelisin.
4. **Authentication → Sign In / Providers** sayfasında **Email**'in açık olduğunu kontrol et.
5. **Authentication → URL Configuration** sayfasında **Site URL** alanına sitenin adresini yaz (`https://batuhanmerc.github.io/muhlet-sure/`) ve kaydet.
6. *(B bölümünden sonra)* Supabase, e-posta şablonlarını ancak özel SMTP (Resend) bağlandıktan sonra düzenlemeye izin veriyor. O zamana kadar giriş e-postasında **bağlantı** gelir; site bu bağlantıyla da giriş yapar. SMTP bağlandıktan sonra **Authentication → Emails → Templates** sayfasında hem **Confirm signup** hem de **Magic Link** şablonunu aşağıdaki gibi değiştir; böylece telefonda da kolay olan 6 haneli kod gelir.
   - **Subject:** `Mühlet Süre giriş kodunuz: {{ .Token }}`
   - **Body:**
     ```html
     <div style="font-family:Arial,sans-serif;max-width:480px">
       <h2 style="color:#1f3a5f">Mühlet Süre</h2>
       <p>Giriş kodunuz:</p>
       <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
       <p style="color:#5b6b82">Kod 1 saat geçerlidir. Bu isteği siz yapmadıysanız e-postayı yok sayın.</p>
     </div>
     ```
7. **Project Settings → API Keys** (ya da **API**) sayfasından iki değeri kopyala:
   - **Project URL**, örneğin `https://abcdefgh.supabase.co`
   - **publishable** anahtarı (`sb_publishable_...` ile başlar; eski projelerde adı "anon public")

   > `service_role` ya da `secret` anahtarını **hiçbir yere yapıştırma**; o anahtar yönetici anahtarıdır.

8. Bu iki değeri projedeki `js/config.js` dosyasına yaz. GitHub'da dosyayı açıp kalem simgesiyle düzenleyebilirsin:
   ```js
   export const CLOUD = {
     url: 'https://abcdefgh.supabase.co',
     anonKey: 'eyJhbGciOi....',
   };
   ```
   Dosyayı kaydedince sitedeki **Sürelerim** bölümünde "E-posta ile hatırlatma" kutusu görünür.

> **Bilgi:** Supabase'in kendi e-posta servisi, kurulum aşamasında sadece **senin hesabının e-posta adresine** kod gönderir. Başka kullanıcılara gönderebilmek için B bölümü gerekiyor.

---

## B. Resend ile e-posta gönderimi (alan adı aldıktan sonra, 20 dk)

1. **resend.com** adresinde hesap aç.
2. **Domains → Add Domain** sayfasında alan adını gir (örn. `muhletsure.com`). Resend sana 3–4 DNS kaydı verir. Bunları alan adını aldığın firmanın (Natro, GoDaddy, Cloudflare vb.) **DNS ayarlarına** ekle. Doğrulama birkaç dakika ile birkaç saat sürebilir.
3. **API Keys → Create API Key** ile bir anahtar oluştur ve kopyala.
4. Supabase'te **Authentication → Emails → SMTP Settings** sayfasında **Enable custom SMTP**'yi aç ve şunları gir:
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** Resend API anahtarın
   - **Sender email:** `hatirlatma@muhletsure.com`
   - **Sender name:** `Mühlet Süre`
5. Aynı yerde **Rate Limits** bölümünde e-posta sınırını ihtiyacına göre yükselt (örn. saatte 100).

---

## C. Sunucu fonksiyonlarını yükle (15 dk)

1. Supabase'te **Edge Functions → Deploy a new function → Via Editor**'ı seç.
2. **Fonksiyon adı:** `send-reminders`. Editördeki örnek kodu tamamen sil, projedeki `supabase/functions/send-reminders/index.ts` dosyasının tamamını yapıştır ve **Deploy function**'a bas.
3. Aynı adımları `delete-account` adıyla ve `supabase/functions/delete-account/index.ts` dosyasıyla tekrarla.
4. Her iki fonksiyonun **Settings** sekmesinde **Verify JWT with legacy secret** ayarını **kapat** ve kaydet. (Fonksiyonlar kimlik kontrolünü kendileri yapıyor: biri `CRON_SECRET` ile, diğeri kullanıcının oturumuyla.)
5. **Edge Functions → Secrets** (ya da *Manage secrets*) sayfasında şu 4 değeri ekle:

   | Ad | Değer |
   |---|---|
   | `CRON_SECRET` | Rastgele uzun bir metin, örn. `k3J9-xQ2m-7Vt8-pL4w-Zr6n`. Bir yere not et, D bölümünde lazım olacak. |
   | `SITE_URL` | `https://batuhanmerc.github.io/muhlet-sure/` |
   | `RESEND_API_KEY` | Resend anahtarın (B bölümü). Henüz yoksa sonra eklersin. |
   | `MAIL_FROM` | `Mühlet Süre <hatirlatma@muhletsure.com>` |

---

## D. Her sabah çalışacak zamanlayıcı (5 dk)

1. Supabase'te **Database → Extensions** sayfasında **pg_cron** ve **pg_net**'i bul ve ikisini de aç (ya da SQL Editor'de `create extension if not exists pg_cron with schema pg_catalog; create extension if not exists pg_net with schema extensions;` çalıştır).
2. **SQL Editor → New query** ile `supabase/migrations/002_zamanlayici.sql` dosyasının içeriğini yapıştır. Çalıştırmadan önce 3 yeri kendi değerlerinle değiştir:
   - `PROJE-KODU`: Proje adresindeki kod (`https://abcdefgh.supabase.co` → `abcdefgh`)
   - `ANON-ANAHTAR`: A bölümünün 7. adımındaki publishable anahtar
   - `CRON-SIFRESI`: C bölümünde yazdığın `CRON_SECRET`
3. Değerleri değiştirdikten sonra **Run**'a bas.

---

## E. Test et (10 dk)

1. Siteyi aç, bir süre hesapla ve **Sürelerime kaydet**'e bas. Son günü **önümüzdeki 7 gün içinde** olan bir süre seç, örneğin bugünden 3 gün önceki bir e-Tebligat tarihiyle Ödeme emrine itiraz.
2. Sürelerim bölümündeki kutuda e-posta adresini yaz, onay kutusunu işaretle ve **Giriş kodu gönder**'e bas. Gelen kodu girip giriş yap. Supabase → **Table Editor → deadlines** tablosunda kaydı görmelisin.
3. Hatırlatmayı beklemeden denemek için **SQL Editor**'de şunu çalıştır (değerleri D bölümündeki gibi değiştir):
   ```sql
   select net.http_post(
     url := 'https://PROJE-KODU.supabase.co/functions/v1/send-reminders',
     headers := jsonb_build_object('Content-Type','application/json','apikey','ANON-ANAHTAR','x-cron-secret','CRON-SIFRESI'),
     body := '{}'::jsonb
   );
   ```
   Birkaç saniye içinde hatırlatma e-postası gelmeli. Gelmezse **Edge Functions → send-reminders → Logs** sayfasına bak. Aynı hatırlatma ikinci kez gönderilmez; tekrar denemek için **Table Editor → reminders_sent** tablosundaki satırı sil.
4. Sitede **Hesabımı sil**'i dene. Kullanıcı ve kayıtları Supabase'ten silinmeli.

---

## Hukuki notlar (avukata sor)

- Gizlilik metni bu özelliğe göre güncellendi; içinde Supabase (Almanya) ve Resend (ABD) adları geçiyor. Avukata okut.
- Verilerin yurt dışına aktarımı için KVKK m.9 kapsamında **standart sözleşme** imzalanması ve imzadan sonra **5 iş günü içinde Kurum'a bildirilmesi** gerekebilir. Supabase ve Resend'in veri işleme sözleşmeleri (DPA) var; avukatla birlikte hangi belgenin yeterli olduğunu netleştir.
- Kişisel veri işleyen bir hizmet olduğundan VERBİS kaydı gerekip gerekmediğini de sor.

## Bilinmesi gerekenler

- **Ücretsiz Supabase projesi** uzun süre hiç kullanılmazsa durdurulabilir. Günlük zamanlayıcı ve kullanıcı girişleri bunu genellikle önler; durdurulursa panelden tek tıkla yeniden başlatılır.
- **Notlar** sunucuya hiç gitmez. Bu bilinçli bir gizlilik tercihi.
- Kullanıcı başına en fazla **2.000 kayıt** sınırı var.
- Ödeme sistemi bu aşamada yok. Beta bitince iyzico bağlanacak.
