/**
 * APIBridge AI — Learning Engine
 * 
 * Remembers every approval and rejection
 * Gets smarter on every use
 * Persists to disk between sessions
 */

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = path.join(process.cwd(), '.apibridge', 'learned.json');

class LearningEngine {
  constructor() {
    this.sessionId = crypto.randomBytes(4).toString('hex');
    this.approved  = new Map();   // sourceKey → targetKey
    this.rejected  = new Map();   // sourceKey → Set of wrong targets
    this.frequency = new Map();   // sourceKey → number of times seen
    this._load();
  }

  /**
   * Learn a mapping — approved or rejected
   */
  learn(sourceKey, targetKey, approved) {
    const norm = sourceKey.toLowerCase().trim();

    if (approved) {
      this.approved.set(norm, targetKey);

      // Remove from rejected if it was there
      if (this.rejected.has(norm)) {
        this.rejected.get(norm).delete(targetKey);
      }
    } else {
      if (!this.rejected.has(norm)) {
        this.rejected.set(norm, new Set());
      }
      this.rejected.get(norm).add(targetKey);

      // Remove from approved if wrong
      if (this.approved.get(norm) === targetKey) {
        this.approved.delete(norm);
      }
    }

    this._save();
  }

  /**
   * Auto-learn from transformer results
   * Called internally when high-confidence mapping is applied
   */
  autoLearn(sourceKey, targetKey, confidence) {
    if (confidence >= 0.97) {
      const norm = sourceKey.toLowerCase().trim();
      if (!this.approved.has(norm) && !this._isRejected(norm, targetKey)) {
        this.approved.set(norm, targetKey);
        this._incrementFrequency(norm);
      }
    }
  }

  /**
   * Lookup a previously learned mapping
   */
  lookup(sourceKey) {
    const norm = sourceKey.toLowerCase().trim();
    this._incrementFrequency(norm);
    return this.approved.get(norm) || null;
  }

  /**
   * Check if a mapping was previously rejected
   */
  _isRejected(sourceKey, targetKey) {
    const norm = sourceKey.toLowerCase().trim();
    return this.rejected.has(norm) && this.rejected.get(norm).has(targetKey);
  }

  _incrementFrequency(key) {
    this.frequency.set(key, (this.frequency.get(key) || 0) + 1);
  }

  /**
   * Get most frequently seen mismatches
   * Useful for suggesting which mappings to add to schema
   */
  getTopMismatches(limit = 20) {
    return [...this.frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key, count]) => ({
        sourceKey: key,
        learnedTarget: this.approved.get(key) || null,
        seenCount: count,
        status: this.approved.has(key) ? 'learned' : 'pending',
      }));
  }

  /**
   * Export learned mappings as schema suggestions
   */
  exportSchemaSuggestions() {
    const suggestions = {};
    for (const [source, target] of this.approved.entries()) {
      suggestions[target] = { from: source };
    }
    return suggestions;
  }

  size() {
    return this.approved.size;
  }

  /**
   * Persist to disk
   */
  _save() {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const data = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        approved:  Object.fromEntries(this.approved),
        rejected:  Object.fromEntries(
          [...this.rejected.entries()].map(([k, v]) => [k, [...v]])
        ),
        frequency: Object.fromEntries(this.frequency),
      };

      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      // Silent fail — learning is non-critical
    }
  }

  /**
   * Load from disk
   */
  _load() {
    try {
      if (!fs.existsSync(STORE_PATH)) return;
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));

      this.approved  = new Map(Object.entries(data.approved  || {}));
      this.frequency = new Map(Object.entries(data.frequency || {}));
      this.rejected  = new Map(
        Object.entries(data.rejected || {}).map(([k, v]) => [k, new Set(v)])
      );
    } catch (e) {
      // Silent fail — start fresh
    }
  }

  /**
   * Clear all learned data — fresh start
   */
  reset() {
    this.approved.clear();
    this.rejected.clear();
    this.frequency.clear();
    try { fs.unlinkSync(STORE_PATH); } catch {}
    console.log('[APIBridge] Learning engine reset.');
  }
}

module.exports = { LearningEngine };
