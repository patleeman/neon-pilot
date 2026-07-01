#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const docsRoot = path.join(root, 'docs');
const docsPublicRoot = path.join(docsRoot, 'public');
const outRoot = path.join(root, 'apps/site/docs');
const prettierOptions = { ...(await prettier.resolveConfig(path.join(root, 'apps/site/docs/index.html'))), parser: 'html' };

const repoUrl = 'https://github.com/patleeman/neon-pilot/blob/main';

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function stripOrderPrefix(value) {
  return value.replace(/^\d+[-_]/, '');
}

function titleize(value) {
  return stripOrderPrefix(value)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

async function collectMarkdownFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function firstHeading(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) return titleize(fallback);
  return match[1].replace(/\s+#+$/, '').replace(/`/g, '');
}

function slugFromPublicPath(publicPath) {
  const basename = stripOrderPrefix(path.posix.basename(publicPath, '.md'));
  return basename === 'index' ? 'index' : stripOrderPrefix(basename);
}

function groupFromPublicPath(publicPath) {
  const parts = publicPath.split('/');
  return parts.length > 1 ? titleize(parts[0]) : 'Start here';
}

function outputHref(page) {
  return page.slug === 'index' ? './' : `./${page.slug}.html`;
}

function inlineMd(text, currentPage) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${rewriteHref(href, currentPage)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

let pages = [];
let pagesByPublicPath = new Map();
let pagesByBasename = new Map();

function rewriteExternalHref(hrefPath, suffix, currentPage) {
  const localPath = path.posix.normalize(path.posix.join(path.posix.dirname(currentPage.sourcePath), hrefPath.replace(/^\.\//, '')));
  if (existsSync(path.join(root, localPath))) return `${repoUrl}/${localPath}${suffix}`;

  const docsRelativeFallback = path.posix.normalize(path.posix.join('docs', hrefPath.replace(/^\.\.\/+/, '').replace(/^\.\//, '')));
  if (existsSync(path.join(root, docsRelativeFallback))) return `${repoUrl}/${docsRelativeFallback}${suffix}`;

  return `${repoUrl}/${localPath}${suffix}`;
}

function rewriteHref(href, currentPage) {
  if (/^(https?:|#|mailto:)/.test(href)) return href;
  const [hrefPath, suffix = ''] = href.split(/(?=[#?])/);
  const cleanPath = hrefPath.replace(/^\.\//, '');
  const relativePublicPath = path.posix.normalize(path.posix.join(path.posix.dirname(currentPage.publicPath), cleanPath));
  const page =
    pagesByPublicPath.get(relativePublicPath) ||
    pagesByPublicPath.get(relativePublicPath.replace(/^docs\/public\//, '')) ||
    pagesByBasename.get(path.posix.basename(cleanPath));
  if (page) return `${outputHref(page)}${suffix}`;
  return rewriteExternalHref(hrefPath, suffix, currentPage);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function markdownToHtml(markdown, page) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let inCode = false;
  let code = [];
  let list = null;
  let table = null;
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inlineMd(para.join(' '), page)}</p>`);
    para = [];
  };
  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };
  const flushTable = () => {
    if (!table) return;
    const head = table.headers.map((cell) => `<th>${inlineMd(cell, page)}</th>`).join('');
    const rows = table.rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMd(cell, page)}</td>`).join('')}</tr>`).join('\n');
    out.push(`<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`);
    table = null;
  };
  const flushCode = () => {
    out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
  };

  for (const line of lines) {
    const fence = line.match(/^```/);
    if (fence) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushPara();
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    if (!line.trim()) {
      flushPara();
      closeList();
      flushTable();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushPara();
      closeList();
      flushTable();
      const level = heading[1].length;
      const text = heading[2].replace(/\s+#+$/, '');
      const id = slugify(text);
      if (level <= 2) toc.push({ id, text, level });
      out.push(`<h${level} id="${id}">${inlineMd(text, page)}</h${level}>`);
      continue;
    }

    const item = line.match(/^([-*]|\d+\.)\s+(.+)$/);
    if (item) {
      flushPara();
      flushTable();
      const listTag = item[1].endsWith('.') ? 'ol' : 'ul';
      if (list && list !== listTag) closeList();
      if (!list) {
        out.push(`<${listTag}>`);
        list = listTag;
      }
      out.push(`<li>${inlineMd(item[2], page)}</li>`);
      continue;
    }

    if (line.trim().startsWith('|')) {
      flushPara();
      closeList();
      const cells = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim());
      const isSeparator = cells.every((cell) => /^:?-{3,}:?$/.test(cell));
      if (isSeparator) continue;
      if (!table) table = { headers: cells, rows: [] };
      else table.rows.push(cells);
      continue;
    }

    flushTable();
    para.push(line.trim());
  }
  flushPara();
  closeList();
  flushTable();
  return { html: out.join('\n'), toc };
}

function sidebar(activeSlug) {
  const groups = [...new Set(pages.map((p) => p.group))];
  return groups
    .map((group) => {
      const links = pages
        .filter((p) => p.group === group)
        .map((p) => {
          return `<a class="${p.slug === activeSlug ? 'active' : ''}" href="${outputHref(p)}">${p.title}</a>`;
        })
        .join('');
      return `<section><h2>${group}</h2>${links}</section>`;
    })
    .join('');
}

function shell(page, body, toc) {
  const tocLinks = toc
    .filter((t) => t.level === 2)
    .map((t) => `<a href="#${t.id}">${escapeHtml(t.text)}</a>`)
    .join('');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#05070b" />
    <title>${page.title} · Neon Pilot Docs</title>
    <link rel="icon" href="../mark.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="../styles.css" />
  </head>
  <body class="docs-body">
    <header>
      <a class="brand" href="../"><span class="brand-mark"><img src="../mark.svg" alt="" /></span><span>Neon Pilot</span></a>
      <nav aria-label="Primary"><a href="../#overview">Overview</a><a href="./">Docs</a><a href="../extensions.html">Extensions</a><a href="https://github.com/patleeman/neon-pilot">GitHub ↗</a></nav>
      <a class="nav-cta" href="https://github.com/patleeman/neon-pilot/releases/latest">Download</a>
    </header>
    <main class="docs-layout">
      <aside class="docs-sidebar"><h1>Docs</h1>${sidebar(page.slug)}</aside>
      <article class="docs-content">${body}<p class="edit-link"><a href="${repoUrl}/${page.sourcePath}">Edit this page on GitHub →</a></p></article>
      <aside class="docs-toc"><h2>On this page</h2>${tocLinks || '<span>Overview</span>'}</aside>
    </main>
  </body>
</html>
`;
}

await mkdir(outRoot, { recursive: true });
for (const entry of await readdir(outRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.html')) {
    await unlink(path.join(outRoot, entry.name));
  }
}

const pageSources = await Promise.all(
  (await collectMarkdownFiles(docsPublicRoot)).map(async (absolutePath) => {
    const publicPath = path.relative(docsPublicRoot, absolutePath).split(path.sep).join('/');
    const sourcePath = path.relative(root, absolutePath).split(path.sep).join('/');
    const markdown = await readFile(absolutePath, 'utf8');
    const slug = slugFromPublicPath(publicPath);
    return {
      absolutePath,
      publicPath,
      sourcePath,
      slug,
      title: firstHeading(markdown, slug),
      group: groupFromPublicPath(publicPath),
      markdown,
    };
  }),
);
pages = pageSources.sort((a, b) => a.publicPath.localeCompare(b.publicPath));
pagesByPublicPath = new Map(pages.map((page) => [page.publicPath, page]));
pagesByBasename = new Map(
  pages.flatMap((page) => {
    const basename = path.posix.basename(page.publicPath);
    return [
      [basename, page],
      [stripOrderPrefix(basename), page],
    ];
  }),
);

for (const page of pages) {
  const { html, toc } = markdownToHtml(page.markdown, page);
  const output = await prettier.format(shell(page, html, toc), prettierOptions);
  await writeFile(path.join(outRoot, page.slug === 'index' ? 'index.html' : `${page.slug}.html`), output);
}
console.log(`Built ${pages.length} docs pages`);
