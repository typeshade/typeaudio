import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { marked } from 'marked';
const out = 'website/dist';
const names = ['vision', 'architecture', 'experiments', 'compiler-asks'];
const source = 'https://github.com/typeshade/typeaudio/blob/main/docs/';
const escape = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const index = await readFile(`${out}/index.html`, 'utf8');
const css = index.match(/<link[^>]+rel="stylesheet"[^>]*>/g)?.join('\n') ?? '';
const nav = names.map(n => `<a href="/docs/${n}/">${n.replaceAll('-', ' ')}</a>`).join('');
const urls = ['https://audio.typeshade.dev/'];
for (const name of names) {
  const markdown = await readFile(`docs/${name}.md`, 'utf8');
  let body = await marked.parse(markdown);
  body = body.replace(/href="([^"#][^"]*)"/g, (match: string, href: string) => {
    if (/^(https?:|mailto:|\/)/.test(href)) return match;
    const [file, anchor] = href.split('#');
    const target = file!.replace(/^\.\//, '').replace(/\.md$/, '');
    const url = names.includes(target) ? `/docs/${target}/${anchor ? '#' + anchor : ''}` : new URL(href, source).href;
    return `href="${escape(url)}"`;
  });
  const seen = new Map<string, number>();
  body = body.replace(/<h([1-6])>(.*?)<\/h\1>/g, (_, level: string, title: string) => {
    const slug = title.replace(/<[^>]*>/g,'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,'').trim().replace(/\s/g,'-');
    const count = seen.get(slug) ?? 0; seen.set(slug, count + 1);
    return `<h${level} id="${slug}${count ? '-' + count : ''}">${title}</h${level}>`;
  });
  await mkdir(`${out}/docs/${name}`, { recursive: true });
  await writeFile(`${out}/docs/${name}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · TypeAudio</title><meta name="description" content="TypeAudio ${name} documentation."><link rel="icon" href="/icon.png"><link rel="canonical" href="https://audio.typeshade.dev/docs/${name}/">${css}</head><body><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/">TypeAudio</a><nav><a href="/#playground">Playground</a><a href="${source}${name}.md">Source →</a></nav></header><main id="main"><article class="doc"><nav class="doc-nav">${nav}</nav>${body}</article></main><footer><a href="/">← TypeAudio</a><a href="https://github.com/typeshade/typeaudio">GitHub →</a></footer></body></html>`);
  urls.push(`https://audio.typeshade.dev/docs/${name}/`);
}
await copyFile('website/style.css', `${out}/style.css`);
await writeFile(`${out}/404.html`, '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found · TypeAudio</title><link rel="stylesheet" href="/style.css"><main class="doc"><h1>Page not found.</h1><p><a href="/">Return to TypeAudio</a></p></main></html>');
await writeFile(`${out}/robots.txt`, 'User-agent: *\nAllow: /\nSitemap: https://audio.typeshade.dev/sitemap.xml\n');
await writeFile(`${out}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`);
console.log(`Built ${names.length} documentation pages, sitemap, and 404 page.`);
