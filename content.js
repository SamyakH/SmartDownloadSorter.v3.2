// Sends domain + favicon to background when download is likely to start
document.addEventListener('click', e => {
    const target = e.target.closest('a[download]');
    if (!target) return;

    const domain = location.hostname;
    const favicon = document.querySelector("link[rel~='icon']")?.href || '';

    chrome.runtime.sendMessage({ domain, favicon });
});
