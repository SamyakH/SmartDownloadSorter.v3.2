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
    // Try to use tab URL if possible
    if (downloadItem.tabId >= 0) {
      chrome.tabs.get(downloadItem.tabId, tab => {
        if (chrome.runtime.lastError) {
          processDownload(downloadItem, suggest, lastDomain || 'Unknown', lastFavicon || '');
          return;
        }
        const domain = tab.url ? (new URL(tab.url).hostname) : (lastDomain || 'Unknown');
        const faviconUrl = lastFavicon || '';
        processDownload(downloadItem, suggest, domain, faviconUrl);
      });
    } else {
      // Fallback for non-tab downloads
      processDownload(downloadItem, suggest, lastDomain || 'Unknown', lastFavicon || '');
    }
  } catch (err) {
    console.error('Download error:', err);
    suggest(); // Fallback to default behavior
  }
});

function processDownload(downloadItem, suggest, domain, faviconUrl) {
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Determine file type folder
  let typeFolder = 'Others';
  const ext = downloadItem.filename.split('.').pop().toLowerCase();
  for (const [folder, exts] of Object.entries(fileTypeMap)) {
    if (exts.includes(ext)) {
      typeFolder = folder;
      break;
    }
  }

  const filename = downloadItem.filename.split(/[/\\]/).pop();
  
  // STRUCTURE: Domain / Date / FileType / Filename
  const newPath = `${domain}/${date}/${typeFolder}/${filename}`;

  // Suggest filename with conflict handling
  suggest({ filename: newPath, conflictAction: 'uniquify' });

  // Store in download log
  chrome.storage.local.get({ log: [] }, data => {
    const log = data.log || [];
    log.push({
      filename,
      domain,
      folder: `${domain}/${date}/${typeFolder}`,
      typeFolder,
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString(),
      url: downloadItem.finalUrl || downloadItem.url || '',
      tabId: downloadItem.tabId || null,
      favicon: faviconUrl,
      fileSize: downloadItem.fileSize || 0,
      status: downloadItem.state || 'in_progress'
    });
    // Keep log manageable (last 100 entries)
    if (log.length > 100) log.shift();
    chrome.storage.local.set({ log });
  });

  // Show notification (Fixed: added notificationId as first parameter)
  chrome.storage.sync.get({ notifications: true }, prefs => {
    if (prefs.notifications) {
      chrome.notifications.create('dl-notify-' + Date.now(), {
        type: "basic",
        iconUrl: "icon.png",
        title: "Download Organized",
        message: `Saved: ${domain}/${date}/${typeFolder}`
      });
    }
  });
}