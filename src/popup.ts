(function (): void {
  const ERR_PFX = '[Xembed:popup]';

  const toggleEl = document.getElementById('toggle-switch') as HTMLInputElement | null;
  const domainEl = document.getElementById('domain-select') as HTMLSelectElement | null;

  if (!toggleEl || !domainEl) {
    console.error(`${ERR_PFX} E100: required DOM elements not found`);
    return;
  }

  chrome.storage.local.get(['enabled', 'domain'], (result: { [key: string]: unknown }) => {
    if (chrome.runtime.lastError) {
      console.error(`${ERR_PFX} E110: storage.get failed`, chrome.runtime.lastError.message);
      return;
    }
    if (typeof result.enabled === 'boolean') {
      toggleEl.checked = result.enabled;
    }
    if (typeof result.domain === 'string') {
      domainEl.value = result.domain;
    }
  });

  toggleEl.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggleEl.checked }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          `${ERR_PFX} E120: storage.set('enabled') failed`,
          chrome.runtime.lastError.message,
        );
      }
    });
  });

  domainEl.addEventListener('change', () => {
    chrome.storage.local.set({ domain: domainEl.value }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          `${ERR_PFX} E130: storage.set('domain') failed`,
          chrome.runtime.lastError.message,
        );
      }
    });
  });
})();
