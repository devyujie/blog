'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const SOURCE_DIR = path.join(ROOT_DIR, 'source');
const POSTS_DIR = path.join(SOURCE_DIR, '_posts');
const CACHE_FILE = path.join(ROOT_DIR, 'ai-summaries.json');
const PROMPT_FILE = path.join(ROOT_DIR, 'docs', 'ai-summary-prompt.md');
const ELOG_ENV_FILE = path.join(ROOT_DIR, '.elog.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const sepIndex = normalized.indexOf('=');
    if (sepIndex <= 0) continue;

    const key = normalized.slice(0, sepIndex).trim();
    let value = normalized.slice(sepIndex + 1).trim();
    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadEnvFile(ELOG_ENV_FILE);

const API_URL = process.env.ZHIPU_AI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = process.env.ZHIPU_AI_MODEL || 'glm-4.7-flashx';
const THINKING_TYPE = process.env.ZHIPU_AI_THINKING || 'disabled';
const MAX_INPUT_CHARS = Number(process.env.ZHIPU_AI_MAX_INPUT_CHARS || 12000);
const MAX_OUTPUT_TOKENS = Number(process.env.ZHIPU_AI_MAX_OUTPUT_TOKENS || 240);

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  return {
    force: args.includes('--force') || args.includes('-f')
  };
}

const DEFAULT_SYSTEM_PROMPT = [
  '你是一个技术博客摘要助手。请基于给定文章生成高质量中文摘要，严格遵守以下规则：',
  '1. 只根据文章内容总结，不补充未出现的事实，不编造结论。',
  '2. 输出 1 段摘要，长度控制在 120-220 字。',
  '3. 重点覆盖：文章核心问题或背景、关键方案/观点、结果或结论。',
  '4. 保持客观、清晰、可读，不使用套话。',
  '5. 不输出标题、不输出列表、不输出 Markdown 标记。'
].join('\n');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePath(value) {
  return (value || '').replace(/\\/g, '/');
}

function readJson(filePath, fallbackValue) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return fallbackValue;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readPrompt() {
  if (!fs.existsSync(PROMPT_FILE)) {
    return DEFAULT_SYSTEM_PROMPT;
  }

  const prompt = fs.readFileSync(PROMPT_FILE, 'utf8').trim();
  return prompt || DEFAULT_SYSTEM_PROMPT;
}

function listMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];

  const results = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.md')) continue;
      results.push(fullPath);
    }
  }

  results.sort();
  return results;
}

function splitFrontMatter(rawContent) {
  const text = rawContent.replace(/^\uFEFF/, '');
  const matched = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!matched) {
    return {
      frontMatter: '',
      body: text
    };
  }

  return {
    frontMatter: matched[1],
    body: matched[2]
  };
}

function readFrontMatterScalar(frontMatter, key) {
  if (!frontMatter) return '';

  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matched = frontMatter.match(new RegExp(`^${escaped}:\\s*(.+)$`, 'im'));
  if (!matched) return '';

  const value = matched[1].trim();
  if (!value) return '';

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
    return value.slice(1, -1).trim();
  }

  return value;
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s*/gm, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

function computeHash(title, body) {
  return crypto.createHash('sha1').update(`${title}\n${body}`).digest('hex');
}

function normalizeSummary(text) {
  if (typeof text !== 'string') return '';

  return text
    .replace(/^\s*摘要[:：]\s*/i, '')
    .replace(/^["“”]+|["“”]+$/g, '')
    .replace(/\r/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function getResponseText(data) {
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  if (!Array.isArray(content)) {
    const fallbackText =
      (data && data.choices && data.choices[0] && data.choices[0].text) ||
      data.output_text ||
      (data && data.output && data.output.text);
    return typeof fallbackText === 'string' ? fallbackText : '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (part && typeof part.text === 'string') return part.text;
      return '';
    })
    .join('\n');
}

async function requestSummary(apiKey, prompt, title, bodyText) {
  if (typeof fetch !== 'function') {
    throw new Error('当前 Node 版本不支持 fetch，请升级到 Node 18+。');
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = setTimeout(() => {
    if (controller) controller.abort();
  }, 45000);

  const articleText = bodyText.length > MAX_INPUT_CHARS ? `${bodyText.slice(0, MAX_INPUT_CHARS)}\n\n[内容已截断]` : bodyText;
  const userContent = [
    `文章标题：${title || '未命名文章'}`,
    '',
    '文章正文：',
    articleText,
    '',
    '请直接输出摘要正文。'
  ].join('\n');

  const payload = {
    model: MODEL,
    temperature: 0.3,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: userContent }
    ]
  };
  if (THINKING_TYPE) {
    payload.thinking = { type: THINKING_TYPE };
  }

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    });
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (error) {
    if (!response.ok) {
      throw new Error(`请求失败(${response.status})，返回非 JSON：${text.slice(0, 200)}`);
    }
    throw new Error(`接口返回非 JSON：${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const message = (data && data.error && data.error.message) || JSON.stringify(data).slice(0, 240);
    throw new Error(`请求失败(${response.status})：${message}`);
  }

  const summary = normalizeSummary(getResponseText(data));
  if (!summary) {
    throw new Error(`接口返回成功，但摘要内容为空。response=${JSON.stringify(data).slice(0, 300)}`);
  }
  return summary;
}

function createDefaultCache() {
  return {
    version: 1,
    updatedAt: null,
    items: {}
  };
}

function loadCache() {
  const cache = readJson(CACHE_FILE, createDefaultCache());
  if (!cache || typeof cache !== 'object') return createDefaultCache();
  if (!cache.items || typeof cache.items !== 'object') {
    cache.items = {};
  }
  return cache;
}

async function main() {
  const cli = parseArgs(process.argv.slice(2));
  const apiKey = (process.env.ZHIPU_AI_API_KEY || '').trim();
  const prompt = readPrompt();
  const cache = loadCache();
  const files = listMarkdownFiles(POSTS_DIR);

  const activeKeys = new Set();
  let generated = 0;
  let reused = 0;
  let skipped = 0;
  let failed = 0;
  let removed = 0;
  let changed = false;

  if (files.length === 0) {
    console.log('[ai-summary] 未发现文章文件，跳过。');
    return;
  }

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = splitFrontMatter(raw);
    const title = readFrontMatterScalar(parsed.frontMatter, 'title') || path.basename(filePath, path.extname(filePath));
    const plainBody = stripMarkdown(parsed.body || '');
    if (!plainBody) {
      skipped += 1;
      continue;
    }

    const key = normalizePath(path.relative(SOURCE_DIR, filePath));
    activeKeys.add(key);
    const hash = computeHash(title, plainBody);
    const existed = cache.items[key];

    if (!cli.force && existed && existed.hash === hash && typeof existed.summary === 'string' && existed.summary.trim()) {
      reused += 1;
      continue;
    }

    if (!apiKey) {
      skipped += 1;
      continue;
    }

    try {
      const summary = await requestSummary(apiKey, prompt, title, plainBody);
      cache.items[key] = {
        title,
        hash,
        summary,
        model: MODEL,
        generatedAt: new Date().toISOString()
      };
      changed = true;
      generated += 1;
      console.log(`[ai-summary] 已生成: ${key}`);
      await sleep(250);
    } catch (error) {
      failed += 1;
      console.error(`[ai-summary] 生成失败: ${key}`);
      console.error(`  ${error.message}`);
    }
  }

  for (const key of Object.keys(cache.items)) {
    if (activeKeys.has(key)) continue;
    delete cache.items[key];
    removed += 1;
    changed = true;
  }

  if (changed) {
    cache.updatedAt = new Date().toISOString();
    writeJson(CACHE_FILE, cache);
    console.log(`[ai-summary] 缓存已更新: ${normalizePath(path.relative(ROOT_DIR, CACHE_FILE))}`);
  }

  if (!apiKey) {
    console.log('[ai-summary] 未设置 ZHIPU_AI_API_KEY，本次仅复用本地缓存。');
  }
  if (cli.force) {
    console.log('[ai-summary] 已启用 --force，忽略缓存哈希并强制重算。');
  }

  console.log(
    `[ai-summary] 完成 reused=${reused} generated=${generated} skipped=${skipped} removed=${removed} failed=${failed}`
  );
}

main().catch((error) => {
  console.error('[ai-summary] 执行失败:', error.message);
  process.exitCode = 1;
});
