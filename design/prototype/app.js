/* Genie prototype: core (helpers, shell, router, composer, chat, compare). Static and dependency free. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, c = '') => `<svg class="ic ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const modelOf = (id) => MODELS.find((m) => m.id === id) || MODELS[0];
const wsOf = (id) => WORKSPACES.find((w) => w.id === id);
const enabledModels = () => MODELS.filter((m) => m.enabled);
const mq = (q) => window.matchMedia(q).matches;
const isDesktop = () => mq('(min-width: 1024px)');

const S = {
  isAdmin: true,
  modelId: SETTINGS.defaultModelId,
  think: false,
  composer: { text: '', files: [], wsId: null, tplId: null },
  used: 12,
  offline: false,
  sessions: SESSIONS,
  cmpModels: ['sonnet', 'gpt', 'nova'],
  run: null,
  sidebar: null,
  current: null,
  stick: true,
};
const Genie = { render: {}, auth: null, afterRoute: [] };

/* ---------- Live region, toasts, theme ---------- */
function announce(t) { const l = $('#live'); l.textContent = ''; setTimeout(() => (l.textContent = t), 60); }
function toast(text, o = {}) {
  const t = document.createElement('div');
  t.className = 'toast' + (o.bad ? ' bad' : '');
  t.setAttribute('role', o.bad ? 'alert' : 'status');
  t.innerHTML = `${ic(o.bad ? 'warning-circle' : 'check-circle')}<span>${esc(text)}</span>${o.action ? `<button class="btn" type="button">${esc(o.action)}</button>` : ''}<button class="btn icon sm" type="button" aria-label="Dismiss">${ic('x', 'sm')}</button>`;
  const close = () => { t.classList.add('out'); setTimeout(() => t.remove(), 220); };
  t.querySelector('[aria-label="Dismiss"]').onclick = close;
  if (o.action) t.querySelector('.btn').onclick = () => { o.onAction && o.onAction(); close(); };
  $('#toasts').append(t);
  if (!o.bad) { let timer = setTimeout(close, 6000); t.onmouseenter = () => clearTimeout(timer); t.onmouseleave = () => (timer = setTimeout(close, 3000)); t.onfocusin = () => clearTimeout(timer); }
}
function setTheme(t) {
  const r = document.documentElement; r.classList.remove('dark', 'light'); if (t) r.classList.add(t);
  try { t ? localStorage.setItem('genie-theme', t) : localStorage.removeItem('genie-theme'); } catch (e) { /* storage unavailable */ }
  $$('[data-theme-toggle]').forEach((b) => b.querySelector('use').setAttribute('href', isDark() ? '#i-sun' : '#i-moon'));
}
const isDark = () => document.documentElement.classList.contains('dark') || (!document.documentElement.classList.contains('light') && mq('(prefers-color-scheme: dark)'));
const themeSetting = () => (document.documentElement.classList.contains('dark') ? 'dark' : document.documentElement.classList.contains('light') ? 'light' : 'system');

/* ---------- Popovers ---------- */
function closePops() { $$('[popover]').forEach((p) => { try { p.hidePopover(); } catch (e) { /* already closed */ } }); }
function pop(anchor, html, o = {}) {
  closePops();
  const p = document.createElement('div');
  p.className = 'pop ' + (o.cls || ''); p.setAttribute('popover', 'auto'); p.setAttribute('role', 'region'); p.setAttribute('aria-label', o.label || 'Options');
  p.innerHTML = html; document.body.append(p); p.showPopover();
  if (!mq('(max-width: 639px)')) {
    const r = anchor.getBoundingClientRect(), pr = p.getBoundingClientRect();
    const up = innerHeight - r.bottom < pr.height + 16 && r.top > innerHeight - r.bottom;
    let left = o.align === 'end' ? r.right - pr.width : r.left; left = Math.max(8, Math.min(left, innerWidth - pr.width - 8));
    let top = up ? Math.max(8, r.top - pr.height - 6) : Math.min(r.bottom + 6, innerHeight - pr.height - 8);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    p.style.setProperty('--origin', `${up ? 'bottom' : 'top'} ${o.align === 'end' ? 'right' : 'left'}`);
  }
  anchor.setAttribute('aria-expanded', 'true');
  const items = () => $$('[role=menuitem]:not([aria-disabled=true]),[role=option]:not([aria-disabled=true]),[role=menuitemradio]', p);
  p.addEventListener('keydown', (e) => {
    const it = items(), i = it.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); it[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); it[it.length - 1]?.focus(); }
    else if (e.key === 'Tab' && !o.keepOpen) p.hidePopover();
  });
  p.addEventListener('toggle', (e) => { if (e.newState === 'closed') { anchor.setAttribute('aria-expanded', 'false'); p.remove(); if (document.activeElement === document.body && anchor.isConnected) anchor.focus(); } });
  const first = p.querySelector('[aria-selected=true]') || items()[0] || p.querySelector('input,button');
  first && first.focus({ preventScroll: true });
  return p;
}
function menu(anchor, items, o = {}) {
  const html = items.map((it, i) => it === '-' ? '<div class="menu-sep" role="separator"></div>' : it.label && !it.run ? `<div class="menu-label" role="presentation">${esc(it.label)}</div>`
    : `<button class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" type="button" data-i="${i}" ${it.disabled ? 'aria-disabled="true"' : ''}>${it.icon ? ic(it.icon) : ''}<span>${esc(it.label)}</span></button>`).join('');
  const p = pop(anchor, `<div role="menu" aria-label="${esc(o.label || 'Menu')}">${html}</div>`, { label: o.label, align: o.align });
  p.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b || b.getAttribute('aria-disabled') === 'true') return; p.hidePopover(); items[b.dataset.i].run(); });
  return p;
}

/* ---------- Dialogs ---------- */
function dialog({ title, body = '', confirm = 'Save', cancel = 'Cancel', danger = false, wide = false, noFoot = false, onOpen, onSubmit }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog'); d.setAttribute('aria-labelledby', 'dlg-t'); if (wide) d.className = 'wide';
    d.innerHTML = `<form method="dialog"><div class="dlg-body"><h2 id="dlg-t">${esc(title)}</h2>${body}</div>
      <div class="dlg-foot"><button class="btn" value="cancel" formnovalidate ${danger ? 'autofocus' : ''}>${noFoot ? 'Close' : esc(cancel)}</button>${noFoot ? '' : `<button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${esc(confirm)}</button>`}</div></form>`;
    document.body.append(d);
    d.addEventListener('submit', (e) => { if (e.submitter && e.submitter.value === 'ok' && onSubmit && onSubmit(d) === false) e.preventDefault(); });
    d.addEventListener('close', () => { const ok = d.returnValue === 'ok'; d.remove(); resolve(ok); });
    d.showModal(); onOpen && onOpen(d);
  });
}
const confirmDlg = (title, text, label, danger = true) => dialog({ title, body: `<p>${text}</p>`, confirm: label, danger });

/* ---------- Markdown (small subset, enough for the demo) ---------- */
function inline(s, cites) {
  s = esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  if (cites) s = s.replace(/\[(\d+)\]/g, (m, n) => (cites[n - 1] ? `<button type="button" class="cite" data-cite="${n}" aria-label="Source ${n}: ${esc(cites[n - 1].title)}">${n}</button>` : m));
  return s;
}
function highlight(code, lang) {
  let h = esc(code);
  if (lang === 'excel') h = h.replace(/(&quot;.*?&quot;)|(\b[A-Z][A-Z0-9.]+(?=\())|(\b\d+(?:\.\d+)?\b)/g, (m, s, f, n) => (s ? `<span class="tk-s">${s}</span>` : f ? `<span class="tk-k">${f}</span>` : `<span class="tk-n">${n}</span>`));
  return h;
}
function md(src, cites) {
  const L = src.split('\n'); let out = '', i = 0;
  const special = (l) => /^(#{2,3} |- |\d+\. |```|\|)/.test(l);
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) { const lang = l.slice(3).trim() || 'text', buf = []; i++; while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]); i++;
      out += `<div class="codeblock"><header><span>${esc(lang)}</span><button class="btn ghost sm" type="button" data-copy-code>${ic('copy', 'sm')}Copy code</button></header><pre tabindex="0"><code>${highlight(buf.join('\n'), lang)}</code></pre></div>`; continue; }
    if (/^### /.test(l)) { out += `<h3>${inline(l.slice(4), cites)}</h3>`; i++; continue; }
    if (/^## /.test(l)) { out += `<h2>${inline(l.slice(3), cites)}</h2>`; i++; continue; }
    if (/^\|/.test(l) && /^\|[\s:|-]+\|?\s*$/.test(L[i + 1] || '')) {
      const cells = (r) => r.replace(/^\||\|\s*$/g, '').split('|').map((c) => c.trim());
      const head = cells(l); i += 2; const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(cells(L[i++]));
      out += `<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; continue; }
    if (/^- /.test(l)) { const it = []; while (i < L.length && /^- /.test(L[i])) it.push(L[i++].slice(2)); out += `<ul>${it.map((x) => `<li>${inline(x, cites)}</li>`).join('')}</ul>`; continue; }
    if (/^\d+\. /.test(l)) { const it = []; while (i < L.length && /^\d+\. /.test(L[i])) it.push(L[i++].replace(/^\d+\. /, '')); out += `<ol>${it.map((x) => `<li>${inline(x, cites)}</li>`).join('')}</ol>`; continue; }
    if (!l.trim()) { i++; continue; }
    const p = []; while (i < L.length && L[i].trim() && !special(L[i])) p.push(L[i++]); out += `<p>${inline(p.join(' '), cites)}</p>`;
  }
  return out;
}

/* ---------- Tables (div grid with table roles so they stack on phones) ---------- */
function table({ label, cols, head, rows }) {
  return `<div class="t" role="table" aria-label="${esc(label)}"><div class="t-head" role="row" style="--cols:${cols}">${head.map((h) => `<div role="columnheader">${h ? esc(h) : '<span class="vh">Actions</span>'}</div>`).join('')}</div>
  ${rows.map((r) => `<div class="t-row ${r.cls || ''}" role="row" style="--cols:${cols}" ${r.attrs || ''}>${r.cells.map((c, i) => `<div class="t-cell ${i === 0 ? 'first' : ''} ${(r.cellCls || [])[i] || ''}" role="cell" ${head[i] ? `data-label="${esc(head[i])}"` : ''}>${c}</div>`).join('')}</div>`).join('')}</div>`;
}

/* ---------- Model picker ---------- */
function capLine(m) {
  const base = m.vision && m.docs ? `${ic('image')}Reads images and documents` : `${ic('file-text')}Reads documents as plain text, no images`;
  return `<span class="opt-cap">${base}</span>${m.think ? `<span class="opt-cap">${ic('brain')}Can think harder</span>` : ''}`;
}
function openModelPicker(anchor, o = {}) {
  const imgs = (o.files || []).some((f) => f.type === 'img');
  const list = enabledModels().filter((m) => !(o.exclude || []).includes(m.id));
  const html = `<div role="listbox" aria-label="${o.label || 'Choose a model'}">` + PROVIDER_ORDER.map((pv) => {
    const ms = list.filter((m) => m.provider === pv); if (!ms.length) return '';
    return `<div role="group" aria-labelledby="pg-${pv.replace(/\W/g, '')}"><div class="pop-head" id="pg-${pv.replace(/\W/g, '')}">${esc(pv)}</div>` + ms.map((m) => {
      const blocked = imgs && !m.vision;
      return `<button class="opt" role="option" type="button" data-id="${m.id}" aria-selected="${o.selected === m.id}" ${blocked ? 'aria-disabled="true"' : ''}>
        <span class="opt-main"><span class="opt-name">${esc(m.label)}${m.id === SETTINGS.defaultModelId ? '<span class="badge accent">Default</span>' : ''}</span>
        <span class="opt-desc">${esc(m.desc)}</span>${blocked ? '<span class="opt-cap" style="color:var(--color-danger)">Can’t see the image you attached</span>' : capLine(m)}</span>${ic('check')}</button>`;
    }).join('') + '</div>';
  }).join('') + '</div>';
  const p = pop(anchor, html, { cls: 'wide', align: o.align });
  p.addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b || b.getAttribute('aria-disabled') === 'true') return; p.hidePopover(); o.onPick(b.dataset.id); });
}

/* ---------- Composer ---------- */
const DOC_EXT = ['pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'], IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
function limitReached() { return SETTINGS.dailyMessageLimit > 0 && S.used >= SETTINGS.dailyMessageLimit; }
function composerHTML(key) {
  const dis = limitReached();
  return `<form class="composer" data-key="${key}" novalidate>
    <div class="chips" data-chips hidden></div>
    <div class="composer-warn" data-warn hidden></div>
    <label class="vh" for="cx-${key}">Message</label>
    <textarea id="cx-${key}" rows="1" placeholder="${dis ? 'You’ve reached today’s limit' : 'Ask anything, or drop in a file'}" ${dis ? 'disabled' : ''}></textarea>
    <div class="composer-bar">
      <button type="button" class="btn ghost sm icon tool" data-act="attach" aria-haspopup="menu" aria-expanded="false" aria-label="Attach a file" ${dis ? 'disabled' : ''}>${ic('paperclip')}<span class="lbl">Attach</span></button>
      <button type="button" class="btn ghost sm icon tool" data-act="workspace" aria-haspopup="listbox" aria-expanded="false" aria-label="Choose a workspace" ${dis ? 'disabled' : ''}>${ic('books')}<span class="lbl">Workspace</span></button>
      <button type="button" class="btn ghost sm icon tool" data-act="think" aria-pressed="false" aria-label="Think harder" data-tip="Slower, but better on tricky questions" data-tip-up hidden>${ic('brain')}<span class="lbl">Think harder</span></button>
      <span class="spacer"></span>
      <button type="button" class="btn ghost sm model-btn" data-act="model" aria-haspopup="listbox" aria-expanded="false" ${dis ? 'disabled' : ''}><span class="nm"></span>${ic('caret-down', 'sm')}</button>
      <button type="submit" class="send" aria-label="Send message" disabled>${ic('arrow-up')}</button>
    </div>
    <input type="file" hidden multiple data-input="doc" accept=".pdf,.csv,.doc,.docx,.xls,.xlsx,.html,.txt,.md">
    <input type="file" hidden multiple data-input="img" accept=".png,.jpg,.jpeg,.gif,.webp">
  </form>`;
}
function chipHTML(c) {
  if (c.kind === 'ws') return `<span class="chip ws">${ic('books', 'sm')}<span class="nm">Workspace: ${esc(c.name)}</span><button type="button" class="x" data-rm="ws" aria-label="Stop using workspace ${esc(c.name)}">${ic('x', 'sm')}</button></span>`;
  if (c.kind === 'tpl') return `<span class="chip chip-tpl">${ic('file-text', 'sm')}<span class="nm">Template: ${esc(c.name)}</span><button type="button" class="x" data-rm="tpl" aria-label="Remove template ${esc(c.name)}">${ic('x', 'sm')}</button></span>`;
  return `<span class="chip">${c.type === 'img' ? `<span class="thumb">${ic('image', 'sm')}</span>` : ic('file-pdf', 'sm')}<span class="nm">${esc(c.name)}</span><span class="sz">${esc(c.size)}</span><button type="button" class="x" data-rm="${esc(c.name)}" aria-label="Remove ${esc(c.name)}">${ic('x', 'sm')}</button></span>`;
}
function composerWarn() {
  const m = modelOf(S.modelId), f = S.composer.files;
  const img = f.find((x) => x.type === 'img'), sheet = f.find((x) => /\.xlsx?$/i.test(x.name)), doc = f.find((x) => x.type !== 'img');
  if (img && !m.vision) return { bad: true, html: `<b>${esc(m.label)} can’t see images.</b> ${esc(img.name)} won’t be sent to it. <button type="button" class="btn link" data-act="switch-vision">Switch to a model that can</button> or remove the image.` };
  if (sheet && !m.docs) return { bad: true, html: `<b>${esc(m.label)} can’t read spreadsheets.</b> Save ${esc(sheet.name)} as a CSV file, or <button type="button" class="btn link" data-act="switch-vision">switch to a model that reads documents</button>.` };
  if (doc && !m.docs) return { bad: false, html: `${esc(m.label)} reads documents as plain text. Tables, layout and pictures inside ${esc(doc.name)} may be lost.` };
  return null;
}
function syncComposers() {
  const m = modelOf(S.modelId), warn = composerWarn(), dis = limitReached();
  if (!m.think) S.think = false;
  $$('.composer[data-key]').forEach((f) => {
    const chips = [];
    if (S.composer.tplId) chips.push({ kind: 'tpl', name: TEMPLATES.find((t) => t.id === S.composer.tplId).title });
    if (S.composer.wsId) chips.push({ kind: 'ws', name: wsOf(S.composer.wsId).name });
    const all = chips.concat(S.composer.files);
    const ch = $('[data-chips]', f); ch.hidden = !all.length; ch.innerHTML = all.map(chipHTML).join('');
    const w = $('[data-warn]', f); w.hidden = !warn; w.innerHTML = warn ? `<div class="banner ${warn.bad ? 'bad' : ''}">${ic(warn.bad ? 'warning-circle' : 'info')}<div>${warn.html}</div></div>` : '';
    $('.model-btn .nm', f).textContent = m.label;
    const tb = $('[data-act=think]', f); tb.hidden = !m.think; tb.setAttribute('aria-pressed', S.think);
    const ta = $('textarea', f); if (document.activeElement !== ta && ta.value !== S.composer.text) { ta.value = S.composer.text; autosize(ta); }
    const send = $('.send', f);
    if (S.run) { send.disabled = false; send.classList.add('stop'); send.setAttribute('aria-label', 'Stop writing'); send.innerHTML = ic('stop-fill'); send.type = 'button'; }
    else { send.classList.remove('stop'); send.setAttribute('aria-label', 'Send message'); send.innerHTML = ic('arrow-up'); send.type = 'submit'; send.disabled = dis || !S.composer.text.trim() || !!(warn && warn.bad); }
  });
}
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 220) + 'px'; }
function addFiles(list) {
  const docs = S.composer.files.filter((f) => f.type !== 'img').length, imgs = S.composer.files.filter((f) => f.type === 'img').length;
  let d = docs, im = imgs;
  [...list].forEach((f) => {
    const ext = (f.name.split('.').pop() || '').toLowerCase(), isImg = IMG_EXT.includes(ext);
    if (!isImg && !DOC_EXT.includes(ext)) return toast(`Genie can’t read .${ext} files. Use PDF, Word, Excel, CSV, HTML, text, Markdown, or an image.`, { bad: true });
    if (isImg && f.size > 3.75e6) return toast(`${f.name} is too large. Images can be up to 3.75 MB.`, { bad: true });
    if (!isImg && f.size > 4.5e6) return toast(`${f.name} is too large. Documents can be up to 4.5 MB. For bigger files, add them to a workspace.`, { bad: true });
    if (isImg ? im >= 20 : d >= 5) return toast(isImg ? 'You can attach up to 20 images to one message.' : 'You can attach up to 5 documents to one message.', { bad: true });
    isImg ? im++ : d++;
    S.composer.files.push({ name: f.name, type: isImg ? 'img' : ext === 'pdf' ? 'pdf' : 'doc', size: fmtSize(f.size) });
  });
  syncComposers();
}
function openAttach(btn) {
  const m = modelOf(S.modelId);
  const html = `<div role="menu" aria-label="Attach">
    <button class="menu-item" role="menuitem" type="button" data-pick="doc">${ic('file-pdf')}<span><b style="font-weight:500">Upload a document</b><br><span class="small muted">PDF, Word, Excel, CSV, text. Up to 4.5 MB each.${m.docs ? '' : ' ' + esc(m.label) + ' reads these as plain text.'}</span></span></button>
    <button class="menu-item" role="menuitem" type="button" data-pick="img" ${m.vision ? '' : 'aria-disabled="true"'}>${ic('image')}<span><b style="font-weight:500">Upload an image</b><br><span class="small muted">${m.vision ? 'PNG, JPEG, GIF or WebP. Up to 3.75 MB each.' : esc(m.label) + ' can’t see images.'}</span></span></button>
    ${m.vision ? '' : `<button class="menu-item" role="menuitem" type="button" data-pick="switch">${ic('arrow-clockwise')}<span>Switch to a model that can see images</span></button>`}
    <div class="attach-hint">Up to 5 documents and 20 images per message. Larger files belong in a workspace.</div></div>`;
  const p = pop(btn, html, { label: 'Attach' });
  p.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]'); if (!b || b.getAttribute('aria-disabled') === 'true') return; p.hidePopover();
    if (b.dataset.pick === 'switch') return pickVisionModel(); $(`[data-input=${b.dataset.pick}]`, btn.closest('form')).click();
  });
}
function pickVisionModel() { const v = enabledModels().find((m) => m.vision && m.docs); S.modelId = v.id; syncComposers(); toast(`Switched to ${v.label}, which can see images.`); }
function openWorkspacePicker(btn) {
  const html = `<div role="listbox" aria-label="Workspace"><button class="opt" role="option" type="button" data-id="" aria-selected="${!S.composer.wsId}"><span class="opt-main"><span class="opt-name">No workspace</span><span class="opt-desc">Answer from the model's own knowledge.</span></span>${ic('check')}</button>`
    + WORKSPACES.map((w) => `<button class="opt" role="option" type="button" data-id="${w.id}" aria-selected="${S.composer.wsId === w.id}"><span class="opt-main"><span class="opt-name">${esc(w.name)}<span class="badge ${w.vis === 'shared' ? 'accent' : ''}">${w.vis === 'shared' ? 'Shared' : 'Personal'}</span></span><span class="opt-desc">${w.docs} documents. Answers include sources.</span></span>${ic('check')}</button>`).join('')
    + `</div><div class="pop-foot"><a class="btn link" href="#/workspaces">Manage workspaces</a></div>`;
  const p = pop(btn, html, { cls: 'wide' });
  p.addEventListener('click', (e) => { const b = e.target.closest('.opt'); if (!b) return; p.hidePopover(); S.composer.wsId = b.dataset.id || null; syncComposers(); });
}
function bindComposer(f, onSend) {
  const ta = $('textarea', f);
  ta.addEventListener('input', () => { S.composer.text = ta.value; autosize(ta); syncComposers(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!$('.send', f).disabled && !S.run) onSend(); } });
  f.addEventListener('submit', (e) => { e.preventDefault(); if (!S.run && !$('.send', f).disabled) onSend(); });
  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act],[data-rm]'); if (!b) return;
    const a = b.dataset.act;
    if (b.dataset.rm) { const r = b.dataset.rm; if (r === 'ws') S.composer.wsId = null; else if (r === 'tpl') { S.composer.tplId = null; } else S.composer.files = S.composer.files.filter((x) => x.name !== r); syncComposers(); ta.focus(); }
    else if (a === 'send-stop') stopRun();
    else if (a === 'attach') openAttach(b);
    else if (a === 'workspace') openWorkspacePicker(b);
    else if (a === 'think') { S.think = !S.think; syncComposers(); }
    else if (a === 'model') openModelPicker(b, { selected: S.modelId, files: S.composer.files, align: 'end', onPick: (id) => { S.modelId = id; syncComposers(); ta.focus(); } });
    else if (a === 'switch-vision') pickVisionModel();
    if (b.classList.contains('send') && S.run) stopRun();
  });
  $('.send', f).addEventListener('click', () => { if (S.run) stopRun(); });
  $$('input[type=file]', f).forEach((i) => i.addEventListener('change', () => { addFiles(i.files); i.value = ''; }));
  ['dragenter', 'dragover'].forEach((ev) => f.addEventListener(ev, (e) => { e.preventDefault(); f.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => f.addEventListener(ev, (e) => { e.preventDefault(); f.classList.remove('drag'); if (ev === 'drop' && e.dataTransfer) addFiles(e.dataTransfer.files); }));
}

/* ---------- Home ---------- */
Genie.render.home = () => {
  const v = $('[data-view=home]');
  const sug = TEMPLATES.filter((t) => t.enabled).slice(0, 4);
  v.innerHTML = `<div class="home"><div class="home-inner">
    <h1 id="home-title" tabindex="-1">${esc(SETTINGS.welcomeTitle)}</h1>
    <p class="welcome">${esc(SETTINGS.welcomeMessage)}</p>
    <div data-slot="composer"></div>
    <div class="suggest" role="group" aria-label="Start from a template">${sug.map((t) => `<button type="button" class="btn" data-tpl="${t.id}">${esc(t.title)}</button>`).join('')}<a class="btn link" href="#/templates" style="margin-left:6px">More templates</a></div>
    ${SETTINGS.disclaimer ? `<p class="disclaimer">${esc(SETTINGS.disclaimer)}</p>` : ''}
    ${limitReached() ? `<div class="banner warn" style="margin-top:16px" role="status">${ic('warning')}<div><b>You’ve reached today’s limit of ${SETTINGS.dailyMessageLimit} messages.</b> It starts over tomorrow morning. Ask your administrator if you need more.</div></div>` : ''}
  </div></div>`;
  const slot = $('[data-slot=composer]', v); slot.innerHTML = composerHTML('home');
  const f = $('form', slot); bindComposer(f, () => sendMessage('home'));
  $$('[data-tpl]', v).forEach((b) => b.addEventListener('click', () => useTemplate(b.dataset.tpl)));
  syncComposers();
};
function useTemplate(id) {
  const t = TEMPLATES.find((x) => x.id === id);
  S.composer.tplId = id; S.composer.text = t.starter;
  if (location.hash === '#/home') Genie.route(); else location.hash = '#/home';
  setTimeout(() => { const ta = $('[data-view=home] textarea'); if (ta) { ta.focus(); autosize(ta); const i = t.starter.indexOf('['); i >= 0 ? ta.setSelectionRange(i, t.starter.indexOf(']', i) + 1) : ta.setSelectionRange(ta.value.length, ta.value.length); } }, 60);
}

/* ---------- Chat ---------- */
function turnUserHTML(m) {
  return `<div class="turn turn-user"><div class="bubble">${esc(m.text)}</div>${m.attach && m.attach.length ? `<div class="chips" aria-label="Attachments">${m.attach.map((a) => `<span class="chip static">${a.type === 'img' ? `<span class="thumb">${ic('image', 'sm')}</span>` : ic('file-pdf', 'sm')}<span class="nm">${esc(a.name)}</span><span class="sz">${esc(a.size)}</span></span>`).join('')}</div>` : ''}</div>`;
}
function errHTML(code, mid) {
  const e = ERRORS[code], m = modelOf(mid), act = { retry: `<button class="btn sm" type="button" data-act="retry">${ic('arrow-clockwise', 'sm')}Try again</button>`, model: `<button class="btn sm" type="button" data-act="pick-model">Choose another model</button>` };
  return `<div class="err-block" role="alert"><div class="head">${ic('warning-circle')}<div>${esc(e.title(m.label))}<div style="font-weight:400;margin-top:2px">${esc(e.body)}</div></div></div><div class="row">${e.actions.map((a) => act[a]).join('')}</div></div>`;
}
function sourcesHTML(c) {
  return `<details class="sources"><summary>${ic('caret-right', 'sm')}Sources (${c.length})</summary><ol>${c.map((x, i) => `<li id="src-${i + 1}" tabindex="-1"><span class="n">${i + 1}</span><span><b>${esc(x.title)}</b><q>${esc(x.snippet)}</q><span class="ws">${esc(x.ws)}</span></span></li>`).join('')}</ol></details>`;
}
function thinkHTML(t) { return `<details class="think"><summary>${ic('caret-right', 'sm car')}<span>Thought for ${t.secs}s</span></summary><div class="think-body">${esc(t.text)}</div></details>`; }
function actionsHTML() {
  return `<div class="msg-actions" role="group" aria-label="Response actions">
    <button class="btn ghost sm icon" type="button" data-act="copy" aria-label="Copy response" data-tip="Copy">${ic('copy')}</button>
    <button class="btn ghost sm icon" type="button" data-act="up" aria-pressed="false" aria-label="Good response" data-tip="Good response">${ic('thumbs-up')}</button>
    <button class="btn ghost sm icon" type="button" data-act="down" aria-pressed="false" aria-label="Bad response" data-tip="Bad response">${ic('thumbs-down')}</button>
    <button class="btn ghost sm icon" type="button" data-act="retry" aria-label="Try again" data-tip="Try again">${ic('arrow-clockwise')}</button></div>`;
}
function turnAssistantHTML(m, sess) {
  const mm = modelOf(m.model);
  return `<div class="turn turn-ai" data-model="${m.model}"><div class="who"><span>${esc(mm.label)}</span>${m.latency ? `<span class="meta">${esc(m.latency)}</span>` : ''}</div>
    ${m.think ? thinkHTML(m.think) : ''}${m.notice ? noticeHTML(m.notice) : ''}
    ${m.err ? errHTML(m.err, m.model) : `<div class="prose">${md(m.md, m.cites)}</div>${m.cites ? sourcesHTML(m.cites) : ''}${actionsHTML()}`}</div>`;
}
function noticeHTML(code) {
  const t = { HISTORY_TRIMMED: 'Earlier messages were shortened to fit this model’s limit. Genie kept the most recent ones.', ATTACHMENT_AS_TEXT: 'This model reads documents as plain text. Tables, layout and pictures in the file may be lost.' }[code];
  return `<div class="notice" role="status">${ic('info')}<span>${t}</span></div>`;
}
Genie.render.chat = (parts) => {
  const id = parts[1];
  let sess = S.sessions.find((s) => s.id === id);
  if (!sess) { location.hash = '#/404'; return; }
  S.current = sess;
  if (!sess.msgs) sess.msgs = [{ role: 'user', text: sess.title }, { role: 'assistant', model: sess.model, md: 'This is a saved sample chat in the prototype. Start a new chat to watch Genie answer.', latency: '2.0 s' }];
  if (sess.ws) S.composer.wsId = sess.ws;
  $('#chat-title').textContent = sess.title; $('#msgs').innerHTML = sess.msgs.map((m) => (m.role === 'user' ? turnUserHTML(m) : turnAssistantHTML(m, sess))).join('');
  $('#chat-dock').innerHTML = `${limitReached() ? `<div class="banner warn" role="status">${ic('warning')}<div><b>You’ve reached today’s limit of ${SETTINGS.dailyMessageLimit} messages.</b> It starts over tomorrow morning. You can still read your chats.</div></div>` : ''}<div data-slot="composer"></div>${SETTINGS.disclaimer ? `<p class="disclaimer" style="margin-top:0">${esc(SETTINGS.disclaimer)}</p>` : ''}`;
  $('[data-slot=composer]', $('#chat-dock')).innerHTML = composerHTML('chat');
  bindComposer($('#chat-dock form'), () => sendMessage('chat'));
  syncComposers();
  const sc = $('#chat-scroll'); sc.scrollTop = sc.scrollHeight; S.stick = true;
  if (sess.pendingRun) { const r = sess.pendingRun; delete sess.pendingRun; streamReply(sess, r); }
};
function updateTitle(sess) { $('#tb-title').innerHTML = `${esc(sess.title)}<small>${esc(modelOf(sess.model).label)}${sess.ws ? ', ' + esc(wsOf(sess.ws).name) : ''}</small>`; $('#chat-title').textContent = sess.title; }

function sendMessage(from) {
  const text = S.composer.text.trim(); if (!text) return;
  if (S.offline) return toast('You’re offline. Try again when the connection returns.', { bad: true });
  if (limitReached()) return;
  const req = { prompt: text, files: S.composer.files.slice(), ws: S.composer.wsId, tpl: S.composer.tplId, deep: S.think && modelOf(S.modelId).think, model: S.modelId };
  let sess = from === 'home' ? null : S.current;
  if (!sess) { sess = { id: 'n' + Date.now(), title: text.length > 60 ? text.slice(0, text.lastIndexOf(' ', 60) || 60) : text, group: 'Today', model: S.modelId, ws: req.ws, msgs: [], isNew: true }; S.sessions.unshift(sess); }
  sess.model = req.model; sess.msgs.push({ role: 'user', text, attach: req.files.map((f) => ({ ...f })) });
  S.composer = { text: '', files: [], wsId: S.composer.wsId, tplId: null };
  if (from === 'home') { sess.pendingRun = req; location.hash = '#/chat/' + sess.id; renderSidebar(); return; }
  const ms = $('#msgs'); ms.insertAdjacentHTML('beforeend', turnUserHTML(sess.msgs[sess.msgs.length - 1]));
  S.stick = true; syncComposers(); const ta = $('#chat-dock textarea'); ta.value = ''; autosize(ta); streamReply(sess, req);
}
function stopRun() { if (S.run) S.run.stopped = true; }

async function streamReply(sess, req, replace) {
  const m = modelOf(req.model), run = { stopped: false }; S.run = run; syncComposers();
  const ms = $('#msgs'), el = document.createElement('div'); el.className = 'turn turn-ai'; el.dataset.model = m.id;
  const wantThink = m.think; const word = req.deep ? 'Thinking' : wantThink ? 'Thinking' : 'Working';
  el.innerHTML = `<div class="who"><span>${esc(m.label)}</span></div><div class="status" data-status><span class="writing">${ic('circle-notch', 'sm spin')}<span data-word>${word}</span><span class="elapsed" data-el>0s</span></span></div>
    <details class="think" hidden><summary>${ic('caret-right', 'sm car')}<span data-ts>Thinking</span> <span class="elapsed" data-el2>0s</span></summary><div class="think-body" data-tb></div></details><div data-notes></div><div class="prose" aria-busy="true" data-prose></div><div data-after></div>`;
  if (replace) replace.replaceWith(el); else ms.append(el);
  const sc = $('#chat-scroll'), keep = () => { if (S.stick) sc.scrollTop = sc.scrollHeight; };
  keep(); announce(`${m.label} is ${req.deep ? 'thinking' : 'working'}.`);
  const t0 = Date.now(), tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000) + 's'; $$('[data-el],[data-el2]', el).forEach((x) => (x.textContent = s)); }, 500);
  const wait = async (ms) => { const end = Date.now() + ms; while (Date.now() < end && !run.stopped) await sleep(40); };
  const finish = () => { clearInterval(tick); S.run = null; syncComposers(); };
  const p = req.prompt.toLowerCase(), prose = $('[data-prose]', el), notes = $('[data-notes]', el);
  const fail = async (code, delay) => { await wait(delay); if (run.stopped) { finish(); return el.remove(); } el.querySelector('[data-status]')?.remove(); $('.think', el).hidden = true; prose.remove(); el.insertAdjacentHTML('beforeend', errHTML(code, m.id)); sess.msgs.push({ role: 'assistant', model: m.id, err: code }); finish(); keep(); };
  if (/\bbusy\b/.test(p)) return fail('BEDROCK_THROTTLED', 2200);
  if (/refuse/.test(p)) return fail('REFUSED', 2000);
  if (/toolong|too long/.test(p)) return fail('CONTEXT_TOO_LONG', 1200);
  if (/\bfail/.test(p)) return fail('BEDROCK_ERROR', 1500);
  const addNote = (c) => { notes.insertAdjacentHTML('beforeend', noticeHTML(c)); keep(); };
  if (/trim/.test(p)) { await wait(500); addNote('HISTORY_TRIMMED'); }
  if (req.files.some((f) => f.type !== 'img') && !m.docs) { await wait(300); addNote('ATTACHMENT_AS_TEXT'); }
  const thinkText = req.deep ? CANNED.thinkDeep : CANNED.think; let userToggled = false, secs = 0;
  const det = $('.think', el); det.addEventListener('toggle', () => { if (det.dataset.auto !== '1') userToggled = true; });
  await wait(req.deep ? 2200 : wantThink ? 1000 : 1600);
  if (wantThink && !run.stopped) {
    el.querySelector('[data-status]')?.remove(); det.hidden = false; det.dataset.auto = '1'; det.open = true; setTimeout(() => (det.dataset.auto = ''), 50);
    const tb = $('[data-tb]', el), toks = thinkText.split(/(\s+)/); let buf = '';
    for (let i = 0; i < toks.length && !run.stopped; i += 3) { buf += toks.slice(i, i + 3).join(''); tb.textContent = buf; tb.scrollTop = tb.scrollHeight; keep(); await sleep(req.deep ? 55 : 40); }
    await wait(250); secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
  }
  const grounded = !!req.ws, cites = grounded ? CITES_LEAVE : null, text = grounded ? CANNED.grounded : CANNED.general;
  el.querySelector('[data-status]')?.remove();
  if (wantThink && det) { $('[data-ts]', el).textContent = 'Thought for'; $('[data-el2]', el).textContent = secs + 's'; clearInterval(tick); if (!userToggled && !run.stopped) { det.dataset.auto = '1'; det.open = false; setTimeout(() => (det.dataset.auto = ''), 50); } }
  const toks = text.split(/(\s+)/); let out = '';
  for (let i = 0; i < toks.length && !run.stopped; i += 3) { out += toks.slice(i, i + 3).join(''); prose.innerHTML = md(out, cites) + '<span class="caret" aria-hidden="true"></span>'; keep(); await sleep(34); }
  const stopped = run.stopped; clearInterval(tick);
  prose.innerHTML = md(out || '...', cites) + (stopped ? '<p class="muted small">You stopped this response.</p>' : ''); prose.removeAttribute('aria-busy');
  const lat = ((Date.now() - t0) / 1000).toFixed(1) + ' s'; $('.who', el).insertAdjacentHTML('beforeend', `<span class="meta">${lat}</span>`);
  $('[data-after]', el).innerHTML = (cites && !stopped ? sourcesHTML(cites) : '') + actionsHTML();
  sess.msgs.push({ role: 'assistant', model: m.id, md: out, cites: cites && !stopped ? cites : null, latency: lat, think: wantThink ? { text: thinkText, secs } : null, notice: null });
  S.used++; finish(); keep(); announce(stopped ? 'Stopped.' : `${m.label} finished. The response is complete.`);
  if (sess.isNew) { delete sess.isNew; await sleep(700); sess.title = sess.title.split(' ').slice(0, 6).join(' ').replace(/[.,?]$/, ''); updateTitle(sess); renderSidebar(); announce('Chat titled ' + sess.title); }
  if (limitReached()) Genie.render.chat(['chat', sess.id]);
}
function bindChat() {
  const ms = $('#msgs'), sc = $('#chat-scroll');
  sc.addEventListener('scroll', () => { S.stick = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 80; $('#jump').hidden = S.stick; });
  $('#jump').addEventListener('click', () => { sc.scrollTop = sc.scrollHeight; $('#chat-dock textarea')?.focus(); });
  ms.addEventListener('click', async (e) => {
    const cite = e.target.closest('[data-cite]');
    if (cite) { const d = cite.closest('.turn').querySelector('details.sources'); d.open = true; const li = $('#src-' + cite.dataset.cite, d); li.classList.add('hl'); li.focus(); li.scrollIntoView({ block: 'nearest' }); setTimeout(() => li.classList.remove('hl'), 2500); return; }
    const cc = e.target.closest('[data-copy-code]');
    if (cc) { copyText($('code', cc.closest('.codeblock')).textContent); return; }
    const b = e.target.closest('[data-act]'); if (!b) return; const turn = b.closest('.turn'), a = b.dataset.act;
    if (a === 'copy') copyText($('.prose', turn).innerText);
    else if (a === 'up') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); $('[data-act=down]', turn).setAttribute('aria-pressed', 'false'); $('.feedback-form', turn)?.remove(); if (on) toast('Thanks for the feedback.'); }
    else if (a === 'down') {
      b.setAttribute('aria-pressed', 'true'); $('[data-act=up]', turn).setAttribute('aria-pressed', 'false'); if ($('.feedback-form', turn)) return;
      turn.insertAdjacentHTML('beforeend', `<form class="feedback-form"><div class="field"><label for="fb-${Date.now()}">What went wrong? <span class="muted" style="font-weight:400">(optional)</span></label><textarea class="input" id="fb-${Date.now()}" rows="2" placeholder="For example: the date was wrong"></textarea></div><div class="row"><button class="btn sm" type="button" data-fb="cancel">Cancel</button><button class="btn sm primary" type="submit">Send feedback</button></div></form>`);
      const f = $('.feedback-form', turn); $('textarea', f).focus();
      f.addEventListener('click', (ev) => { if (ev.target.dataset.fb === 'cancel') { f.remove(); b.setAttribute('aria-pressed', 'false'); b.focus(); } });
      f.addEventListener('submit', (ev) => { ev.preventDefault(); f.remove(); b.focus(); toast('Thanks. Your feedback went to the administrators.'); });
    }
    else if (a === 'retry') { const idx = [...ms.children].indexOf(turn), sess = S.current; sess.msgs.splice(sess.msgs.length - 1, 1); const prompt = sess.msgs[sess.msgs.length - 1]; S.stick = true; streamReply(sess, { prompt: prompt.text.replace(/busy|refuse|fail|too long|toolong/gi, 'plan'), files: prompt.attach || [], ws: sess.ws, deep: S.think, model: sess.model }, turn); void idx; }
    else if (a === 'pick-model') openModelPicker(b, { selected: S.current.model, onPick: (id) => { S.current.model = id; S.modelId = id; syncComposers(); updateTitle(S.current); toast('Switched to ' + modelOf(id).label + '. Press Try again to resend.'); } });
  });
}
function copyText(t) { try { navigator.clipboard.writeText(t).then(() => toast('Copied to clipboard.'), () => toast('Copy was blocked by the browser.', { bad: true })); } catch (e) { toast('Copy was blocked by the browser.', { bad: true }); } }

/* ---------- Compare ---------- */
function colStatus(s) { return { wait: `${ic('clock', 'sm')}Waiting`, run: `${ic('circle-notch', 'sm spin')}Writing`, done: `${ic('check-circle', 'sm')}Done`, fail: `${ic('warning-circle', 'sm')}Failed` }[s]; }
function colHTML(id, st) {
  const m = modelOf(id);
  return `<section class="col" data-col="${id}" aria-labelledby="ch-${id}"><header><h2 id="ch-${id}">${esc(m.label)}</h2><div class="status"><span class="badge ${st.s === 'done' ? 'ok' : st.s === 'fail' ? 'bad' : ''}">${colStatus(st.s)}</span>${st.secs ? `<span>${st.secs} s</span>` : ''}</div></header>
  <div class="body"><div class="prose">${st.fail ? errHTML('BEDROCK_ERROR', id) : st.md ? md(st.md) + (st.s === 'run' ? '<span class="caret" aria-hidden="true"></span>' : '') : '<div class="skel-turn"><div class="skel" style="width:90%"></div><div class="skel" style="width:75%"></div><div class="skel" style="width:60%"></div></div>'}</div></div>
  <footer><button class="btn ghost sm icon" type="button" data-cact="copy" aria-label="Copy ${esc(m.label)} answer" ${st.md ? '' : 'disabled'}>${ic('copy')}</button><button class="btn ghost sm icon" type="button" data-cact="up" aria-label="Good answer from ${esc(m.label)}" aria-pressed="false" ${st.md ? '' : 'disabled'}>${ic('thumbs-up')}</button><button class="btn ghost sm icon" type="button" data-cact="down" aria-label="Bad answer from ${esc(m.label)}" aria-pressed="false" ${st.md ? '' : 'disabled'}>${ic('thumbs-down')}</button><button class="btn ghost sm" type="button" data-cact="continue" ${st.md ? '' : 'disabled'} style="margin-left:auto">Continue in a chat</button></footer></section>`;
}
const CMP = { prompt: COMPARE.prompt, st: {} };
Object.keys(COMPARE.answers).forEach((k) => (CMP.st[k] = { s: 'done', md: COMPARE.answers[k].md, secs: COMPARE.answers[k].secs }));
Genie.render.compare = () => {
  const v = $('[data-view=compare]'), ids = S.cmpModels;
  v.innerHTML = `<div class="cmp"><div class="cmp-head"><h1 id="cmp-title" tabindex="-1">Compare models</h1><p>Send one message to up to ${SETTINGS.maxCompareModels} models and read the answers side by side.</p>
    <div role="group" aria-label="Models to compare" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${ids.map((id) => `<span class="chip"><span class="nm">${esc(modelOf(id).label)}</span><button type="button" class="x" data-rmm="${id}" aria-label="Remove ${esc(modelOf(id).label)}" ${ids.length <= 2 ? 'disabled' : ''}>${ic('x', 'sm')}</button></span>`).join('')}
    <button class="btn sm" type="button" id="cmp-add" aria-haspopup="listbox" aria-expanded="false" ${ids.length >= SETTINGS.maxCompareModels ? 'disabled' : ''}>${ic('plus', 'sm')}Add a model</button></div></div>
    ${CMP.prompt ? `<div class="cmp-prompt"><div class="bubble">${esc(CMP.prompt)}</div></div>` : ''}
    <div class="cols" style="--n:${ids.length}" id="cols">${ids.map((id) => colHTML(id, CMP.st[id] || { s: 'wait' })).join('')}</div>
    <div class="cmp-dock"><form class="composer" id="cmp-form" novalidate><label class="vh" for="cmp-ta">Message for all models</label><textarea id="cmp-ta" rows="1" placeholder="Ask all ${ids.length} models the same thing"></textarea><div class="composer-bar"><span class="small muted">Sent to ${ids.length} models</span><span class="spacer"></span><button class="send" type="submit" aria-label="Send to all models" disabled>${ic('arrow-up')}</button></div></form></div></div>`;
  const ta = $('#cmp-ta'), send = $('#cmp-form .send');
  ta.addEventListener('input', () => { autosize(ta); send.disabled = !ta.value.trim(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled) $('#cmp-form').requestSubmit(); } });
  $('#cmp-form').addEventListener('submit', (e) => { e.preventDefault(); runCompare(ta.value.trim()); });
  $('#cmp-add').addEventListener('click', (e) => openModelPicker(e.currentTarget, { exclude: ids, label: 'Add a model', onPick: (id) => { S.cmpModels.push(id); Genie.render.compare(); $('#cmp-add')?.focus(); } }));
  v.onclick = (e) => {
    const r = e.target.closest('[data-rmm]'); if (r) { S.cmpModels = S.cmpModels.filter((x) => x !== r.dataset.rmm); Genie.render.compare(); return; }
    const a = e.target.closest('[data-cact]'); if (!a) return; const col = a.closest('.col').dataset.col;
    if (a.dataset.cact === 'copy') copyText($('.prose', a.closest('.col')).innerText);
    else if (a.dataset.cact === 'continue') { S.modelId = col; toast('Opening a chat with ' + modelOf(col).label + '.'); location.hash = '#/chat/c1'; }
    else { const on = a.getAttribute('aria-pressed') !== 'true'; a.setAttribute('aria-pressed', on); a.closest('footer').querySelectorAll('[data-cact=up],[data-cact=down]').forEach((x) => x !== a && x.setAttribute('aria-pressed', 'false')); if (on) toast('Thanks for the feedback.'); }
  };
};
async function runCompare(text) {
  if (!text) return; if (S.offline) return toast('You’re offline. Try again when the connection returns.', { bad: true });
  CMP.prompt = text; S.cmpModels.forEach((id) => (CMP.st[id] = { s: 'wait' })); const keep = $('#cmp-ta'); Genie.render.compare(); announce('Sent to ' + S.cmpModels.length + ' models.');
  const pace = { sonnet: 38, gpt: 22, nova: 30, opus: 48, haiku: 18 };
  await Promise.all(S.cmpModels.map(async (id, i) => {
    const t0 = Date.now(); await sleep(500 + i * 450);
    if (/\bfail/i.test(text) && i === S.cmpModels.length - 1) { CMP.st[id] = { s: 'fail', fail: true }; paintCol(id); return; }
    const full = COMPARE.answers[id]?.md || CANNED.general, toks = full.split(/(\s+)/); let out = '';
    for (let k = 0; k < toks.length; k += 3) { out += toks.slice(k, k + 3).join(''); CMP.st[id] = { s: 'run', md: out }; paintCol(id); await sleep(pace[id] || 30); }
    CMP.st[id] = { s: 'done', md: out, secs: ((Date.now() - t0) / 1000).toFixed(1) }; paintCol(id);
  }));
  announce('All answers are in.'); void keep;
}
function paintCol(id) { const c = $(`[data-col="${id}"]`); if (c) c.outerHTML = colHTML(id, CMP.st[id]); }

/* ---------- Chat management (sidebar + history) ---------- */
async function renameChat(sess) {
  const ok = await dialog({ title: 'Rename chat', confirm: 'Save', body: `<div class="field"><label for="rn">Chat name</label><input class="input" id="rn" value="${esc(sess.title)}" required maxlength="120"></div>`, onOpen: (d) => { const i = $('#rn', d); i.focus(); i.select(); }, onSubmit: (d) => { const v = $('#rn', d).value.trim(); if (!v) return false; sess.title = v; } });
  if (ok) { renderSidebar(); Genie.afterChatChange && Genie.afterChatChange(); toast('Chat renamed.'); }
}
async function deleteChat(sess) {
  if (await confirmDlg('Delete this chat?', `“${esc(sess.title)}” and its messages will be deleted. This can’t be undone.`, 'Delete chat')) {
    S.sessions = S.sessions.filter((s) => s !== sess); renderSidebar(); Genie.afterChatChange && Genie.afterChatChange(); toast('Chat deleted.');
    if (S.current === sess) location.hash = '#/home';
  }
}
function chatMenu(anchor, sess) { menu(anchor, [{ label: 'Rename', icon: 'pencil-simple', run: () => renameChat(sess) }, { label: 'Delete', icon: 'trash', danger: true, run: () => deleteChat(sess) }], { label: 'Chat actions', align: 'end' }); }

/* ---------- Sidebar ---------- */
const GROUPS = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];
function histHTML(q) {
  const list = S.sessions.filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase()));
  if (!list.length) return `<p class="small muted" style="padding:8px 10px">No chats match “${esc(q)}”.</p>`;
  return GROUPS.map((g) => { const items = list.filter((s) => s.group === g); return items.length ? `<div class="sb-group"><h3>${g}</h3>${items.map((s) => `<div class="hist-item"><a href="#/chat/${s.id}" data-sid="${s.id}">${esc(s.title)}</a><button type="button" class="btn ghost icon sm more" aria-label="Actions for ${esc(s.title)}" aria-haspopup="menu" aria-expanded="false">${ic('dots-three')}</button></div>`).join('')}</div>` : ''; }).join('');
}
function renderSidebar() {
  const box = $('#sb-scroll'), admin = Genie.mode === 'admin';
  if (admin) {
    box.innerHTML = `<nav aria-label="Admin"><a class="sb-link" href="#/home">${ic('arrow-left')}Back to Genie</a><h3 class="caption" style="font-weight:600;color:var(--color-ink-2);padding:16px 10px 4px">Administration</h3><div class="sb-nav">
      ${[['users', 'users', 'Users'], ['models', 'cpu', 'Models'], ['templates', 'file-text', 'Templates'], ['settings', 'gear-six', 'Settings'], ['usage', 'chart-bar', 'Usage'], ['feedback', 'thumbs-down', 'Feedback'], ['audit', 'list-checks', 'Audit log']].map(([k, i, l]) => `<a class="sb-link" href="#/admin/${k}" data-nav="admin/${k}">${ic(i)}${l}${k === 'users' && PENDING.length ? `<span class="badge accent" style="margin-left:auto">${PENDING.length} waiting</span>` : ''}</a>`).join('')}</div></nav>`;
  } else {
    box.innerHTML = `<nav aria-label="Main"><div class="sb-nav"><a class="sb-link sb-new" href="#/home" data-nav="home">${ic('plus')}New chat<span class="kbd">Alt N</span></a>
      <a class="sb-link" href="#/compare" data-nav="compare">${ic('columns')}Compare</a><a class="sb-link" href="#/templates" data-nav="templates">${ic('file-text')}Templates</a><a class="sb-link" href="#/workspaces" data-nav="workspaces">${ic('books')}Workspaces</a></div></nav>
      <div class="sb-search"><label class="vh" for="sb-q">Search chats</label><div class="input-icon">${ic('magnifying-glass', 'sm')}<input class="input" id="sb-q" type="search" placeholder="Search chats" autocomplete="off"></div></div>
      <nav aria-label="Chat history" id="sb-hist">${histHTML('')}</nav><div style="padding:8px 4px"><a class="sb-link" href="#/history" data-nav="history">${ic('clock-counter-clockwise')}All chats</a></div>`;
    const q = $('#sb-q'); q.addEventListener('input', () => { $('#sb-hist').innerHTML = histHTML(q.value); markCurrent(); });
  }
  $('#acct-role').textContent = S.isAdmin ? 'Administrator' : 'Staff';
  markCurrent();
}
function markCurrent() {
  const h = location.hash.replace(/^#\//, '').split('?')[0];
  $$('#sidebar [data-nav]').forEach((a) => { const k = a.dataset.nav; a.toggleAttribute('aria-current', h === k || (k !== 'home' && h.startsWith(k))); if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page'); });
  $$('#sidebar [data-sid]').forEach((a) => (h === 'chat/' + a.dataset.sid ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}
function setSidebar(open, focusAfter) {
  S.sidebar = open; const sh = $('#shell'); sh.dataset.sidebar = open ? 'open' : 'closed'; $('#sidebar').inert = !open;
  try { if (isDesktop()) localStorage.setItem('genie-sidebar', open ? 'open' : 'closed'); } catch (e) { /* ignore */ }
  if (open && !isDesktop()) $('#sidebar a, #sidebar button')?.focus(); else if (!open && focusAfter !== false) $('#tb-toggle').focus();
}
function acctMenu(btn) {
  menu(btn, [
    { label: 'Account and passkeys', icon: 'user-circle', run: () => (location.hash = '#/account') },
    { label: isDark() ? 'Switch to light theme' : 'Switch to dark theme', icon: isDark() ? 'sun' : 'moon', run: () => setTheme(isDark() ? 'light' : 'dark') },
    { label: 'Keyboard shortcuts', icon: 'keyboard', run: shortcutsDlg },
    ...(S.isAdmin ? ['-', { label: 'Admin console', icon: 'shield-check', run: () => (location.hash = '#/admin/users') }] : []),
    '-', { label: 'Prototype: view as ' + (S.isAdmin ? 'staff' : 'administrator'), icon: 'users', run: () => { S.isAdmin = !S.isAdmin; renderSidebar(); if (!S.isAdmin && Genie.mode === 'admin') location.hash = '#/home'; toast('Now viewing as ' + (S.isAdmin ? 'an administrator' : 'a staff member') + '.'); } },
    { label: 'Prototype: states and errors', icon: 'info', run: () => (location.hash = '#/states') },
    '-', { label: 'Sign out', icon: 'sign-out', run: () => (location.hash = '#/signin') },
  ], { label: 'Account', align: 'start' });
}
function shortcutsDlg() {
  const row = (k, t) => `<span>${t}</span><span class="kbd-row">${k.split(' ').map((x) => `<span class="kbd">${x}</span>`).join('')}</span>`;
  dialog({ title: 'Keyboard shortcuts', noFoot: true, body: `<div class="kbd-table">${row('Enter', 'Send message')}${row('Shift Enter', 'New line')}${row('Esc', 'Stop writing, or close a menu')}${row('Ctrl K', 'Search chats')}${row('Alt N', 'New chat')}${row('Alt S', 'Show or hide the sidebar')}${row('Alt M', 'Choose a model')}${row('?', 'Show this list')}</div>` });
}

/* ---------- Router and start ---------- */
const VIEWS = { home: 'home', chat: 'chat', compare: 'compare', templates: 'templates', workspaces: 'workspaces', history: 'history', admin: 'admin', account: 'account', states: 'states' };
const AUTH = ['signin', 'signup', 'newpw', 'forgot', 'pending', 'suspended'];
Genie.route = () => {
  closePops();
  const raw = location.hash.replace(/^#\/?/, ''), [path, q] = raw.split('?'), parts = path.split('/').filter(Boolean), name = parts[0] || 'signin';
  if (S.run && name !== 'chat') { S.run.stopped = true; }
  const isAuth = AUTH.includes(name); $('#auth').hidden = !isAuth; $('#shell').hidden = isAuth; if (isAuth) $('#passkey').hidden = true;
  if (isAuth) { Genie.auth(name, parts, q); document.title = 'Genie'; return; }
  if (q === 'limit') S.used = SETTINGS.dailyMessageLimit;
  let view = name === 'workspaces' && parts[1] ? 'workspace' : VIEWS[name] || 'notfound';
  Genie.mode = view === 'admin' ? 'admin' : 'chat'; if (view === 'admin' && !S.isAdmin) view = 'notfound';
  $$('.view').forEach((x) => x.classList.toggle('on', x.dataset.view === view));
  renderSidebar();
  (Genie.render[view] || Genie.render.notfound)(parts);
  const titles = { home: 'New chat', chat: S.current?.title || 'Chat', compare: 'Compare models', templates: 'Templates', workspaces: 'Workspaces', workspace: 'Workspace', history: 'History', admin: 'Admin', account: 'Account', states: 'States', notfound: 'Page not found' };
  document.title = (titles[view] || 'Genie') + ' - Genie';
  $('#tb-title').innerHTML = view === 'chat' && S.current ? `${esc(S.current.title)}<small>${esc(modelOf(S.current.model).label)}${S.current.ws ? ', ' + esc(wsOf(S.current.ws).name) : ''}</small>` : '';
  if (!isDesktop() && S.sidebar) setSidebar(false, false);
  const main = $('#main'); $(`[data-view=${view}]`).scrollTop = 0;
  const f = view === 'home' ? $('[data-view=home] textarea:not([disabled])') : view === 'chat' ? $('#chat-dock textarea:not([disabled])') : view === 'compare' ? null : $(`[data-view=${view}] h1`);
  const target = f || $(`[data-view=${view}] h1`) || main; if (target) { if (target === main || target.tagName === 'H1') target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  Genie.afterRoute.forEach((fn) => fn(view));
};
function setOffline(b) { S.offline = b; $('#offline').hidden = !b; if (!b) toast('You’re back online.'); else announce('You are offline.'); }
Genie.start = () => {
  let side; try { side = localStorage.getItem('genie-sidebar'); } catch (e) { side = null; }
  S.sidebar = isDesktop() ? side !== 'closed' : false; $('#shell').dataset.sidebar = S.sidebar ? 'open' : 'closed'; $('#sidebar').inert = !S.sidebar;
  setTheme(document.documentElement.classList.contains('dark') ? 'dark' : document.documentElement.classList.contains('light') ? 'light' : '');
  $('#tb-toggle').onclick = () => setSidebar(true); $('#sb-close').onclick = () => setSidebar(false); $('#sb-scrim').onclick = () => setSidebar(false);
  $('#acct').onclick = (e) => acctMenu(e.currentTarget);
  $('#sidebar').addEventListener('click', (e) => { const m = e.target.closest('.more'); if (m) { chatMenu(m, S.sessions.find((s) => s.id === m.previousElementSibling.dataset.sid)); } if (e.target.closest('a') && !isDesktop()) setSidebar(false, false); });
  document.addEventListener('click', (e) => { const t = e.target.closest('[data-theme-toggle]'); if (t) setTheme(isDark() ? 'light' : 'dark'); });
  bindChat();
  addEventListener('hashchange', Genie.route);
  addEventListener('offline', () => setOffline(true)); addEventListener('online', () => setOffline(false));
  addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName), mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!S.sidebar) setSidebar(true); setTimeout(() => $('#sb-q')?.focus(), 30); }
    else if (e.altKey && e.code === 'KeyN') { e.preventDefault(); location.hash = '#/home'; }
    else if (e.altKey && e.code === 'KeyS') { e.preventDefault(); setSidebar(!S.sidebar); }
    else if (e.altKey && e.code === 'KeyM') { e.preventDefault(); $('.composer [data-act=model]:not([disabled])')?.click(); }
    else if (e.key === '?' && !typing && !document.querySelector('dialog[open]')) { shortcutsDlg(); }
    else if (e.key === 'Escape') { if (S.run && !document.querySelector('[popover]:popover-open, dialog[open]')) stopRun(); else if (!isDesktop() && S.sidebar) setSidebar(false); }
  });
  if (!location.hash) location.replace('#/signin');
  Genie.route();
};
