(function (): void {
  const LOG_PFX = '[Xembed]';
  const STORAGE_KEYS = { ENABLED: 'enabled', DOMAIN: 'domain' } as const;
  const TWITTER_LINK_RE = /https?:\/\/(?:www\.)?(?:twitter|x|vxtwitter|fxtwitter|fixupx|girlcockx)\.com\/[a-zA-Z0-9_]+\/status\/\d+/gi;
  const DOMAIN_REPLACE_RE = /https?:\/\/(?:www\.)?(?:twitter|x|vxtwitter|fxtwitter|fixupx|girlcockx)\.com/gi;
  const ALLOWED_DOMAINS = new Set([
    'vxtwitter.com',
    'fixupx.com',
    'girlcockx.com',
    'fxtwitter.com',
  ]);
  const DEFAULT_DOMAIN = 'vxtwitter.com';

  let ready = false;
  let extensionEnabled = true;
  let embedDomain = DEFAULT_DOMAIN;
  let destroy: (() => void) | null = null;
  void destroy;

  async function init(): Promise<void> {
    try {
      const result = await new Promise<{ [key: string]: unknown }>((resolve, reject) => {
        chrome.storage.local.get(
          [STORAGE_KEYS.ENABLED, STORAGE_KEYS.DOMAIN],
          (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(res);
            }
          },
        );
      });

      if (typeof result[STORAGE_KEYS.ENABLED] === 'boolean') {
        extensionEnabled = result[STORAGE_KEYS.ENABLED] as boolean;
      }
      if (
        typeof result[STORAGE_KEYS.DOMAIN] === 'string' &&
        ALLOWED_DOMAINS.has(result[STORAGE_KEYS.DOMAIN] as string)
      ) {
        embedDomain = result[STORAGE_KEYS.DOMAIN] as string;
      } else {
        embedDomain = DEFAULT_DOMAIN;
      }
    } catch (err) {
      console.error(
        `${LOG_PFX} E020: storage.get failed, using defaults`,
        err,
      );
    }

    ready = true;
  }

  function onStorageChanged(
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string,
  ): void {
    if (area !== 'local') return;

    if (changes[STORAGE_KEYS.ENABLED] !== undefined) {
      extensionEnabled = Boolean(changes[STORAGE_KEYS.ENABLED].newValue);
    }
    if (changes[STORAGE_KEYS.DOMAIN] !== undefined) {
      const val = changes[STORAGE_KEYS.DOMAIN].newValue;
      embedDomain =
        typeof val === 'string' && ALLOWED_DOMAINS.has(val)
          ? val
          : DEFAULT_DOMAIN;
    }
  }

  function onMessage(
    message: { type: string; enabled?: boolean; domain?: string },
  ): void {
    if (message.type === 'UPDATE_ENABLED' && message.enabled !== undefined) {
      extensionEnabled = message.enabled;
    }
    if (message.type === 'UPDATE_DOMAIN' && message.domain !== undefined) {
      embedDomain = message.domain;
    }
  }

  function onPasteCapture(e: ClipboardEvent): void {
    if (!ready || !extensionEnabled) return;

    const dt = e.clipboardData;
    if (!dt) return;

    const pastedText = dt.getData('text/plain');
    if (!pastedText || !TWITTER_LINK_RE.test(pastedText)) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    const fixedText = pastedText.replace(
      DOMAIN_REPLACE_RE,
      `https://${embedDomain}`,
    );

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', fixedText);
    dataTransfer.setData('text/html', fixedText);

    const newPasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });

    const target = e.target instanceof Element ? e.target : null;
    if (!target) {
      console.warn(
        `${LOG_PFX} E040: paste event target is not an Element, aborting dispatch`,
      );
      return;
    }

    const nextTick = (): void => {
      target.dispatchEvent(newPasteEvent);
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(nextTick);
    } else {
      setTimeout(nextTick, 0);
    }
  }

  function mount(): void {
    document.addEventListener('paste', onPasteCapture, true);
    chrome.storage.onChanged.addListener(onStorageChanged);
    chrome.runtime.onMessage.addListener(onMessage);

    destroy = (): void => {
      document.removeEventListener('paste', onPasteCapture, true);
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onMessage);
      destroy = null;
    };
  }

  init().then(mount).catch((err) => {
    console.error(`${LOG_PFX} E010: init failed, extension disabled`, err);
    mount();
  });
})();
