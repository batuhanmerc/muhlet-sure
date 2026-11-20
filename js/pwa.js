// Uygulama gibi kurulabilmesi ve internet yokken açılabilmesi için service worker kaydı.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
