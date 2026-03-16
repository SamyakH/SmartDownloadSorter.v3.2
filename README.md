# Smart Download Sorter v3

Smart Download Sorter is a Chrome extension (Manifest V3) that automatically organizes your downloads into clean, human-readable folders.

Downloads are sorted by:

- Site name (e.g. `youtube`, `medium`)
- Date (e.g. `2024-03-01`)
- File type (e.g. `Images`, `PDFs`, `Videos`, `Documents`, `Archives`, `Audio`)

It also keeps a detailed log of your downloads, with status, size, and source URL, and lets you export that log as JSON.

---

## Features

- 🔁 **Automatic folder organization**
  - Organizes downloads into folders like:
    - `youtube/2024-03-01/Images/file.jpg`
    - `example/2024-03-01/PDFs/document.pdf`
  - Domain is cleaned to just the site name:
    - `www.youtube.com` → `youtube`
    - `blog.medium.com` → `medium`
    - `forum.example.co.uk` → `example`

- 🧩 **Flexible folder patterns**
  - Choose how your folders are structured:
    - **Domain + Date** (default): `[SiteName]/YYYY-MM-DD/…`
    - **Domain Only**: `[SiteName]/…`
    - **Date + Domain**: `YYYY-MM-DD/[SiteName]/…`
  - Optional nested subfolders by file type:
    - `Images`, `PDFs`, `Videos`, `Documents`, `Archives`, `Audio`, `Others`

- 🔔 **Notifications**
  - Optional “Download Organized” notification when a file is sorted.
  - Can be turned on/off in the options.

- 📋 **Download log**
  - Keeps a history of recent downloads (ID, filename, folder path, domain, type, date, time, size, status, URL, favicon).
  - Status is kept in sync with Chrome’s download status:
    - `in_progress`, `complete`, `interrupted`, etc.
  - Shows the site’s favicon when available.

- 📤 **Exportable log**
  - Export the log as a JSON file (`smart-download-log.json`) from the settings page.

- 🧭 **Lightweight content script**
  - Only responds to user left-clicks on `<a download>` links.
  - Works on normal web pages (`http://` and `https://`).

---

## How it works

### Background script

- Listens to `chrome.downloads.onDeterminingFilename`:
  - Determines the site name from the tab’s URL or the final download URL.
  - Cleans the hostname to a simple site name (e.g. `youtube`).
  - Detects file type (`Images`, `PDFs`, etc.) from file extension.
  - Builds the target path based on user settings:
    - Folder pattern
    - Nested subfolders flag
  - Suggests the new path to Chrome with `conflictAction: "uniquify"`.

- Logs each download into `chrome.storage.local` with:
  - `id`, `filename`, `domain`, `folder`, `typeFolder`, `date`, `time`,
  - `url`, `tabId`, `favicon`, `fileSize`, `status`.

- Listens to `chrome.downloads.onChanged`:
  - Updates the log entry’s `status` when a download completes, is interrupted, etc.

### Content script

- Injected on `http://*/*` and `https://*/*`.
- On left-click of a link with `download` attribute:
  - Captures `location.hostname` and the page favicon.
  - Sends `{ domain, favicon }` to the background script.
- This helps the background script associate downloads with the correct site and icon.

### Options page

- Uses `chrome.storage.sync` for user preferences:
  - `folderPattern`: `domain_date` | `domain_only` | `date_domain`
  - `nestedSubfolders`: `true` / `false`
  - `notifications`: `true` / `false`

- Settings UI:
  - Folder pattern dropdown with examples.
  - “Enable nested subfolders (FileType)” checkbox with explanation.
  - “Enable notifications” checkbox.

- Download log UI:
  - Shows newest downloads first.
  - Each entry displays:
    - Favicon (when available)
    - Filename
    - Folder path
    - File type
    - Domain (clean site name)
    - Date and time
    - File size
    - Source URL
    - Status
  - Buttons:
    - **Clear Log**: wipes the stored log.
    - **Export Log as JSON**: downloads `smart-download-log.json`.

All rendering is done using DOM APIs (no `innerHTML` for user-controlled values) to avoid HTML injection issues.

---

## Installation (Developer Mode)

1. Clone this repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
   cd YOUR_REPO
