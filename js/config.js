// Bulut (e-posta hatırlatma) ayarları. Boş bırakılırsa site eskisi gibi yalnızca tarayıcıda çalışır
// ve Hesap bölümü görünmez. Değerler: Supabase → Project Settings → API.
// "publishable" (eski adıyla "anon public") anahtarı herkese açık olacak şekilde tasarlanmıştır; sitede durması güvenlidir.
// "service_role" anahtarını ASLA buraya yazmayın.
export const CLOUD = {
  url: 'https://ibdsnrxacctnhctznzbe.supabase.co',
  anonKey: 'sb_publishable_z0PG6XvE86gbUKJMWBb_Dg_NXpqXx2Q', // herkese açık (publishable) anahtar
};
export const cloudEnabled = () => Boolean(CLOUD.url && CLOUD.anonKey);
