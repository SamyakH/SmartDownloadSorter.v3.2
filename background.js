let lastDomain = '';
let lastFavicon = '';

// Receive domain + favicon from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.domain) {
    lastDomain = msg.domain;
    lastFavicon = msg.favicon || '';
  }
});

// File type mapping for nested folders
const fileTypeMap = {
  Images: ['jpg','jpeg','png','gif','webp','bmp','svg'],
  PDFs: ['pdf'],
  Videos: ['mp4','avi','mkv','mov','flv','wmv','webm','m4v'],
  Documents: ['txt','doc','docx','xls','xlsx','ppt','pptx','csv','odt','ods','odp','rtf'],
  Archives: ['zip','rar','7z','tar','gz','bz2','xz'],
  Audio: ['mp3','wav','flac','aac','ogg','m4a','wma']
};

// Turn a hostname into a clean "site name" (no www, no TLD)
function getSiteNameFromHostname(hostname) {
  if (!hostname) return 'Unknown';
  const cleaned = hostname.toLowerCase().replace(/^www\./, '');
  const parts = cleaned.split('.');
  if (parts.length === 1) {
    return parts[0];            // e.g. "localhost"
  }
  return parts[parts.length - 2]; // e.g. "youtube" from "www.youtube.com"
}

// Sanitize path segments
function sanitize(str) {
  return String(str || '')
    .replace(/[<>:"/\\\\|?*]/g, '_')
    .substring(0, 100);
}

// Handle filename before saving
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  try {
    let domainToUse = lastDomain || 'Unknown';
    let faviconToUse = lastFavicon || '';

    // Try from finalUrl first
    if (downloadItem.finalUrl) {
      try {
        const host = new URL(downloadItem.finalUrl).hostname;
        domainToUse = getSiteNameFromHostname(host);
      } catch (e) {}
    }

    // If we have a tab, refine domain from tab URL
    if (downloadItem.tabId >= 0) {
      chrome.tabs.get(downloadItem.tabId, (tab) => {
        if (!chrome.runtime.lastError && tab?.url) {
          try {
            const host = new URL(tab.url).hostname;
            domainToUse = getSiteNameFromHostname(host);
          } catch (e) {}
        }

        chrome.storage.sync.get(
          {
            folderPattern: 'domain_date',
            nestedSubfolders: true,
            notifications: true
          },
          (prefs) => {
            processDownload(downloadItem, suggest, domainToUse, faviconToUse, prefs);
          }
        );
      });
      return true; // keep listener alive for async suggest
    }

    // Non-tab: direct prefs load
    chrome.storage.sync.get(
      {
        folderPattern: 'domain_date',
        nestedSubfolders: true,
        notifications: true
      },
      (prefs) => {
        // If we still only have lastDomain, normalize it too
        domainToUse = getSiteNameFromHostname(domainToUse);
        processDownload(downloadItem, suggest, domainToUse, faviconToUse, prefs);
      }
    );
  } catch (err) {
    console.error('Download error:', err);
    try {
      suggest();
    } catch (_) {}
  }
  return true; // Allow async suggest
});

function processDownload(downloadItem, suggest, domain, faviconUrl, prefs = {}) {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

  // Determine file type folder
  let typeFolder = 'Others';
  const ext = downloadItem.filename.split('.').pop()?.toLowerCase() || '';
  for (const [folder, exts] of Object.entries(fileTypeMap)) {
    if (exts.includes(ext)) {
      typeFolder = folder;
      break;
    }
  }

  const safeDomain = sanitize(domain);
  const safeFilename = sanitize(downloadItem.filename.split(/[/\\\\]/).pop() || 'unknown');

  // Build dynamic path based on prefs
  const parts = [];
  switch (prefs.folderPattern || 'domain_date') {
    case 'domain_only':
      parts.push(safeDomain);
      break;
    case 'date_domain':
      parts.push(dateStr, safeDomain);
      break;
    default: // domain_date
      parts.push(safeDomain, dateStr);
  }
  if (prefs.nestedSubfolders !== false) {
    parts.push(typeFolder);
  }
  parts.push(safeFilename);

  const newPath = parts.join('/');

  // Suggest filename with conflict handling
  try {
    suggest({ filename: newPath, conflictAction: 'uniquify' });
  } catch (e) {
    console.error('Suggest failed:', e);
    try {
      suggest();
    } catch (_) {}
  }

  const downloadId = downloadItem.id;

  // Store in download log
  chrome.storage.local.get({ log: [] }, (data) => {
    const log = data.log || [];
    log.push({
      id: downloadId,
      filename: safeFilename,
      domain: safeDomain,
      folder: parts.slice(0, -1).join('/'),
      typeFolder,
      date: now.toISOString(),
      time: now.toLocaleTimeString(),
      url: downloadItem.finalUrl || downloadItem.url || '',
      tabId: downloadItem.tabId || null,
      favicon: faviconUrl,
      fileSize: downloadItem.fileSize || 0,
      status: downloadItem.state || 'in_progress'
    });
    // Keep log manageable (last 100 entries)
    while (log.length > 100) log.shift();
    chrome.storage.local.set({ log });
  });

  // Show notification using prefs already loaded
  if (prefs.notifications !== false) {
    chrome.notifications.create('dl-notify-' + Date.now(), {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Download Organized',
      message: `Saved to: ${newPath.substring(0, 80)}`
    });
  }
}

// Keep log status in sync with real download status
chrome.downloads.onChanged.addListener((delta) => {
  if (!delta || typeof delta.id !== 'number' || !delta.state) return;

  const newState = delta.state.current; // complete / in_progress / interrupted
  chrome.storage.local.get({ log: [] }, (data) => {
    const log = data.log || [];
    const entry = log.find((item) => item.id === delta.id);
    if (!entry) return;

    entry.status = newState;
    chrome.storage.local.set({ log });
  });
});