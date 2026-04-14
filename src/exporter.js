/**
 * APIBridge AI — CSV Exporter
 * Generates detailed mismatch reports
 */

const fs   = require('fs');
const path = require('path');

/**
 * Export mismatches to CSV file
 */
function exportMismatchCSV(mismatches, outputPath = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filePath  = outputPath ||
    path.join(process.cwd(), '.apibridge', `mismatches_${timestamp}.csv`);

  const headers = [
    'timestamp',
    'session_id',
    'path',
    'source_key',
    'target_key',
    'confidence_%',
    'detection_method',
    'inferred_type',
    'auto_applied',
    'direction',
    'needs_review',
    'value_preview',
  ];

  const rows = mismatches.map(m => [
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
    m.confidence < 0.85 ? 'YES' : 'NO',
    String(m.value ?? '').slice(0, 40).replace(/"/g, "'").replace(/,/g, ';'),
  ]);

  // Sort: needs review first, then by confidence ascending
  rows.sort((a, b) => {
    if (a[10] === 'YES' && b[10] !== 'YES') return -1;
    if (a[10] !== 'YES' && b[10] === 'YES') return  1;
    return Number(a[5]) - Number(b[5]);
  });

  const csv = [
    '# APIBridge AI — Mismatch Report',
    `# Generated: ${new Date().toISOString()}`,
    `# Total mismatches: ${mismatches.length}`,
    `# Needs review: ${mismatches.filter(m => m.confidence < 0.85).length}`,
    `# Auto-fixed: ${mismatches.filter(m => m.autoApplied).length}`,
    '',
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row => row.map(v => `"${v}"`).join(',')),
  ].join('\n');

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, csv, 'utf8');

  console.log(`[APIBridge] CSV exported → ${filePath}`);
  console.log(`  Total mismatches : ${mismatches.length}`);
  console.log(`  Auto-fixed       : ${mismatches.filter(m => m.autoApplied).length}`);
  console.log(`  Needs review     : ${mismatches.filter(m => m.confidence < 0.85).length}`);

  return filePath;
}

/**
 * Export schema suggestions from learned mappings
 */
function exportSchemaSuggestions(learning, outputPath = null) {
  const filePath = outputPath ||
    path.join(process.cwd(), '.apibridge', 'schema_suggestions.json');

  const suggestions = learning.exportSchemaSuggestions();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(suggestions, null, 2));

  console.log(`[APIBridge] Schema suggestions → ${filePath}`);
  return filePath;
}

module.exports = { exportMismatchCSV, exportSchemaSuggestions };
