/**
 * APIBridge AI — Core Transformer
 * 
 * Multi-level mismatch detection and correction:
 * Level 1 — Exact match          (skip, already correct)
 * Level 2 — Case pattern         (pure algorithm, 99% confidence)
 * Level 3 — Known synonym        (dictionary lookup, 95% confidence)
 * Level 4 — Fuzzy + semantic     (levenshtein + synonym proximity, 70-90%)
 * Level 5 — Prefix grouping      (structural mismatch, 80% confidence)
 * Level 6 — Learned mappings     (from past approvals, 99% confidence)
 * Level 7 — Unknown              (flag for human, 0% confidence)
 */

const { distance } = require('fastest-levenshtein');
const { WORD_TO_GROUP, SYNONYM_GROUPS } = require('./synonyms');
const { LearningEngine } = require('./learning');

// ─── UTILITIES ────────────────────────────────────────────────────────────────

/**
 * Normalize any key to lowercase words array
 * "user_first_name" → ["user", "first", "name"]
 * "UserFirstName"   → ["user", "first", "name"]
 * "user-first-name" → ["user", "first", "name"]
 * "userFirstName"   → ["user", "first", "name"]
 */
function tokenize(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')  // ABCDef → ABC_Def
    .replace(/([a-z])([A-Z])/g, '$1_$2')        // camelCase → camel_Case
    .toLowerCase()
    .replace(/[-.\s]+/g, '_')           // kebab, dot, space → underscore
    .replace(/[^a-z0-9_]/g, '')         // remove special chars
    .split('_')
    .filter(Boolean);
}

/**
 * Convert tokens to camelCase
 * ["user", "first", "name"] → "userFirstName"
 */
function toCamel(tokens) {
  return tokens
    .map((t, i) => i === 0 ? t : t[0].toUpperCase() + t.slice(1))
    .join('');
}

/**
 * Convert tokens to snake_case
 */
function toSnake(tokens) {
  return tokens.join('_');
}

/**
 * Detect naming convention of a key
 */
function detectConvention(key) {
  if (/^[a-z][a-zA-Z0-9]*$/.test(key) && /[A-Z]/.test(key)) return 'camelCase';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(key)) return 'PascalCase';
  if (/^[a-z][a-z0-9_]*$/.test(key) && key.includes('_')) return 'snake_case';
  if (/^[a-z][a-z0-9-]*$/.test(key) && key.includes('-')) return 'kebab-case';
  if (/^[A-Z][A-Z0-9_]*$/.test(key)) return 'SCREAMING_SNAKE';
  return 'unknown';
}

/**
 * Semantic similarity between two keys using synonym groups
 * Returns 0.0 to 1.0
 */
function semanticSimilarity(keyA, keyB) {
  const tokensA = tokenize(keyA);
  const tokensB = tokenize(keyB);

  let matchScore = 0;
  let totalTokens = Math.max(tokensA.length, tokensB.length);

  for (const tA of tokensA) {
    for (const tB of tokensB) {
      // Exact token match
      if (tA === tB) { matchScore += 1; continue; }

      // Same synonym group
      const groupA = WORD_TO_GROUP.get(tA);
      const groupB = WORD_TO_GROUP.get(tB);
      if (groupA !== undefined && groupA === groupB) {
        matchScore += 0.9;
        continue;
      }

      // Fuzzy token match (typos, abbreviations)
      const dist = distance(tA, tB);
      const maxLen = Math.max(tA.length, tB.length);
      if (maxLen > 0) {
        const similarity = 1 - dist / maxLen;
        if (similarity > 0.7) matchScore += similarity * 0.7;
      }
    }
  }

  return Math.min(matchScore / totalTokens, 1.0);
}

/**
 * Type coercion — convert SQL types to JS types and back
 */
const TYPE_COERCIONS = {
  toJS: {
    boolean: (v) => {
      if (typeof v === 'boolean') return v;
      if (v === 1 || v === '1' || v === 'true' || v === 'yes') return true;
      if (v === 0 || v === '0' || v === 'false' || v === 'no') return false;
      return Boolean(v);
    },
    number:  (v) => {
      const n = Number(v);
      return isNaN(n) ? v : n;
    },
    date:    (v) => {
      if (v instanceof Date) return v;
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d;
    },
    string:  (v) => String(v),
    array:   (v) => {
      if (Array.isArray(v)) return v;
      try { return JSON.parse(v); } catch { return [v]; }
    },
    json:    (v) => {
      if (typeof v === 'object') return v;
      try { return JSON.parse(v); } catch { return v; }
    },
  },
  toSQL: {
    boolean: (v) => (v ? 1 : 0),
    number:  (v) => String(v),
    date:    (v) => {
      const d = v instanceof Date ? v : new Date(v);
      return d.toISOString().slice(0, 19).replace('T', ' ');
    },
    string:  (v) => String(v),
    array:   (v) => JSON.stringify(v),
    json:    (v) => JSON.stringify(v),
  }
};

/**
 * Infer likely type from value
 */
function inferType(value) {
  if (value === null || value === undefined) return 'unknown';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value instanceof Date) return 'date';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'json';
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    if (value === 'true' || value === 'false') return 'boolean';
    if (value === '1' || value === '0') return 'probable_boolean';
    if (/^\d+\.\d+$/.test(value)) return 'number';
    if (/^\d+$/.test(value)) return 'integer_string';
  }
  return 'string';
}

// ─── MAIN TRANSFORMER ─────────────────────────────────────────────────────────

class APIBridgeTransformer {
  constructor(options = {}) {
    this.options = {
      targetConvention: 'camelCase',   // what frontend expects
      sourceConvention: 'auto',        // auto-detect from API
      autoApplyThreshold: 0.85,        // confidence to auto-apply
      logMismatches: true,
      learnFromApprovals: true,
      ...options
    };

    this.learning = new LearningEngine();
    this.mismatches = [];             // session mismatch log
    this.stats = {
      totalFields: 0,
      exactMatches: 0,
      autoFixed: 0,
      flagged: 0,
      learned: 0,
    };
  }

  /**
   * MAIN ENTRY — Transform any object from API to frontend shape
   */
  transform(data, schema = null, direction = 'toFrontend') {
    if (data === null || data === undefined) return data;
    if (Array.isArray(data)) {
      return data.map(item => this.transform(item, schema, direction));
    }
    if (typeof data !== 'object') return data;
    return this._transformObject(data, schema, direction, '');
  }

  _transformObject(obj, schema, direction, prefix) {
    const result = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      this.stats.totalFields++;

      // Recursively transform nested objects
      const transformedValue = (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date)
      )
        ? this._transformObject(
            value,
            schema ? schema[key] : null,
            direction,
            fullPath
          )
        : Array.isArray(value)
          ? value.map(v =>
              typeof v === 'object' && v !== null
                ? this._transformObject(v, null, direction, fullPath + '[]')
                : v
            )
          : value;

      // Get the target key name
      const mapping = this._resolveKey(key, fullPath, schema, direction, value);

      // Apply type coercion if schema specifies type
      let finalValue = transformedValue;
      if (schema && schema[mapping.targetKey] && schema[mapping.targetKey].type) {
        const type = schema[mapping.targetKey].type;
        const coercions = direction === 'toFrontend'
          ? TYPE_COERCIONS.toJS
          : TYPE_COERCIONS.toSQL;
        if (coercions[type]) {
          finalValue = coercions[type](transformedValue);
        }
      }

      result[mapping.targetKey] = finalValue;

      // Log mismatch if key was changed
      if (mapping.targetKey !== key) {
        this._logMismatch({
          sourceKey:    key,
          targetKey:    mapping.targetKey,
          confidence:   mapping.confidence,
          method:       mapping.method,
          value:        value,
          inferredType: inferType(value),
          autoApplied:  mapping.confidence >= this.options.autoApplyThreshold,
          path:         fullPath,
          direction,
        });
      } else {
        this.stats.exactMatches++;
      }
    }

    return result;
  }

  /**
   * Resolve what the target key should be — the core AI logic
   */
  _resolveKey(key, path, schema, direction, value) {
    const targetConvention = this.options.targetConvention;

    // ── Level 1: Already correct convention ──────────────────────────────────
    const convention = detectConvention(key);
    if (convention === targetConvention) {
      return { targetKey: key, confidence: 1.0, method: 'exact_match' };
    }

    // ── Level 2: Learned mapping (from past approvals) ────────────────────────
    const learned = this.learning.lookup(key);
    if (learned) {
      this.stats.learned++;
      return { targetKey: learned, confidence: 0.99, method: 'learned' };
    }

    // ── Level 3: Schema-defined mapping ──────────────────────────────────────
    if (schema) {
      for (const [schemaKey, schemaVal] of Object.entries(schema)) {
        if (
          schemaVal.column === key ||
          schemaVal.from === key ||
          tokenize(schemaKey).join('') === tokenize(key).join('')
        ) {
          return { targetKey: schemaKey, confidence: 1.0, method: 'schema' };
        }
      }
    }

    // ── Level 4: Pure pattern conversion ─────────────────────────────────────
    const tokens = tokenize(key);
    let targetKey;
    if (targetConvention === 'camelCase') targetKey = toCamel(tokens);
    else if (targetConvention === 'snake_case') targetKey = toSnake(tokens);
    else targetKey = toCamel(tokens);

    // Same tokens, different convention — very high confidence
    if (tokenize(targetKey).join('') === tokens.join('')) {
      this.stats.autoFixed++;
      return { targetKey, confidence: 0.97, method: 'pattern_conversion' };
    }

    // ── Level 5: Synonym group match ─────────────────────────────────────────
    const keyTokens = tokenize(key);
    const synonymKey = this._synonymMatch(keyTokens, targetConvention);
    if (synonymKey && synonymKey !== key) {
      this.stats.autoFixed++;
      return { targetKey: synonymKey, confidence: 0.92, method: 'synonym_match' };
    }

    // ── Level 6: Fuzzy semantic match ─────────────────────────────────────────
    // (used when we have a known frontend schema to compare against)
    if (schema) {
      let bestMatch = null;
      let bestScore = 0;
      for (const schemaKey of Object.keys(schema)) {
        const score = semanticSimilarity(key, schemaKey);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = schemaKey;
        }
      }
      if (bestMatch && bestScore > 0.7) {
        if (bestScore >= this.options.autoApplyThreshold) {
          this.stats.autoFixed++;
        } else {
          this.stats.flagged++;
        }
        return {
          targetKey: bestMatch,
          confidence: bestScore,
          method: 'semantic_fuzzy'
        };
      }
    }

    // ── Level 7: Best effort — just convert convention ─────────────────────────
    this.stats.flagged++;
    return { targetKey, confidence: 0.6, method: 'best_effort' };
  }

  /**
   * Match key tokens against synonym dictionary
   */
  _synonymMatch(tokens, targetConvention) {
    // Find synonym group for each token
    const resolvedTokens = tokens.map(token => {
      const groupIdx = WORD_TO_GROUP.get(token);
      if (groupIdx !== undefined) {
        // Use first word in group as canonical form
        const canonical = SYNONYM_GROUPS[groupIdx][0];
        return tokenize(canonical)[0];
      }
      return token;
    });

    if (targetConvention === 'camelCase') return toCamel(resolvedTokens);
    return toSnake(resolvedTokens);
  }

  /**
   * Log mismatch for CSV export and learning
   */
  _logMismatch(entry) {
    const record = {
      ...entry,
      timestamp: new Date().toISOString(),
      session: this.learning.sessionId,
    };
    this.mismatches.push(record);

    if (this.options.logMismatches && !entry.autoApplied) {
      console.warn(
        `[APIBridge] ⚠ Mismatch (${Math.round(entry.confidence * 100)}% confidence)\n` +
        `  Path:     ${entry.path}\n` +
        `  API key:  "${entry.sourceKey}"\n` +
        `  Mapped:   "${entry.targetKey}"\n` +
        `  Method:   ${entry.method}\n` +
        `  Auto:     ${entry.autoApplied ? 'YES' : 'NO — needs approval'}\n`
      );
    }
  }

  /**
   * Developer approves a mapping — teaches the AI
   */
  approve(sourceKey, targetKey) {
    this.learning.learn(sourceKey, targetKey, true);
    console.log(`[APIBridge] ✓ Learned: "${sourceKey}" → "${targetKey}"`);
  }

  /**
   * Developer rejects a mapping — AI learns what NOT to do
   */
  reject(sourceKey, wrongTargetKey, correctTargetKey) {
    this.learning.learn(sourceKey, wrongTargetKey, false);
    if (correctTargetKey) {
      this.learning.learn(sourceKey, correctTargetKey, true);
    }
    console.log(`[APIBridge] ✗ Rejected: "${sourceKey}" → "${wrongTargetKey}"` +
      (correctTargetKey ? ` | Correct: "${correctTargetKey}"` : ''));
  }

  /**
   * Export all mismatches to CSV
   */
  exportCSV() {
    const headers = [
      'timestamp',
      'session',
      'path',
      'source_key',
      'target_key',
      'confidence_percent',
      'method',
      'inferred_type',
      'auto_applied',
      'direction',
      'value_preview',
    ];

    const rows = this.mismatches.map(m => [
      m.timestamp,
      m.session,
      m.path,
      m.sourceKey,
      m.targetKey,
      Math.round(m.confidence * 100),
      m.method,
      m.inferredType,
      m.autoApplied ? 'YES' : 'NO',
      m.direction,
      String(m.value).slice(0, 30).replace(/,/g, ';'),
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${v}"`).join(','))
      .join('\n');

    return csv;
  }

  /**
   * Get summary stats for this session
   */
  getStats() {
    return {
      ...this.stats,
      totalMismatches: this.mismatches.length,
      autoFixRate: this.stats.totalFields > 0
        ? Math.round((this.stats.autoFixed / this.stats.totalFields) * 100) + '%'
        : '0%',
      learnedMappings: this.learning.size(),
    };
  }

  /**
   * Get all pending mismatches that need human approval
   */
  getPending() {
    return this.mismatches.filter(
      m => !m.autoApplied && m.confidence < this.options.autoApplyThreshold
    );
  }
}

module.exports = {
  APIBridgeTransformer,
  tokenize,
  toCamel,
  toSnake,
  detectConvention,
  semanticSimilarity,
  inferType,
  TYPE_COERCIONS,
};
