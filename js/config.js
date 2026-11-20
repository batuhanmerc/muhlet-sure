// Bulut (e-posta hatırlatma) ayarları. Boş bırakılırsa site eskisi gibi yalnızca tarayıcıda çalışır
// ve Hesap bölümü görünmez. Değerler: Supabase → Project Settings → API.
// "anon public" anahtarı herkese açık olacak şekilde tasarlanmıştır; sitede durması güvenlidir.
// "service_role" anahtarını ASLA buraya yazmayın.
export const CLOUD = {
  url: '',      // ör. https://abcdefghijkl.supabase.co
  anonKey: '',  // ör. eyJhbGciOi...
};
export const cloudEnabled = () => Boolean(CLOUD.url && CLOUD.anonKey);
