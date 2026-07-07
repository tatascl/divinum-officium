/**
 * BookmarkManager - Manages user bookmarks using localStorage
 * Bookmarks are lightweight metadata about offices user wants to save
 */

class BookmarkManager {
  constructor(storageKey = 'divinum-bookmarks') {
    this.storageKey = storageKey;
    this.bookmarks = this._load();
  }

  /**
   * Add a bookmark for an office
   * @param {string} date - Date in format YYYY-MM-DD
   * @param {string} hora - Hour/office type: 'Matutinum', 'Laudes', 'Vespera', etc.
   * @param {string} version - Rubric version: 'Rubrics 1960 - 1960', 'Tridentine - 1570', etc.
   * @param {string} language - Language code: 'Latin', 'English', etc.
   * @param {string} title - Display title for the bookmark
   * @returns {Object} The created bookmark object
   */
  addBookmark(date, hora, version, language, title) {
    const bookmark = {
      id: Date.now(),
      date: date,
      hora: hora,
      version: version,
      language: language,
      title: title || `${hora} - ${date}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Prevent duplicate bookmarks for the same office
    const exists = this.bookmarks.some(
      (b) => b.date === date && b.hora === hora && b.version === version
    );
    if (exists) {
      console.warn('Bookmark already exists for this office');
      return null;
    }

    this.bookmarks.push(bookmark);
    this._save();
    return bookmark;
  }

  /**
   * Remove a bookmark by ID
   * @param {number} id - Bookmark ID
   * @returns {boolean} True if bookmark was removed
   */
  removeBookmark(id) {
    const index = this.bookmarks.findIndex((b) => b.id === id);
    if (index > -1) {
      this.bookmarks.splice(index, 1);
      this._save();
      return true;
    }
    return false;
  }

  /**
   * Check if an office is bookmarked
   * @param {string} date
   * @param {string} hora
   * @param {string} version
   * @returns {boolean}
   */
  isBookmarked(date, hora, version) {
    return this.bookmarks.some(
      (b) => b.date === date && b.hora === hora && b.version === version
    );
  }

  /**
   * Get bookmark by ID
   * @param {number} id
   * @returns {Object|null}
   */
  getBookmark(id) {
    return this.bookmarks.find((b) => b.id === id) || null;
  }

  /**
   * Get all bookmarks, optionally filtered
   * @param {Object} filter - Optional filter object with date, hora, version, language
   * @returns {Array}
   */
  getBookmarks(filter = null) {
    if (!filter) {
      return this.bookmarks;
    }

    return this.bookmarks.filter((b) => {
      if (filter.date && b.date !== filter.date) return false;
      if (filter.hora && b.hora !== filter.hora) return false;
      if (filter.version && b.version !== filter.version) return false;
      if (filter.language && b.language !== filter.language) return false;
      return true;
    });
  }

  /**
   * Update bookmark metadata
   * @param {number} id
   * @param {Object} updates - Fields to update
   * @returns {Object|null}
   */
  updateBookmark(id, updates) {
    const bookmark = this.getBookmark(id);
    if (!bookmark) return null;

    Object.assign(bookmark, updates, {
      updatedAt: new Date().toISOString()
    });
    this._save();
    return bookmark;
  }

  /**
   * Get bookmark count
   * @returns {number}
   */
  count() {
    return this.bookmarks.length;
  }

  /**
   * Clear all bookmarks
   * @returns {boolean}
   */
  clearAll() {
    if (confirm('Clear all bookmarks? This cannot be undone.')) {
      this.bookmarks = [];
      this._save();
      return true;
    }
    return false;
  }

  /**
   * Export bookmarks as JSON
   * @returns {string}
   */
  export() {
    return JSON.stringify(this.bookmarks, null, 2);
  }

  /**
   * Import bookmarks from JSON
   * @param {string} json
   * @returns {boolean}
   */
  import(json) {
    try {
      const imported = JSON.parse(json);
      if (!Array.isArray(imported)) {
        throw new Error('Invalid format: expected array of bookmarks');
      }
      this.bookmarks = imported;
      this._save();
      return true;
    } catch (err) {
      console.error('Failed to import bookmarks:', err);
      return false;
    }
  }

  /**
   * Sort bookmarks by a field
   * @param {string} field - Field name: 'date', 'createdAt', 'title'
   * @param {string} order - 'asc' or 'desc'
   * @returns {Array}
   */
  sorted(field = 'createdAt', order = 'desc') {
    const sorted = [...this.bookmarks];
    sorted.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }

  // Private methods

  _load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
      return [];
    }
  }

  _save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.bookmarks));
    } catch (err) {
      console.error('Failed to save bookmarks:', err);
    }
  }
}
