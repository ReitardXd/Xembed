// Xembed - Discord Twitter/X embed fixer
// Copyright (C) 2026 Pranav
// Licensed under the GNU General Public License v3.0
// See LICENSE file for details

(function (): void {
  const LOG_PFX = '[Xembed]';
  const STORAGE_KEYS = { ENABLED: 'enabled', DOMAIN: 'domain', GIF_SAFE: 'gifSafe' } as const;
  // format of the twitter link here  you need to add any custom embeds you have here aswell 
  // for it to be used also refer to popup.html for it to be enabled 
  const TWITTER_LINK_RE = /https?:\/\/(?:www\.)?(?:twitter|x|vxtwitter|fxtwitter|fixupx|girlcockx|hitlerx)\.com\/[a-zA-Z0-9_]+\/status\/\d+/gi;
  const DOMAIN_REPLACE_RE = /https?:\/\/(?:www\.)?(?:twitter|x|vxtwitter|fxtwitter|fixupx|girlcockx|hitlerx)\.com/gi;
  const ALLOWED_DOMAINS = new Set([
    'vxtwitter.com',
    'fixupx.com',
    'girlcockx.com',
    'fxtwitter.com',
    'hitlerx.com',
  ]);
  const DEFAULT_DOMAIN = 'vxtwitter.com';
  // Domains confirmed (or believed) to run FastGIF/KitchenSink transcoding,
  // i.e. animated_gif tweets render as autoplaying WebP loops in Discord
  // instead of a plain video embed with play/pause controls.
  // Update this if you confirm girlcockx/hitlerx support it too
  // (check response headers for `x-powered-by: kitchensink`).
  const GIF_CAPABLE_DOMAINS = new Set(['fxtwitter.com', 'fixupx.com']);
  const GIF_SAFE_FALLBACK = 'fxtwitter.com';
  const STATUS_ID_RE = /status\/(\d+)/;
  // Cache per status ID so repeated pastes of the same link (or a batch
  // paste with duplicates) don't re-fetch.
  const gifDetectionCache = new Map<string, boolean>();

  // Derives the `token` param required by Twitter's public unauthenticated
  // syndication endpoint (the same one platform.twitter.com/widgets.js
  // uses client-side to render embedded tweets on third-party pages).
  function deriveSyndicationToken(statusId: string): string {
    return ((Number(statusId) / 1e15) * Math.PI)
      .toString(36)
      .replace(/(0+|\.)/g, '');
  }

  async function isAnimatedGifTweet(statusId: string): Promise<boolean> {
    const cached = gifDetectionCache.get(statusId);
    if (cached !== undefined) return cached;

    try {
      const token = deriveSyndicationToken(statusId);
      const url = `https://cdn.syndication.twimg.com/tweet-result?id=${statusId}&token=${token}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        gifDetectionCache.set(statusId, false);
        return false;
      }
      const data = await res.json();
      const isGif =
        Array.isArray(data?.mediaDetails) &&
        data.mediaDetails.some((m: { type?: string }) => m.type === 'animated_gif');
      gifDetectionCache.set(statusId, isGif);
      return isGif;
    } catch (err) {
      console.warn(`${LOG_PFX} E050: gif detection failed for ${statusId}`, err);
      gifDetectionCache.set(statusId, false);
      return false;
    }
  }

  async function rewriteWithGifDetection(pastedText: string): Promise<string> {
    const matches = Array.from(pastedText.matchAll(TWITTER_LINK_RE));
    if (matches.length === 0) {
      return pastedText.replace(DOMAIN_REPLACE_RE, `https://${embedDomain}`);
    }

    // Resolve gif-ness for every distinct status ID in parallel first,
    // so we don't serialize network round trips for multi-link pastes.
    const statusIds = new Set<string>();
    for (const m of matches) {
      const idMatch = m[0].match(STATUS_ID_RE);
      if (idMatch) statusIds.add(idMatch[1]);
    }
    await Promise.all(
      Array.from(statusIds).map((id) =>
        GIF_CAPABLE_DOMAINS.has(embedDomain) ? Promise.resolve() : isAnimatedGifTweet(id),
      ),
    );

    let result = pastedText;
    for (const m of matches) {
      const original = m[0];
      const idMatch = original.match(STATUS_ID_RE);
      const statusId = idMatch ? idMatch[1] : null;
      const isGif =
        statusId !== null && !GIF_CAPABLE_DOMAINS.has(embedDomain)
          ? gifDetectionCache.get(statusId) ?? false
          : false;
      const targetDomain = isGif ? GIF_SAFE_FALLBACK : embedDomain;
      const replaced = original.replace(DOMAIN_REPLACE_RE, `https://${targetDomain}`);
      result = result.replace(original, replaced);
    }
    return result;
  }
// add any new embeds above 
  let ready = false;
  let extensionEnabled = true;
  let embedDomain = DEFAULT_DOMAIN;
  let gifSafe = false;
  let destroy: (() => void) | null = null;
  void destroy;

  async function init(): Promise<void> {
    try {
      const result = await new Promise<{ [key: string]: unknown }>((resolve, reject) => {
        chrome.storage.local.get(
          [STORAGE_KEYS.ENABLED, STORAGE_KEYS.DOMAIN, STORAGE_KEYS.GIF_SAFE],
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
      if (typeof result[STORAGE_KEYS.GIF_SAFE] === 'boolean') {
        gifSafe = result[STORAGE_KEYS.GIF_SAFE] as boolean;
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
    if (changes[STORAGE_KEYS.GIF_SAFE] !== undefined) {
      gifSafe = Boolean(changes[STORAGE_KEYS.GIF_SAFE].newValue);
    }
  }

  function onMessage(
    message: { type: string; enabled?: boolean; domain?: string; gifSafe?: boolean },
  ): void {
    if (message.type === 'UPDATE_ENABLED' && message.enabled !== undefined) {
      extensionEnabled = message.enabled;
    }
    if (message.type === 'UPDATE_DOMAIN' && message.domain !== undefined) {
      embedDomain = message.domain;
    }
    if (message.type === 'UPDATE_GIF_SAFE' && message.gifSafe !== undefined) {
      gifSafe = message.gifSafe;
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

    void handlePaste(pastedText, e.target);
  }

  async function handlePaste(pastedText: string, eventTarget: EventTarget | null): Promise<void> {
    const fixedText = gifSafe
      ? await rewriteWithGifDetection(pastedText)
      : pastedText.replace(DOMAIN_REPLACE_RE, `https://${embedDomain}`);

    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', fixedText);
    dataTransfer.setData('text/html', fixedText);

    const newPasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });

    const target = eventTarget instanceof Element ? eventTarget : null;
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
