(function () {
  let deferredPrompt = null;

  function createInstallButton() {
    if (document.getElementById('orcazapInstallButton')) return;

    const button = document.createElement('button');
    button.id = 'orcazapInstallButton';
    button.className = 'pwa-install-button';
    button.type = 'button';
    button.textContent = 'Instalar OrçaZap';
    button.addEventListener('click', async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      button.remove();
    });

    document.body.appendChild(button);
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    createInstallButton();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    document.getElementById('orcazapInstallButton')?.remove();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    });
  }
})();
