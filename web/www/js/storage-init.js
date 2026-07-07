/**
 * storage-init.js - Initialize offline storage and bookmarks
 * This script should be included in the HTML head or early in the page load
 */

(function (window) {
  'use strict';

  // Create global storage objects
  window.divinumStorage = {
    bookmarks: new BookmarkManager(),
    offlineCache: new OfficeCache(),
    initialized: false,
    offlineMode: false
  };

  /**
   * Initialize storage systems
   */
  async function initStorage() {
    try {
      // Initialize IndexedDB
      await window.divinumStorage.offlineCache.init();
      window.divinumStorage.initialized = true;
      console.log('Divinum Officium storage initialized');

      // Check if we're online
      updateOnlineStatus();

      // Listen for online/offline events
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);

      // Log stats
      const stats = await window.divinumStorage.offlineCache.getStats();
      console.log('Cache stats:', stats);

      // Clean expired entries on initialization
      const cleaned = await window.divinumStorage.offlineCache.cleanExpired();
      if (cleaned > 0) {
        console.log(`Cleaned ${cleaned} expired cache entries`);
      }
    } catch (err) {
      console.error('Failed to initialize storage:', err);
    }
  }

  /**
   * Update offline mode indicator
   */
  function updateOnlineStatus() {
    const wasOffline = window.divinumStorage.offlineMode;
    window.divinumStorage.offlineMode = !navigator.onLine;

    // Update UI
    const indicator = document.getElementById('offline-indicator');
    if (indicator) {
      if (window.divinumStorage.offlineMode) {
        indicator.classList.add('active');
        indicator.textContent = '⚠ Offline Mode';
      } else {
        indicator.classList.remove('active');
        indicator.textContent = '';
      }
    }

    // Dispatch custom event
    const event = new CustomEvent('divinumOnlineStatusChanged', {
      detail: {
        online: navigator.onLine,
        offlineMode: window.divinumStorage.offlineMode
      }
    });
    window.dispatchEvent(event);

    console.log(`Online status: ${navigator.onLine ? 'Online' : 'Offline'}`);
  }

  /**
   * Hook for bookmarking
   * @param {string} date
   * @param {string} hora
   * @param {string} version
   * @param {string} language
   * @param {string} title
   */
  window.toggleBookmark = function (date, hora, version, language, title) {
    if (window.divinumStorage.bookmarks.isBookmarked(date, hora, version)) {
      // Remove bookmark
      const bookmark = window.divinumStorage.bookmarks.bookmarks.find(
        (b) => b.date === date && b.hora === hora && b.version === version
      );
      if (bookmark) {
        window.divinumStorage.bookmarks.removeBookmark(bookmark.id);
        console.log('Bookmark removed');
      }
    } else {
      // Add bookmark
      const bookmark = window.divinumStorage.bookmarks.addBookmark(
        date,
        hora,
        version,
        language,
        title
      );
      if (bookmark) {
        console.log('Bookmark added:', bookmark);

        // Optionally cache the office
        if (navigator.onLine) {
          window.divinumStorage.offlineCache
            .cacheOffice(date, hora, version, language)
            .catch((err) => console.warn('Failed to cache office:', err));
        }
      }
    }

    // Dispatch event for UI update
    const event = new CustomEvent('divinumBookmarkChanged', {
      detail: {
        date,
        hora,
        version,
        isBookmarked: window.divinumStorage.bookmarks.isBookmarked(
          date,
          hora,
          version
        )
      }
    });
    window.dispatchEvent(event);
  };

  /**
   * Check if office is bookmarked
   */
  window.isBookmarked = function (date, hora, version) {
    return window.divinumStorage.bookmarks.isBookmarked(date, hora, version);
  };

  /**
   * Load a bookmarked office
   */
  window.loadBookmarkedOffice = async function (
    date,
    hora,
    version,
    language
  ) {
    try {
      let office = await window.divinumStorage.offlineCache.getOffice(
        date,
        hora,
        version,
        language
      );

      if (!office && navigator.onLine) {
        // Fetch from server if online
        office = await window.divinumStorage.offlineCache.cacheOffice(
          date,
          hora,
          version,
          language
        );
      }

      if (office) {
        return office;
      } else {
        throw new Error(
          'Office not in cache and offline. Go online to download.'
        );
      }
    } catch (err) {
      console.error('Failed to load bookmarked office:', err);
      throw err;
    }
  };

  /**
   * Get all bookmarks
   */
  window.getBookmarks = function () {
    return window.divinumStorage.bookmarks.getBookmarks();
  };

  /**
   * Get cache stats
   */
  window.getCacheStats = async function () {
    return window.divinumStorage.offlineCache.getStats();
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStorage);
  } else {
    initStorage();
  }
})(window);
