// Süre kuralları. Her kural kanun/madde dayanağıyla ve gerekiyorsa sürümleriyle tutulur.
// ÖNEMLİ: Bu değerler yayından önce bir avukat tarafından madde metninden doğrulanmalıdır.
// court: hangi adli tatil politikasının uygulanacağını belirler (bkz. engine.js RECESS_POLICIES).

export const RULES = [
  { code: 'HMK-CVP', group: 'Hukuk (HMK)', name: 'Cevap dilekçesi', court: 'HMK', startLabel: 'Dava dilekçesinin tebliği',
    versions: [{ amount: 2, unit: 'week', law: 'HMK m.127' }] },
  { code: 'HMK-REP', group: 'Hukuk (HMK)', name: 'Cevaba cevap / ikinci cevap dilekçesi', court: 'HMK', startLabel: 'Önceki dilekçenin tebliği',
    versions: [{ amount: 2, unit: 'week', law: 'HMK m.136' }] },
  { code: 'HMK-BLR', group: 'Hukuk (HMK)', name: 'Bilirkişi raporuna itiraz', court: 'HMK', startLabel: 'Raporun tebliği',
    versions: [{ amount: 2, unit: 'week', law: 'HMK m.281' }] },
  { code: 'HMK-IST', group: 'Hukuk (HMK)', name: 'İstinaf başvurusu', court: 'HMK', startLabel: 'Kararın tebliği',
    versions: [{ amount: 2, unit: 'week', law: 'HMK m.345' }] },
  { code: 'HMK-TMZ', group: 'Hukuk (HMK)', name: 'Temyiz başvurusu', court: 'HMK', startLabel: 'Kararın tebliği',
    versions: [{ amount: 2, unit: 'week', law: 'HMK m.361' }] },

  { code: 'CMK-IST', group: 'Ceza (CMK)', name: 'İstinaf başvurusu', court: 'CMK', needsDecisionDate: true, startLabel: 'Kararın tefhimi / tebliği',
    versions: [
      { version: 1, validTo: '2024-05-31', amount: 7, unit: 'day', law: 'CMK m.273 (7499 öncesi)' },
      { version: 2, validFrom: '2024-06-01', amount: 2, unit: 'week', law: 'CMK m.273 (7499 sonrası)' },
    ] },
  { code: 'CMK-TMZ', group: 'Ceza (CMK)', name: 'Temyiz başvurusu', court: 'CMK', needsDecisionDate: true, startLabel: 'Kararın tefhimi / tebliği',
    versions: [
      { version: 1, validTo: '2024-05-31', amount: 15, unit: 'day', law: 'CMK m.291 (7499 öncesi)' },
      { version: 2, validFrom: '2024-06-01', amount: 2, unit: 'week', law: 'CMK m.291 (7499 sonrası)' },
    ] },

  { code: 'IIK-ITR', group: 'İcra (İİK)', name: 'Ödeme emrine itiraz (genel haciz)', court: 'IIK', startLabel: 'Ödeme emrinin tebliği',
    versions: [{ amount: 7, unit: 'day', law: 'İİK m.62' }] },
  { code: 'IIK-KMB', group: 'İcra (İİK)', name: 'Kambiyo senedine dayalı takipte itiraz', court: 'IIK', startLabel: 'Ödeme emrinin tebliği',
    versions: [{ amount: 5, unit: 'day', law: 'İİK m.168' }] },
  { code: 'IIK-MAL', group: 'İcra (İİK)', name: 'İtirazın kaldırılması sonrası mal beyanı', court: 'IIK', startLabel: 'Kararın tebliği',
    versions: [{ amount: 3, unit: 'day', law: 'İİK m.75' }] },

  { code: 'IYUK-IDR', group: 'İdari (İYUK)', name: 'İdari dava açma', court: 'IYUK', startLabel: 'Yazılı bildirim (tebliğ)',
    versions: [{ amount: 60, unit: 'day', law: 'İYUK m.7' }] },
  { code: 'IYUK-VRG', group: 'İdari (İYUK)', name: 'Vergi davası açma', court: 'IYUK', startLabel: 'Tebliğ',
    versions: [{ amount: 30, unit: 'day', law: 'İYUK m.7' }] },
  { code: 'IYUK-IST', group: 'İdari (İYUK)', name: 'İstinaf / temyiz başvurusu', court: 'IYUK', startLabel: 'Kararın tebliği',
    versions: [{ amount: 30, unit: 'day', law: 'İYUK m.45, m.46' }] },
];

export function findRule(code) {
  const r = RULES.find((x) => x.code === code);
  if (!r) throw new Error(`Bilinmeyen kural: ${code}`);
  return r;
}
