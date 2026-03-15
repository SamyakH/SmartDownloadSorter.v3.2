let lastDomain = '';
let lastFavicon = '';

// Receive domain + favicon from content script
chrome.runtime.onMessage.addListener(msg => {
    if (msg.domain) {
        lastDomain = msg.domain;
        lastFavicon = msg.favicon || '';
    }
});

// File type mapping for nested folders
const fileTypeMap = {
    Images: ['jpg','jpeg','png','gif','webp','bmp'],
    PDFs: ['pdf'],
    Videos: ['mp4','avi','mkv','mov','flv','wmv','webm'],
    Documents: ['txt','doc','docx','xls','xlsx','ppt','pptx','csv','odt','ods','odp'],
    Archives: ['zip','rar','7z','tar','gz','bz2'],
    Audio: ['mp3','wav','flac','aac','ogg','m4a']
};

// Handle filename before saving
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    try {
        let domain = 'Unknown';
        let faviconUrl = '';

        // Try to use tab URL if possible
        if (downloadItem.tabId >= 0) {
            chrome.tabs.get(downloadItem.tabId, tab => {
                domain = tab.url ? (new URL(tab.url).hostname) : 'Unknown';
                faviconUrl = lastFavicon || '';
                processDownload(downloadItem, suggest, domain, faviconUrl);
            });
        } else {
            // fallback
            processDownload(downloadItem, suggest, lastDomain || 'Unknown', lastFavicon || '');
        }
    } catch (err) {
        console.error(err);
        suggest();
    }
});

function processDownload(downloadItem, suggest, domain, faviconUrl) {
    const date = new Date().toISOString().split("T")[0];
    const folderName = `${domain}_${date}`;

    // Determine nested subfolder
    let typeFolder = 'Others';
    const ext = downloadItem.filename.split('.').pop().toLowerCase();
    for (const [folder, exts] of Object.entries(fileTypeMap)) {
        if (exts.includes(ext)) {
            typeFolder = folder;
            break;
        }
    }

    const filename = downloadItem.filename.split(/[/\\]/).pop();
    const newPath = `${folderName}/${typeFolder}/${filename}`;

    // Suggest filename
    suggest({ filename: newPath, conflictAction: 'uniquify' });

    // Store in download log
    chrome.storage.local.get({ log: [] }, data => {
        const log = data.log;
        log.push({
            filename,
            domain,
            folder: folderName,
            typeFolder,
            date: new Date().toISOString(),
            time: new Date().toLocaleTimeString(),
            url: downloadItem.finalUrl || downloadItem.url || '',
            tabId: downloadItem.tabId || null,
            favicon: faviconUrl,
            fileSize: downloadItem.fileSize || 0,
            status: downloadItem.state || 'in_progress'
        });
        chrome.storage.local.set({ log });
    });

    // Show notification (with local icon only)
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Download Organized",
        message: `File saved in: ${folderName}/${typeFolder}`
    });
}
