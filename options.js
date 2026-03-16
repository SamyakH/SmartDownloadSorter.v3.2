const folderPattern = document.getElementById("folderPattern");
const nestedSubfolders = document.getElementById("nestedSubfolders");
const notifications = document.getElementById("notifications");
const downloadLog = document.getElementById("downloadLog");
const clearLogBtn = document.getElementById("clearLog");
const exportLogBtn = document.getElementById("exportLog");

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
  chrome.storage.local.get({ log: [] }, (data) => {
    if (!downloadLog) return;
    downloadLog.innerHTML = '';

    if (!data.log || data.log.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No downloads recorded yet.';
      downloadLog.appendChild(li);
      return;
    }

    // Show newest first
    data.log.slice().reverse().forEach((item) => {
      const li = document.createElement('li');

      // favicon
      const img = document.createElement('img');
      img.src = item.favicon || 'icon.png';
      img.width = 16;
      img.height = 16;
      img.onerror = function () {
        this.style.display = 'none';
      };
      li.appendChild(img);

      // filename
      const strong = document.createElement('strong');
      strong.textContent = item.filename || 'Unknown';
      li.appendChild(strong);

      li.appendChild(document.createElement('br'));

      const parts = [
        `📁 ${item.folder || 'N/A'}`,
        `📂 ${item.typeFolder || 'Others'}`,
        `🌐 ${item.domain || 'Unknown'}`,
        `📅 ${
          item.date ? new Date(item.date).toLocaleDateString() : 'N/A'
        } ${item.time || ''}`,
        `💾 ${(item.fileSize || 0).toLocaleString()} bytes`
      ];

      parts.forEach((text, index) => {
        const small = document.createElement('small');
        small.textContent = text;
        li.appendChild(small);
        if (index < parts.length - 1) {
          li.appendChild(document.createTextNode(' | '));
        }
      });

      li.appendChild(document.createElement('br'));

      if (item.url) {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.textContent = '🔗 Source';
        li.appendChild(link);
        li.appendChild(document.createTextNode(' | '));
      }

      const statusText = document.createTextNode(
        `Status: ${item.status || 'unknown'}`
      );
      li.appendChild(statusText);

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

// Export log button
if (exportLogBtn) {
  exportLogBtn.addEventListener('click', () => {
    chrome.storage.local.get({ log: [] }, (data) => {
      const json = JSON.stringify(data.log || [], null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'smart-download-log.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  });
}
