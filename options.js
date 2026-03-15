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
    folderPattern.value = prefs.folderPattern;
    nestedSubfolders.checked = prefs.nestedSubfolders;
    notifications.checked = prefs.notifications;
});

// Save settings on change
folderPattern.addEventListener('change', () => {
    chrome.storage.sync.set({ folderPattern: folderPattern.value });
});
nestedSubfolders.addEventListener('change', () => {
    chrome.storage.sync.set({ nestedSubfolders: nestedSubfolders.checked });
});
notifications.addEventListener('change', () => {
    chrome.storage.sync.set({ notifications: notifications.checked });
});

// Render download log
function renderLog() {
    chrome.storage.local.get({ log: [] }, data => {
        downloadLog.innerHTML = '';
        data.log.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `
                <img src="${item.favicon}" width="16" height="16"> 
                ${item.filename} → ${item.folder}/${item.typeFolder}<br>
                Domain: ${item.domain} | Date: ${new Date(item.date).toLocaleDateString()} 
                | Time: ${item.time} | Size: ${item.fileSize} bytes
                | URL: <a href="${item.url}" target="_blank">${item.url}</a>
                | Status: ${item.status}
            `;
            downloadLog.appendChild(li);
        });
    });
}
renderLog();

// Clear log
clearLogBtn.addEventListener('click', () => {
    chrome.storage.local.set({ log: [] }, renderLog);
});
