#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prettier from 'prettier';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const docsRoot = path.join(root, 'docs');
const outRoot = path.join(root, 'apps/site/docs');
const prettierOptions = { ...(await prettier.resolveConfig(path.join(root, 'apps/site/docs/index.html'))), parser: 'html' };

const pages = [
  { file: 'README.md', slug: 'index', title: 'Overview', group: 'Start here' },
  { file: 'getting-started.md', slug: 'getting-started', title: 'Getting Started', group: 'Start here' },
  { file: 'desktop-app.md', slug: 'desktop-app', title: 'Desktop App', group: 'Product' },
  { file: 'views.md', slug: 'views', title: 'Views', group: 'Product' },
  { file: 'conversation-context.md', slug: 'conversation-context', title: 'Conversation Context', group: 'Product' },
  { file: 'knowledge-base.md', slug: 'knowledge-base', title: 'Knowledge Base', group: 'Product' },
  { file: 'build-an-extension.md', slug: 'build-an-extension', title: 'Build an Extension', group: 'Extensions' },
  { file: 'extensions.md', slug: 'extensions', title: 'Extension Authoring', group: 'Extensions' },
  { file: 'configuration.md', slug: 'configuration', title: 'Configuration', group: 'Runtime' },
  { file: 'daemon.md', slug: 'daemon', title: 'Daemon', group: 'Runtime' },
  { file: 'telemetry.md', slug: 'telemetry', title: 'Telemetry', group: 'Runtime' },
  { file: 'development.md', slug: 'development', title: 'Development', group: 'Developers' },
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function inlineMd(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, href) => `<a href="${rewriteHref(href)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function rewriteHref(href) {
  if (/^(https?:|#)/.test(href)) return href;
  const clean = href.replace(/^\.\//, '');
  const page = pages.find((p) => p.file === clean || p.file === clean.replace(/^docs\//, ''));
  if (page) return page.slug === 'index' ? './' : `./${page.slug}.html`;
  return `https://github.com/patleeman/neon-pilot/blob/main/${href.replace(/^\.\//, '')}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const toc = [];
  let inCode = false;
  let code = [];
  let list = false;
  let para = [];

  const flushPara = () => {
    if (!para.length) return;
    out.push(`<p>${inlineMd(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (!list) return;
    out.push('</ul>');
    list = false;
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
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length;
      const text = heading[2].replace(/\s+#+$/, '');
      const id = slugify(text);
      if (level <= 2) toc.push({ id, text, level });
      out.push(`<h${level} id="${id}">${inlineMd(text)}</h${level}>`);
      continue;
    }

    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      flushPara();
      if (!list) {
        out.push('<ul>');
        list = true;
      }
      out.push(`<li>${inlineMd(item[1])}</li>`);
      continue;
    }

    para.push(line.trim());
  }
  flushPara();
  closeList();
  return { html: out.join('\n'), toc };
}

function sidebar(activeSlug) {
  const groups = [...new Set(pages.map((p) => p.group))];
  return groups
    .map((group) => {
      const links = pages
        .filter((p) => p.group === group)
        .map((p) => {
          const href = p.slug === 'index' ? './' : `./${p.slug}.html`;
          return `<a class="${p.slug === activeSlug ? 'active' : ''}" href="${href}">${p.title}</a>`;
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
      <nav aria-label="Primary"><a href="../#overview">Overview</a><a href="./">Docs</a><a href="../#extensions">Extensions</a><a href="https://github.com/patleeman/neon-pilot">GitHub ↗</a></nav>
      <a class="nav-cta" href="https://github.com/patleeman/neon-pilot/releases/latest">Download</a>
    </header>
    <main class="docs-layout">
      <aside class="docs-sidebar"><h1>Docs</h1>${sidebar(page.slug)}</aside>
      <article class="docs-content">${body}<p class="edit-link"><a href="https://github.com/patleeman/neon-pilot/blob/main/docs/${page.file}">Edit this page on GitHub →</a></p></article>
      <aside class="docs-toc"><h2>On this page</h2>${tocLinks || '<span>Overview</span>'}</aside>
    </main>
  </body>
</html>
`;
}

await mkdir(outRoot, { recursive: true });
for (const page of pages) {
  const markdown = await readFile(path.join(docsRoot, page.file), 'utf8');
  const { html, toc } = markdownToHtml(markdown);
  const output = await prettier.format(shell(page, html, toc), prettierOptions);
  await writeFile(path.join(outRoot, page.slug === 'index' ? 'index.html' : `${page.slug}.html`), output);
}
console.log(`Built ${pages.length} docs pages`);
