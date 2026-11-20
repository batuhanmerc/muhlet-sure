// Evrak dosyasından metin çıkarır. Her şey tarayıcıda olur; dosya hiçbir sunucuya gönderilmez.
// Desteklenen: .udf (UYAP belge biçimi: içinde content.xml olan bir ZIP), .pdf (pdf.js ile), .txt

const MAX_BYTES = 15 * 1024 * 1024;

export async function readDocument(file) {
  if (file.size > MAX_BYTES) throw new Error('Dosya çok büyük (en fazla 15 MB).');
  const name = file.name.toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith('.udf') || isZip(buf)) return { kind: 'UDF', text: await udfText(buf) };
  if (name.endsWith('.pdf') || isPdf(buf)) return { kind: 'PDF', text: await pdfText(buf) };
  if (name.endsWith('.txt')) return { kind: 'Metin', text: new TextDecoder('utf-8').decode(buf) };
  throw new Error('Bu dosya türü desteklenmiyor. UDF, PDF ya da TXT dosyası bırakın; isterseniz metni kutuya yapıştırın.');
}

const isZip = (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const isPdf = (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

// --- UDF: küçük bir ZIP okuyucu (merkezi dizinden), DecompressionStream ile ---
async function udfText(buf) {
  const files = unzipIndex(buf);
  const entry = files.find((f) => /(^|\/)content\.xml$/i.test(f.name)) || files.find((f) => f.name.toLowerCase().endsWith('.xml'));
  if (!entry) throw new Error('UDF dosyasının içinde metin (content.xml) bulunamadı.');
  const xml = new TextDecoder('utf-8').decode(await extract(buf, entry));
  return xmlToText(xml);
}

function unzipIndex(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('UDF dosyası okunamadı (bozuk ya da beklenmeyen biçim).');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
    out.push({ name, method, csize, local });
    p += 46 + nlen + elen + clen;
  }
  return out;
}

async function extract(b, f) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const nlen = dv.getUint16(f.local + 26, true), elen = dv.getUint16(f.local + 28, true);
  const start = f.local + 30 + nlen + elen;
  const data = b.subarray(start, start + f.csize);
  if (f.method === 0) return data;
  if (f.method !== 8) throw new Error('UDF dosyası desteklenmeyen bir sıkıştırma kullanıyor.');
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export function xmlToText(xml) {
  // UDF'de belge metni genellikle <content><![CDATA[ ... ]]></content> içinde durur (gerçek örneklerle doğrulanmalı)
  const cdata = [...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1]).join('\n');
  const body = cdata.trim() ? cdata : xml.replace(/<[^>]+>/g, ' ');
  return body.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// --- PDF: pdf.js (siteyle birlikte gelir, internetten indirilmez) ---
let pdfjs = null;
async function pdfText(buf) {
  if (!pdfjs) {
    pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  }
  const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
  const pages = Math.min(doc.numPages, 15); // tür ve tarih için ilk sayfalar yeterli
  let text = '';
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map((it) => it.str + (it.hasEOL ? '\n' : ' ')).join('') + '\n';
  }
  await (doc.destroy ? doc.destroy() : doc.cleanup?.());
  if (text.replace(/\s/g, '').length < 20) throw new Error('PDF\'te okunabilir metin yok (taranmış bir görüntü olabilir). Metni kutuya yapıştırmayı deneyin.');
  return text;
}
