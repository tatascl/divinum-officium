/**
 * OfficeCache - Manages offline caching of office content using IndexedDB
 * Allows offices to be fetched once and used offline
 */

class OfficeCache {
  constructor(dbName = 'DivinumOfficium', storeName = 'offices', ttlDays = 30) {
    this.dbName = dbName;
    this.storeName = storeName;
    this.ttlMs = ttlDays * 24 * 60 * 60 * 1000; // TTL in milliseconds
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the database
   * @returns {Promise<void>}
   */
  async init() {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store for offices
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'cacheKey'
          });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('hora', 'hora', { unique: false });
          store.createIndex('version', 'version', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to initialize database:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cached office content
   * @param {string} date
   * @param {string} hora
   * @param {string} version
   * @param {string} language
   * @returns {Promise<Object|null>}
   */
  async getOffice(date, hora, version, language) {
    if (!this.db) {
      console.warn('Cache not initialized');
      return null;
    }

    const cacheKey = this._makeCacheKey(date, hora, version, language);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(cacheKey);

      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          // Check if expired
          if (data.expiresAt > Date.now()) {
            // Update access time
            this._updateAccessTime(cacheKey);
            resolve(data);
          } else {
            // Remove expired entry
            this._deleteEntry(cacheKey);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('Failed to retrieve cached office:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Cache an office by fetching from server
   * @param {string} date
   * @param {string} hora
   * @param {string} version
   * @param {string} language
   * @returns {Promise<Object>}
   */
  async cacheOffice(date, hora, version, language) {
    if (!this.db) {
      throw new Error('Cache not initialized');
    }

    // Check if already cached and valid
    const cached = await this.getOffice(date, hora, version, language);
    if (cached) {
      return cached;
    }

    // Fetch from server
    const html = await this._fetchFromServer(date, hora, version, language);
    if (!html) {
      throw new Error('Failed to fetch office from server');
    }

    // Store in IndexedDB
    const cacheKey = this._makeCacheKey(date, hora, version, language);
    const officeData = {
      cacheKey: cacheKey,
      date: date,
      hora: hora,
      version: version,
      language: language,
      html: html,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      expiresAt: Date.now() + this.ttlMs
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(officeData);

      request.onsuccess = () => resolve(officeData);
      request.onerror = () => {
        console.error('Failed to store office in cache:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a specific cached office
   * @param {string} date
   * @param {string} hora
   * @param {string} version
   * @param {string} language
   * @returns {Promise<boolean>}
   */
  async deleteOffice(date, hora, version, language) {
    if (!this.db) return false;

    const cacheKey = this._makeCacheKey(date, hora, version, language);
    return this._deleteEntry(cacheKey);
  }

  /**
   * Clean expired cache entries
   * @returns {Promise<number>} Number of entries deleted
   */
  async cleanExpired() {
    if (!this.db) return 0;

    const now = Date.now();
    let deleted = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };

      request.onerror = () => {
        console.error('Failed to clean expired entries:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const countRequest = store.count();

      const stats = {
        dbName: this.dbName,
        storeName: this.storeName,
        officeCount: 0,
        estimatedSizeKb: 0,
        oldestEntry: null,
        newestEntry: null
      };

      countRequest.onsuccess = () => {
        stats.officeCount = countRequest.result;

        // Get oldest and newest entries
        const allRequest = store.getAll();
        allRequest.onsuccess = () => {
          const entries = allRequest.result;
          if (entries.length > 0) {
            const timestamps = entries.map((e) => e.timestamp).sort();
            stats.oldestEntry = new Date(timestamps[0]).toISOString();
            stats.newestEntry = new Date(timestamps[timestamps.length - 1]).toISOString();

            // Rough estimate of size
            const totalSize = entries.reduce(
              (sum, e) => sum + (e.html ? e.html.length : 0),
              0
            );
            stats.estimatedSizeKb = Math.round(totalSize / 1024);
          }

          resolve(stats);
        };

        allRequest.onerror = () => reject(allRequest.error);
      };

      countRequest.onerror = () => reject(countRequest.error);
    });
  }

  /**
   * Clear all cached offices
   * @returns {Promise<number>} Number of entries deleted
   */
  async clearAll() {
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        // Count was approximate; return a success indicator
        resolve(0);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get list of all cached offices
   * @returns {Promise<Array>}
   */
  async listCached() {
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result;
        // Filter out expired entries
        const now = Date.now();
        const valid = entries
          .filter((e) => e.expiresAt > now)
          .map((e) => ({
            date: e.date,
            hora: e.hora,
            version: e.version,
            language: e.language,
            cachedAt: new Date(e.timestamp).toISOString(),
            expiresAt: new Date(e.expiresAt).toISOString()
          }));
        resolve(valid);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Private methods

  _makeCacheKey(date, hora, version, language) {
    return `${date}|${hora}|${version}|${language}`;
  }

  async _fetchFromServer(date, hora, version, language) {
    try {
      const params = new URLSearchParams({
        date1: date,
        command: `pray${hora}`,
        version: version,
        lang2: language,
        content: '1' // Return only content without HTML wrapper
      });

      const response = await fetch(`/cgi-bin/horas/Pofficium.pl?${params}`, {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.text();
    } catch (err) {
      console.error('Failed to fetch office from server:', err);
      throw err;
    }
  }

  _updateAccessTime(cacheKey) {
    if (!this.db) return;

    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    const getRequest = store.get(cacheKey);

    getRequest.onsuccess = () => {
      const data = getRequest.result;
      if (data) {
        data.lastAccessed = Date.now();
        store.put(data);
      }
    };
  }

  _deleteEntry(cacheKey) {
    if (!this.db) return Promise.resolve(false);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(cacheKey);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }
}
