# Offline Storage & Bookmarks Feature

## Overview

This module adds offline storage and bookmarking capabilities to Divinum Officium. Users can:

- **Bookmark** specific offices to save them for quick access
- **Offline cache** offices once they've been fetched, making them available without internet
- **See offline indicator** when the app loses connectivity
- **Access cached offices** when offline

## Files

### JavaScript Libraries

- **`bookmark-manager.js`** - Lightweight bookmark management using localStorage
  - Methods: `addBookmark()`, `removeBookmark()`, `isBookmarked()`, `getBookmarks()`
  - Storage: HTML5 localStorage (~5MB per domain)
  - Use case: Quick metadata storage for user's bookmarked offices

- **`offline-cache.js`** - Office content caching using IndexedDB
  - Methods: `cacheOffice()`, `getOffice()`, `deleteOffice()`, `listCached()`
  - Storage: IndexedDB (typically 50MB+ available)
  - Use case: Store full HTML content of offices for offline access

- **`storage-init.js`** - Initialization script that wires everything together
  - Initializes both systems on page load
  - Exposes global functions: `toggleBookmark()`, `loadBookmarkedOffice()`, `getCacheStats()`
  - Listens for online/offline events

### Styles

- **`offline.css`** - UI components for offline mode, bookmarks, and cache status
  - Offline indicator badge
  - Bookmark button styles (starred/unstarred)
  - Bookmarks panel/sidebar
  - Mobile responsive design

## Integration Steps

### 1. Add Scripts to HTML

In `web/index.html` or the relevant template file, add these scripts before closing `</body>`:

```html
<!-- Offline storage and bookmarks -->
<script src="/www/js/bookmark-manager.js"></script>
<script src="/www/js/offline-cache.js"></script>
<script src="/www/js/storage-init.js"></script>
<link rel="stylesheet" href="/www/style/offline.css">
```

### 2. Add Offline Indicator Element

Add this near the top of the page (in `officium_html.pl` or template):

```html
<div id="offline-indicator"></div>
```

### 3. Add Bookmark Button

In the office display section, add:

```html
<button class="btn-bookmark" onclick="toggleBookmark('$date', '$hora', '$version', '$lang2', '$title')">
  Add to Bookmarks
</button>
```

### 4. Display Bookmarks Panel (Optional)

For a bookmarks sidebar, add this HTML:

```html
<div class="bookmarks-panel" id="bookmarks-panel">
  <h3>My Bookmarks</h3>
  <ul class="bookmarks-list" id="bookmarks-list"></ul>
  <div class="cache-status" id="cache-status"></div>
</div>
```

And add this JavaScript to render bookmarks:

```javascript
function renderBookmarks() {
  const list = document.getElementById('bookmarks-list');
  const bookmarks = window.getBookmarks();
  
  if (bookmarks.length === 0) {
    list.innerHTML = '<div class="empty">No bookmarks yet</div>';
    return;
  }
  
  list.innerHTML = bookmarks.map(b => `
    <li>
      <a href="#" onclick="loadBookmarkedOffice('${b.date}', '${b.hora}', '${b.version}', '${b.language}')">
        ${b.title} (${b.date})
      </a>
      <button class="remove-btn" onclick="divinumStorage.bookmarks.removeBookmark(${b.id}); renderBookmarks();">✕</button>
    </li>
  `).join('');
}

// Render on page load and when bookmarks change
document.addEventListener('divinumBookmarkChanged', renderBookmarks);
renderBookmarks();
```

## API Reference

### BookmarkManager

```javascript
// Global access
window.divinumStorage.bookmarks

// Methods
addBookmark(date, hora, version, language, title) // Returns bookmark object
removeBookmark(id)                                 // Returns boolean
isBookmarked(date, hora, version)                  // Returns boolean
getBookmarks(filter?)                              // Returns array of bookmarks
getBookmark(id)                                    // Returns bookmark or null
updateBookmark(id, updates)                        // Returns updated bookmark
count()                                            // Returns number of bookmarks
clearAll()                                         // Clears all bookmarks
export()                                           // Returns JSON string
import(json)                                       // Returns boolean
sorted(field, order)                               // Returns sorted array
```

### OfficeCache

```javascript
// Global access
window.divinumStorage.offlineCache

// Methods
await init()                                       // Initialize IndexedDB
await cacheOffice(date, hora, version, language)  // Fetch and cache from server
await getOffice(date, hora, version, language)    // Retrieve from cache
await deleteOffice(date, hora, version, language) // Delete from cache
await cleanExpired()                               // Remove expired entries
await getStats()                                   // Get cache statistics
await clearAll()                                   // Clear entire cache
await listCached()                                 // List all cached offices
```

### Global Functions

```javascript
// Bookmark toggle
toggleBookmark(date, hora, version, language, title)
isBookmarked(date, hora, version)

// Load bookmarked office
await loadBookmarkedOffice(date, hora, version, language)

// Get all bookmarks
getBookmarks()

// Cache management
await getCacheStats()
```

### Events

Custom events dispatched by the system:

```javascript
// Fired when online/offline status changes
window.addEventListener('divinumOnlineStatusChanged', (e) => {
  console.log('Online:', e.detail.online);
  console.log('Offline mode:', e.detail.offlineMode);
});

// Fired when a bookmark is added/removed
window.addEventListener('divinumBookmarkChanged', (e) => {
  console.log('Bookmark changed:', e.detail);
  console.log('Is bookmarked:', e.detail.isBookmarked);
});
```

## Browser Support

- **localStorage**: All modern browsers (IE8+)
- **IndexedDB**: All modern browsers (IE10+)
- **Offline detection**: All modern browsers

## Storage Limits

- **localStorage**: ~5-10 MB per domain
- **IndexedDB**: Typically 50-100 MB per domain (varies by browser)

Bookmarks use localStorage (very small, typically < 100 KB).
Office content uses IndexedDB (can grow large with many cached offices).

## Testing

### Simulate Offline Mode

In browser DevTools:
1. Open DevTools (F12)
2. Go to **Network** tab
3. Check "Offline" checkbox
4. Observe offline indicator appears
5. Try to load a new office (will fail or use cache if available)
6. Uncheck "Offline" to go back online

### Check Storage

```javascript
// In browser console
window.divinumStorage.bookmarks.getBookmarks()
window.divinumStorage.offlineCache.getStats()
```

### Clear Storage

```javascript
// Clear bookmarks
window.divinumStorage.bookmarks.clearAll()

// Clear cache
await window.divinumStorage.offlineCache.clearAll()
```

## Future Enhancements

1. **Service Workers** - Better offline support with background sync
2. **Sync settings** - Store user preferences offline
3. **Offline calendar** - Cache full month/year calendars
4. **Auto-cache** - Automatically cache upcoming feast days
5. **Cloud sync** - Sync bookmarks across devices
6. **Storage management UI** - User-friendly storage settings panel

## Troubleshooting

### "Cache not initialized" error

Make sure `await window.divinumStorage.offlineCache.init()` is called before using cache methods.
This is done automatically by `storage-init.js`.

### Bookmarks not persisting

Check that localStorage is enabled in browser settings.
Check browser console for errors.

### Cached office not loading offline

1. Verify office was cached while online: `await window.divinumStorage.offlineCache.listCached()`
2. Check if entry has expired: `await window.divinumStorage.offlineCache.getStats()`
3. Try clearing cache: `await window.divinumStorage.offlineCache.clearAll()`

### Storage quota exceeded

If IndexedDB fills up:
1. View stats: `await window.divinumStorage.offlineCache.getStats()`
2. Delete individual offices: `await window.divinumStorage.offlineCache.deleteOffice(...)`
3. Clear old entries: `await window.divinumStorage.offlineCache.cleanExpired()`
4. Clear all: `await window.divinumStorage.offlineCache.clearAll()`
