(function (): void {
  const ERR_PFX = '[Xembed:popup]';

  const toggleEl = document.getElementById('toggle-switch') as HTMLInputElement | null;
  const domainEl = document.getElementById('domain-select') as HTMLSelectElement | null;

  if (!toggleEl || !domainEl) {
    console.error(`${ERR_PFX} E100: required DOM elements not found`);
    return;
  }

  function syncToContentScript(payload: Record<string, unknown>): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, payload).catch(() => {});
      }
    });
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
    const isEnabled = toggleEl.checked;
    chrome.storage.local.set({ enabled: isEnabled }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          `${ERR_PFX} E120: storage.set('enabled') failed`,
          chrome.runtime.lastError.message,
        );
      }
    });
    syncToContentScript({ type: 'UPDATE_ENABLED', enabled: isEnabled });
  });

  domainEl.addEventListener('change', () => {
    const newDomain = domainEl.value;
    chrome.storage.local.set({ domain: newDomain }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          `${ERR_PFX} E130: storage.set('domain') failed`,
          chrome.runtime.lastError.message,
        );
      }
    });
    syncToContentScript({ type: 'UPDATE_DOMAIN', domain: newDomain });
  });
})();
