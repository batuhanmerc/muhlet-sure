// Türkiye resmî tatilleri (2429 sayılı Kanun) ve dini bayramlar.
// type: 'full' = tam gün tatil, 'half' = arife (13.00'ten sonra tatil).
// Dini bayram tarihleri Diyanet takvimine göre her yıl değişir: yeni yılı eklerken resmî kaynaktan kontrol edin.
// ÖNEMLİ: Yayından önce iki kişi tarafından kontrol edilmelidir.

const fixed = (y) => [
  [`${y}-01-01`, 'full', 'Yılbaşı'],
  [`${y}-04-23`, 'full', 'Ulusal Egemenlik ve Çocuk Bayramı'],
  [`${y}-05-01`, 'full', 'Emek ve Dayanışma Günü'],
  [`${y}-05-19`, 'full', "Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  [`${y}-07-15`, 'full', 'Demokrasi ve Millî Birlik Günü'],
  [`${y}-08-30`, 'full', 'Zafer Bayramı'],
  [`${y}-10-28`, 'half', 'Cumhuriyet Bayramı arifesi'],
  [`${y}-10-29`, 'full', 'Cumhuriyet Bayramı'],
];

const religious = {
  2025: [
    ['2025-03-29', 'half', 'Ramazan Bayramı arifesi'],
    ['2025-03-30', 'full', 'Ramazan Bayramı 1. gün'],
    ['2025-03-31', 'full', 'Ramazan Bayramı 2. gün'],
    ['2025-04-01', 'full', 'Ramazan Bayramı 3. gün'],
    ['2025-06-05', 'half', 'Kurban Bayramı arifesi'],
    ['2025-06-06', 'full', 'Kurban Bayramı 1. gün'],
    ['2025-06-07', 'full', 'Kurban Bayramı 2. gün'],
    ['2025-06-08', 'full', 'Kurban Bayramı 3. gün'],
    ['2025-06-09', 'full', 'Kurban Bayramı 4. gün'],
  ],
  2026: [
    ['2026-03-19', 'half', 'Ramazan Bayramı arifesi'],
    ['2026-03-20', 'full', 'Ramazan Bayramı 1. gün'],
    ['2026-03-21', 'full', 'Ramazan Bayramı 2. gün'],
    ['2026-03-22', 'full', 'Ramazan Bayramı 3. gün'],
    ['2026-05-26', 'half', 'Kurban Bayramı arifesi'],
    ['2026-05-27', 'full', 'Kurban Bayramı 1. gün'],
    ['2026-05-28', 'full', 'Kurban Bayramı 2. gün'],
    ['2026-05-29', 'full', 'Kurban Bayramı 3. gün'],
    ['2026-05-30', 'full', 'Kurban Bayramı 4. gün'],
  ],
  2027: [
    ['2027-03-08', 'half', 'Ramazan Bayramı arifesi'],
    ['2027-03-09', 'full', 'Ramazan Bayramı 1. gün'],
    ['2027-03-10', 'full', 'Ramazan Bayramı 2. gün'],
    ['2027-03-11', 'full', 'Ramazan Bayramı 3. gün'],
    ['2027-05-15', 'half', 'Kurban Bayramı arifesi'],
    ['2027-05-16', 'full', 'Kurban Bayramı 1. gün'],
    ['2027-05-17', 'full', 'Kurban Bayramı 2. gün'],
    ['2027-05-18', 'full', 'Kurban Bayramı 3. gün'],
    ['2027-05-19', 'full', 'Kurban Bayramı 4. gün'],
  ],
};

export const SUPPORTED_YEARS = Object.keys(religious).map(Number);

export const HOLIDAYS = new Map();
for (const y of SUPPORTED_YEARS) {
  for (const [d, type, name] of [...fixed(y), ...religious[y]]) {
    // 19 Mayıs 2027 hem bayram hem Kurban Bayramı 4. gün: adlar birleşsin
    const prev = HOLIDAYS.get(d);
    HOLIDAYS.set(d, prev ? { type: prev.type === 'full' || type === 'full' ? 'full' : 'half', name: `${prev.name} / ${name}` } : { type, name });
  }
}
