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

// Handle filename before saving
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  try {
    let domainToUse = lastDomain || 'Unknown';
    let faviconToUse = lastFavicon || '';
    
    // Compute domain sync first
    if (downloadItem.finalUrl) {
      try {
        domainToUse = new URL(downloadItem.finalUrl).hostname;
      } catch (e) {}
    }
    if (downloadItem.tabId >= 0) {
      chrome.tabs.get(downloadItem.tabId, (tab) => {
        if (!chrome.runtime.lastError && tab?.url) {
          try {
            domainToUse = new URL(tab.url).hostname;
          } catch (e) {}
        }
        // Single prefs load & suggest
       chrome.storage.sync.get({
          folderPattern: 'domain_date',
          nestedSubfolders: true,
          notifications: true
        }, (prefs) => {
          processDownload(downloadItem, suggest, domainToUse, faviconToUse, prefs);
        });
      });
      return;
    }
    
    // Non-tab: direct prefs load
    chrome.storage.sync.get({
      folderPattern: 'domain_date',
      nestedSubfolders: true,
      notifications: true
    }, (prefs) => {
      processDownload(downloadItem, suggest, domainToUse, faviconToUse, prefs);
    });
  } catch (err) {
    console.error('Download error:', err);
    suggest();
  }
  return true; // Allow async suggest
});

function sanitize(str) {
  return String(str || '')
    .replace(/[<>:"/\\\\|?*]/g, '_')
    .substring(0, 100);
}

function processDownload(downloadItem, suggest, domain, faviconUrl, prefs = {}) {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  
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
  suggest({ filename: newPath, conflictAction: 'uniquify' });

  // Store in download log
    chrome.storage.local.get({ log: [] }, data => {
      const log = data.log || [];
      log.push({
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
      if (log.length > 100) log.shift();
      chrome.storage.local.set({ log }, () => {
        console.log('Download log saved');
      });
    });

  // Show notification using prefs already loaded
  if (prefs.notifications !== false) {
    chrome.notifications.create('dl-notify-' + Date.now(), {
      type: "basic",
      iconUrl: "icon.png",
      title: "Download Organized",
      message: `Saved to: ${newPath.substring(0, 80)}`
    });
  }
}
