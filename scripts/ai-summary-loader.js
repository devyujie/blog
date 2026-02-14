'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(hexo.base_dir, 'ai-summaries.json');

let cachedMtimeMs = -1;
let cachedItems = {};
let warnedMissing = false;
let warnedInvalid = false;

function normalizePath(value) {
  return (value || '').replace(/\\/g, '/');
}

function resolveSummary(entry) {
  if (!entry || typeof entry.summary !== 'string') return '';
  const text = entry.summary.trim();
  return text || '';
}

function readCacheItems() {
  if (!fs.existsSync(CACHE_FILE)) {
    if (!warnedMissing) {
      hexo.log.info('[ai-summary] 未找到 ai-summaries.json，将跳过摘要注入。');
      warnedMissing = true;
    }
    cachedItems = {};
    cachedMtimeMs = -1;
    return cachedItems;
  }

  const stat = fs.statSync(CACHE_FILE);
  if (stat.mtimeMs === cachedMtimeMs) {
    return cachedItems;
  }

  cachedMtimeMs = stat.mtimeMs;

  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    const items = parsed && typeof parsed === 'object' ? parsed.items : null;
    cachedItems = items && typeof items === 'object' ? items : {};
    warnedInvalid = false;
  } catch (error) {
    cachedItems = {};
    if (!warnedInvalid) {
      hexo.log.warn(`[ai-summary] 读取 ai-summaries.json 失败: ${error.message}`);
      warnedInvalid = true;
    }
  }

  return cachedItems;
}

function getSummaryBySource(items, sourcePath) {
  if (!sourcePath) return '';

  const normalized = normalizePath(sourcePath);
  const candidates = [
    normalized,
    normalized.replace(/^source\//, ''),
    normalized.replace(/^.*\/source\//, ''),
    normalized.startsWith('_posts/') ? normalized : `_posts/${normalized}`
  ];

  for (const key of candidates) {
    const summary = resolveSummary(items[key]);
    if (summary) return summary;
  }

  const basename = path.posix.basename(normalized);
  for (const [key, entry] of Object.entries(items)) {
    const normalizedKey = normalizePath(key);
    if (normalizedKey.endsWith(`/${normalized}`) || normalizedKey.endsWith(`/${basename}`)) {
      const summary = resolveSummary(entry);
      if (summary) return summary;
    }
  }

  return '';
}

function assignSummary(data, summary) {
  if (!summary) return;
  data.ai_summary = summary;
  if (typeof data.set === 'function') {
    try {
      data.set('ai_summary', summary);
    } catch (error) {
    }
  }
}

hexo.extend.filter.register('before_post_render', function beforePostRender(data) {
  if (!data || data.layout !== 'post') return data;
  if (typeof data.ai_summary === 'string' && data.ai_summary.trim()) return data;

  const items = readCacheItems();
  const summary = getSummaryBySource(items, data.source || data.full_source || data.path);
  assignSummary(data, summary);

  return data;
});

hexo.extend.filter.register('before_generate', function beforeGenerate() {
  const items = readCacheItems();
  if (!items || Object.keys(items).length === 0) return;

  const posts = hexo.locals.get('posts');
  if (!posts || typeof posts.each !== 'function') return;

  posts.each(function attachSummary(post) {
    if (!post) return;
    if (typeof post.ai_summary === 'string' && post.ai_summary.trim()) return;
    const summary = getSummaryBySource(items, post.source || post.full_source || post.path);
    assignSummary(post, summary);
  });
});
