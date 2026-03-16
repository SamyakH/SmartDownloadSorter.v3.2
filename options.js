const folderPattern = document.getElementById("folderPattern");
const nestedSubfolders = document.getElementById("nestedSubfolders");
const notifications = document.getElementById("notifications");
const downloadLog = document.getElementById("downloadLog");
const clearLogBtn = document.getElementById("clearLog");

// Load settings
chrome.storage.sync.get({
  folderPattern: 'domain_date',
  nestedSubfolders: true,
  notifications: true
}, prefs => {
  if (folderPattern) folderPattern.value = prefs.folderPattern;
  if (nestedSubfolders) nestedSubfolders.checked = prefs.nestedSubfolders;
  if (notifications) notifications.checked = prefs.notifications;
});

// Save settings on change
if (folderPattern) folderPattern.addEventListener('change', () => {
  chrome.storage.sync.set({ folderPattern: folderPattern.value });
});
if (nestedSubfolders) nestedSubfolders.addEventListener('change', () => {
  chrome.storage.sync.set({ nestedSubfolders: nestedSubfolders.checked });
});
if (notifications) notifications.addEventListener('change', () => {
  chrome.storage.sync.set({ notifications: notifications.checked });
});

// Render download log
function renderLog() {
  chrome.storage.local.get({ log: [] }, data => {
    if (!downloadLog) return;
    downloadLog.innerHTML = '';
    
    if (!data.log || data.log.length === 0) {
      downloadLog.innerHTML = '<li>No downloads recorded yet.</li>';
      return;
    }

    // Show newest first
    data.log.slice().reverse().forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `
        <img src="${item.favicon || 'icon.png'}" width="16" height="16" onerror="this.style.display='none'"> 
        <strong>${item.filename || 'Unknown'}</strong><br>
        <small>📁 ${item.folder || 'N/A'}</small> | 
        <small>📂 ${item.typeFolder || 'Others'}</small> | 
        <small>🌐 ${item.domain || 'Unknown'}</small> | 
        <small>📅 ${item.date ? new Date(item.date).toLocaleDateString() : 'N/A'} ${item.time || ''}</small> | 
        <small>💾 ${(item.fileSize || 0).toLocaleString()} bytes</small><br>
        ${item.url ? `<a href="${item.url}" target="_blank">🔗 Source</a>` : ''} | Status: ${item.status || 'unknown'}
      `;
      downloadLog.appendChild(li);
  });
  });
}

// Initial render + auto-refresh
renderLog();
setInterval(renderLog, 5000);

// Clear log button
if (clearLogBtn) {
  clearLogBtn.addEventListener('click', () => {
    chrome.storage.local.set({ log: [] }, renderLog);
  });
}
