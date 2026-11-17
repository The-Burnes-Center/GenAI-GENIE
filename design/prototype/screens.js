/* Genie prototype: sign-in, templates, workspaces, history, admin, account, states. */
'use strict';

const pageHead = (title, desc, actions = '') => `<div class="page-head"><div><h1 id="page-title" tabindex="-1">${title}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="actions">${actions}</div></div>`;
const sw = (on, label, id) => `<button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-sw="${id}"></button>`;
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ======================= Auth ======================= */
const A = { email: '', passkey: true };
const logoBlock = `<a class="logo auth-logo" href="#/signin" aria-label="Genie"><svg class="mk" aria-hidden="true"><use href="#mark-sm"/></svg><svg class="wm" aria-hidden="true"><use href="#wordmark"/></svg></a>`;
const protoJump = `<details class="jump-demo"><summary>Prototype: jump to a screen</summary><div><a href="#/signin">Sign in</a><a href="#/signin?nopasskey">Sign in without a passkey</a><a href="#/newpw">Invited: set password</a><a href="#/forgot">Forgot password</a><a href="#/signup">Create account</a><a href="#/signup?closed">Sign-up closed</a><a href="#/pending">Waiting for approval</a><a href="#/suspended">Suspended</a></div></details>`;
const pwRules = (v) => [['At least 8 characters', v.length >= 8], ['An uppercase and a lowercase letter', /[a-z]/.test(v) && /[A-Z]/.test(v)], ['A number', /\d/.test(v)]];
const rulesHTML = (v) => `<ul class="pw-rules" aria-label="Password requirements">${pwRules(v).map(([t, ok]) => `<li data-ok="${ok}">${ic(ok ? 'check-circle' : 'circle-notch', 'sm')}<span>${t}${ok ? ' (done)' : ''}</span></li>`).join('')}</ul>`;
const pwField = (id, label, auto = 'current-password') => `<div class="field"><label for="${id}">${label}</label><div class="input-wrap"><input class="input" id="${id}" type="password" autocomplete="${auto}" required style="padding-right:76px"><button type="button" class="btn ghost sm" data-show="${id}" aria-label="Show ${label.toLowerCase()}" aria-pressed="false">Show</button></div></div>`;
function authPut(html, focus) { $('#auth-forms').innerHTML = html + protoJump; const f = focus ? $(focus) : $('#auth-forms h1'); if (f) { f.setAttribute('tabindex', '-1'); focus ? f.focus() : f.focus({ preventScroll: true }); } $('#auth-forms').querySelectorAll('[data-show]').forEach((b) => b.onclick = () => { const i = $('#' + b.dataset.show), on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.textContent = on ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', (on ? 'Hide ' : 'Show ') + b.getAttribute('aria-label').replace(/^(Show|Hide) /, '')); }); }
const errLine = (id, msg) => `<p class="err" id="${id}" role="alert">${ic('warning-circle', 'sm')}<span>${msg}</span></p>`;
function busy(btn, label) { btn.disabled = true; btn.dataset.l = btn.textContent; btn.innerHTML = `${ic('circle-notch', 'sm spin')}${label}`; }
function afterSignIn(viaPasskey) { location.hash = '#/home'; if (!viaPasskey && $('#passkey').dataset.dismissed !== '1') setTimeout(showPasskeyPrompt, 900); }

Genie.auth = (name, parts, q) => {
  const go = {
    signin: () => { A.passkey = q !== 'nopasskey'; signinEmail(); },
    signup: () => (q === 'closed' ? statusScreen('lock-key', 'Sign-up is closed right now', 'Genie accounts are created by invitation. Ask your administrator to invite you, then check your email for the next step.', '<a class="btn primary" href="#/signin">Back to sign in</a>') : signupForm()),
    newpw: setNewPassword, forgot: () => forgotEmail(),
    pending: () => statusScreen('hourglass', 'Thanks. Your account is waiting for approval', `An administrator reviews every new account. We will email ${esc(A.email || 'you')} as soon as you are approved. You can close this page.`, '<button class="btn primary" type="button" id="chk">Check again</button><a class="btn" href="#/signin">Sign out</a>', () => ($('#chk').onclick = () => toast('Still waiting. Nothing has changed yet.'))),
    suspended: () => statusScreen('prohibit', 'Your account is suspended', 'You can’t use Genie right now. If you think this is a mistake, contact your administrator.', '<a class="btn primary" href="#/signin">Sign out</a>'),
  }; go[name]();
};
function statusScreen(icon, title, text, actions, bind) { authPut(`<div class="status-screen">${logoBlock}${ic(icon)}<h1>${title}</h1><p>${text}</p><div class="row">${actions}</div></div>`); bind && bind(); }

function signinEmail(err) {
  authPut(`<form class="auth-form" novalidate id="f">${logoBlock}<h1>Sign in to Genie</h1>
    <div class="field"><label for="em">Work email</label><input class="input" id="em" type="email" inputmode="email" autocomplete="username webauthn" value="${esc(A.email)}" placeholder="name@example.org" ${err ? 'aria-invalid="true" aria-describedby="em-e"' : ''}>${err ? errLine('em-e', err) : ''}</div>
    <button class="btn primary" style="min-height:44px">Continue</button>
    <p class="small muted" style="text-align:center">New here? <a href="#/signup">Create an account</a></p></form>`, '#em');
  $('#f').onsubmit = (e) => {
    e.preventDefault(); const v = $('#em').value.trim();
    if (!emailOk(v)) return signinEmail('Enter your email address, like name@example.org.');
    A.email = v; busy($('#f .btn.primary'), 'Checking');
    setTimeout(() => { if (/pending/i.test(v)) location.hash = '#/pending'; else if (/suspended/i.test(v)) location.hash = '#/suspended'; else if (/invited|newhire/i.test(v)) location.hash = '#/newpw'; else A.passkey ? signinMethod() : signinPassword(); }, 500);
  };
}
function signinMethod(note) {
  authPut(`<div class="auth-form">${logoBlock}<h1>Welcome back</h1><div class="id-line"><span>${esc(A.email)}</span><button class="btn link" type="button" id="chg">Change</button></div>
    ${note ? `<div class="banner">${ic('info')}<div>${note}</div></div>` : ''}
    <div class="method-list"><button class="btn primary" type="button" id="pk">${ic('fingerprint')}Sign in with a passkey</button><p class="hint" style="margin-top:-4px">Use Face ID, Touch ID or a security key.</p>
    <div class="divider">or</div><button class="btn" type="button" id="pw">${ic('lock-key')}Use your password</button><button class="btn" type="button" id="otp">${ic('envelope-simple')}Email me a code</button></div></div>`, '#pk');
  $('#chg').onclick = () => signinEmail(); $('#pw').onclick = () => signinPassword(); $('#otp').onclick = () => signinCode();
  $('#pk').onclick = () => {
    authPut(`<div class="status-screen" role="status">${logoBlock}${ic('fingerprint')}<h1>Waiting for your device</h1><p>Follow the prompt from your browser to use Face ID, Touch ID or your security key.</p><div class="row"><button class="btn" type="button" id="pkc">Cancel</button></div></div>`);
    const t = setTimeout(() => afterSignIn(true), 1600); $('#pkc').onclick = () => { clearTimeout(t); signinMethod('Passkey sign-in was cancelled. You can try again or choose another way.'); };
  };
}
function signinPassword(err) {
  authPut(`<form class="auth-form" id="f" novalidate>${logoBlock}<h1>Enter your password</h1><div class="id-line"><span>${esc(A.email)}</span><button class="btn link" type="button" id="chg">Change</button></div>
    <div>${pwField('pw', 'Password')}${err ? errLine('pw-e', err) : ''}</div>
    <button class="btn primary" style="min-height:44px">Sign in</button>
    <p class="small" style="display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between"><a href="#/forgot">Forgot password?</a><button class="btn link" type="button" id="otp">Email me a code instead</button></p>
    ${A.passkey ? '<button class="btn ghost" type="button" id="pk2">Use a passkey instead</button>' : ''}</form>`, '#pw');
  $('#chg').onclick = () => signinEmail(); $('#otp').onclick = () => signinCode(); if ($('#pk2')) $('#pk2').onclick = () => signinMethod();
  $('#f').onsubmit = (e) => { e.preventDefault(); const v = $('#pw').value; if (!v) return signinPassword('Enter your password.'); if (v.toLowerCase() === 'wrong') return signinPassword('That email and password don’t match. Try again, or reset your password.'); busy($('#f .btn.primary'), 'Signing in'); setTimeout(() => afterSignIn(false), 700); };
}
function codeForm({ title, lead, label = 'Six-digit code', submit, onOk, err, extra = '' }) {
  authPut(`<form class="auth-form" id="f" novalidate>${logoBlock}<h1>${title}</h1><p class="lead">${lead}</p>
    <div class="field"><label for="cd">${label}</label><input class="input mono" id="cd" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" style="letter-spacing:0.3em;font-size:1.125rem" ${err ? 'aria-invalid="true" aria-describedby="cd-e"' : ''}>${err ? errLine('cd-e', err) : ''}</div>${extra}
    <button class="btn primary" style="min-height:44px">${submit}</button>
    <p class="small"><button class="btn link" type="button" id="rs">Send a new code</button> <span class="muted" id="rs-s" role="status"></span></p></form>`, '#cd');
  $('#rs').onclick = () => { $('#rs-s').textContent = 'A new code is on its way.'; };
  $('#f').onsubmit = (e) => { e.preventDefault(); const v = $('#cd').value.trim(); if (!/^\d{6}$/.test(v) || v === '000000') return codeForm({ title, lead, label, submit, onOk, extra, err: 'That code didn’t work. Check the six digits and try again.' }); busy($('#f .btn.primary'), 'Checking'); setTimeout(onOk, 600); };
}
function signinCode() { codeForm({ title: 'Check your email', lead: `We sent a six-digit code to <b>${esc(A.email)}</b>. It works for 10 minutes.`, submit: 'Sign in', onOk: () => afterSignIn(false) }); }
function setNewPassword() {
  authPut(`<form class="auth-form" id="f" novalidate>${logoBlock}<h1>Set your password</h1><p class="lead">Your administrator invited you. Choose a password to finish setting up your account.</p>
    ${pwField('np', 'New password', 'new-password')}<div id="rules">${rulesHTML('')}</div>${pwField('np2', 'Confirm new password', 'new-password')}<p class="err" id="mm" hidden>${ic('warning-circle', 'sm')}<span>The two passwords don’t match.</span></p>
    <button class="btn primary" style="min-height:44px" id="go" disabled>Set password and continue</button></form>`, '#np');
  const chk = () => { const v = $('#np').value, ok = pwRules(v).every((r) => r[1]) && v === $('#np2').value; $('#rules').innerHTML = rulesHTML(v); $('#mm').hidden = !$('#np2').value || v === $('#np2').value; $('#go').disabled = !ok; };
  $('#np').oninput = chk; $('#np2').oninput = chk;
  $('#f').onsubmit = (e) => { e.preventDefault(); busy($('#go'), 'Saving'); setTimeout(() => { toast('Password set. Welcome to Genie.'); afterSignIn(false); }, 700); };
}
function forgotEmail(err) {
  authPut(`<form class="auth-form" id="f" novalidate>${logoBlock}<h1>Reset your password</h1><p class="lead">Enter your work email and we will send you a code.</p>
    <div class="field"><label for="em">Work email</label><input class="input" id="em" type="email" autocomplete="username" value="${esc(A.email)}" ${err ? 'aria-invalid="true" aria-describedby="em-e"' : ''}>${err ? errLine('em-e', err) : ''}</div>
    <button class="btn primary" style="min-height:44px">Send code</button><p class="small"><a href="#/signin">Back to sign in</a></p></form>`, '#em');
  $('#f').onsubmit = (e) => { e.preventDefault(); const v = $('#em').value.trim(); if (!emailOk(v)) return forgotEmail('Enter your email address, like name@example.org.'); A.email = v; forgotCode(); };
}
function forgotCode() {
  codeForm({ title: 'Check your email', lead: `If <b>${esc(A.email)}</b> has an account, a six-digit code is on its way.`, submit: 'Continue', onOk: () => { toast('Code accepted.'); forgotNew(); } });
}
function forgotNew() {
  authPut(`<form class="auth-form" id="f" novalidate>${logoBlock}<h1>Choose a new password</h1>${pwField('np', 'New password', 'new-password')}<div id="rules">${rulesHTML('')}</div><button class="btn primary" style="min-height:44px" id="go" disabled>Change password</button></form>`, '#np');
  $('#np').oninput = () => { const v = $('#np').value; $('#rules').innerHTML = rulesHTML(v); $('#go').disabled = !pwRules(v).every((r) => r[1]); };
  $('#f').onsubmit = (e) => { e.preventDefault(); location.hash = '#/signin'; setTimeout(() => toast('Password changed. Sign in with your new password.'), 100); };
}
function signupForm(err) {
  const dom = SETTINGS.allowedEmailDomains.map((d) => '@' + d);
  authPut(`<form class="auth-form" id="f" novalidate>${logoBlock}<h1>Create your account</h1><p class="lead">Use your work email. ${SETTINGS.requireApproval ? 'An administrator approves new accounts.' : ''}</p>
    ${err ? `<div class="banner bad" role="alert" id="su-e">${ic('warning-circle')}<div>${err}</div></div>` : ''}
    <div class="field"><label for="em">Work email</label><input class="input" id="em" type="email" autocomplete="username" value="${esc(A.email)}" placeholder="name@example.org"></div>
    ${pwField('np', 'Password', 'new-password')}<div id="rules">${rulesHTML('')}</div>
    <button class="btn primary" style="min-height:44px" id="go">Create account</button><p class="small muted" style="text-align:center">Already have an account? <a href="#/signin">Sign in</a></p></form>`, err ? '#su-e' : '#em');
  $('#np').oninput = () => ($('#rules').innerHTML = rulesHTML($('#np').value));
  $('#f').onsubmit = (e) => {
    e.preventDefault(); const v = $('#em').value.trim(); A.email = v;
    if (!emailOk(v)) return signupForm('Enter your email address, like name@example.org.');
    if (!pwRules($('#np').value).every((r) => r[1])) return signupForm('Choose a password with at least 8 characters, upper and lower case letters, and a number.');
    if (!SETTINGS.allowedEmailDomains.some((d) => v.toLowerCase().endsWith('@' + d))) return signupForm(`Genie accounts are for staff with an ${dom.join(' or ')} email. Use your work email, or ask your administrator for an invitation.`);
    busy($('#go'), 'Creating account'); setTimeout(() => codeForm({ title: 'Check your email', lead: `We sent a six-digit code to <b>${esc(A.email)}</b>. Enter it to confirm your address.`, submit: 'Confirm email', onOk: () => { if (SETTINGS.requireApproval) location.hash = '#/pending'; else { location.hash = '#/signin'; setTimeout(() => toast('Email confirmed. Sign in to continue.'), 100); } } }), 700);
  };
}
function showPasskeyPrompt() {
  const p = $('#passkey'); if (location.hash.startsWith('#/signin') || p.dataset.dismissed === '1') return;
  p.dataset.on = '1'; p.hidden = false;
  p.innerHTML = `<h2 id="pk-title">${ic('fingerprint')}Sign in faster next time</h2><p>Use Face ID, Touch ID or a security key instead of typing a password. It takes a few seconds to set up.</p><div class="row"><button class="btn primary sm" type="button" data-pk="add">Set up a passkey</button><button class="btn sm" type="button" data-pk="later">Not now</button><button class="btn ghost sm" type="button" data-pk="never">Don’t ask again</button></div>`;
  p.onclick = (e) => { const b = e.target.closest('[data-pk]'); if (!b) return; const k = b.dataset.pk;
    if (k === 'add') { busy(b, 'Waiting for your device'); setTimeout(() => { p.hidden = true; p.dataset.dismissed = '1'; PASSKEYS.push({ id: 'k' + Date.now(), name: 'This device', added: 'Today' }); toast('Passkey added. Next time, choose Sign in with a passkey.'); }, 1400); }
    else { p.hidden = true; if (k === 'never') p.dataset.dismissed = '1'; } };
  announce('Tip: you can set up a passkey to sign in faster.');
}

/* ======================= Templates ======================= */
Genie.render.templates = () => {
  const v = $('[data-view=templates]'), cats = ['All'].concat(CATEGORIES.filter((c) => TEMPLATES.some((t) => t.enabled && t.category === c)));
  let cur = 'All';
  const paint = () => {
    const list = TEMPLATES.filter((t) => t.enabled && (cur === 'All' || t.category === cur));
    $('#tpl-panel').innerHTML = `<div class="tpl-grid">${list.map((t) => `<button type="button" class="tpl" data-t="${t.id}"><span class="tt"><span>${esc(t.title)}</span>${ic('caret-right', 'sm')}</span><p>${esc(t.desc)}</p><span class="cat">${esc(t.category)}</span></button>`).join('')}</div>`;
  };
  v.innerHTML = `<div class="page">${pageHead('Templates', 'Start from a proven prompt. Pick one, fill in the brackets, and send.')}
    <div class="tabs" role="tablist" aria-label="Template categories">${cats.map((c, i) => `<button class="tab" role="tab" type="button" id="tab-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" aria-controls="tpl-panel" data-c="${c}">${c}</button>`).join('')}</div><div id="tpl-panel" role="tabpanel" aria-labelledby="tab-0"></div></div>`;
  paint();
  const tabs = $$('[role=tab]', v);
  const sel = (t) => { tabs.forEach((x) => { x.setAttribute('aria-selected', x === t); x.tabIndex = x === t ? 0 : -1; }); cur = t.dataset.c; $('#tpl-panel').setAttribute('aria-labelledby', t.id); paint(); };
  v.onclick = (e) => { const t = e.target.closest('[role=tab]'); if (t) return sel(t); const c = e.target.closest('[data-t]'); if (c) useTemplate(c.dataset.t); };
  v.onkeydown = (e) => { const i = tabs.indexOf(document.activeElement); if (i < 0 || !/Arrow(Left|Right)|Home|End/.test(e.key)) return; e.preventDefault(); const n = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; tabs[n].focus(); sel(tabs[n]); };
};

/* ======================= Workspaces ======================= */
const wsBadge = (w) => `<span class="badge ${w.vis === 'shared' ? 'accent' : ''}">${ic(w.vis === 'shared' ? 'users' : 'user-circle')}${w.vis === 'shared' ? 'Shared' : 'Personal'}</span>`;
Genie.render.workspaces = () => {
  const v = $('[data-view=workspaces]');
  v.innerHTML = `<div class="page">${pageHead('Workspaces', 'Collections of documents. Pick one when you chat and Genie answers from those files, with sources.', '<button class="btn primary" type="button" id="nw">' + ic('plus', 'sm') + 'New workspace</button>')}
  ${WORKSPACES.length ? table({ label: 'Workspaces', cols: 'minmax(0,2.4fr) 120px 90px minmax(0,1.4fr) 150px', head: ['Name', 'Type', 'Documents', 'Owner', ''], rows: WORKSPACES.map((w) => ({ cells: [`<a class="primary" href="#/workspaces/${w.id}" style="color:var(--color-ink);text-decoration:none">${esc(w.name)}</a><span class="sub">${esc(w.desc)}</span>`, wsBadge(w), String(w.docs), `<span class="sub" style="font-size:var(--text-ui)">${esc(w.owner)}</span>`, `<button class="btn sm" type="button" data-chat="${w.id}">Chat</button>`], cellCls: ['', '', 'num', '', 'end'] })) })
    : emptyState('books', 'No workspaces yet', 'Create one, add a few documents, and ask questions about them.', '<button class="btn primary" id="nw2">New workspace</button>')}</div>`;
  const make = async () => {
    const ok = await dialog({ title: 'New workspace', confirm: 'Create workspace', body: `<div class="field"><label for="wn">Name</label><input class="input" id="wn" required maxlength="80" placeholder="For example: Grant guidelines"></div><div class="field"><label for="wd">What is it for? <span class="muted" style="font-weight:400">(optional)</span></label><input class="input" id="wd" maxlength="160"></div>
      <fieldset style="border:0;padding:0;margin:0" class="ws-radio"><legend class="label" style="margin-bottom:8px">Who can use it</legend><label class="radio-card"><input type="radio" name="vis" value="personal" checked><span><b style="font-weight:500">Only me</b><br><span class="small muted">Private to your account.</span></span></label>
      <label class="radio-card"><input type="radio" name="vis" value="shared" ${S.isAdmin ? '' : 'disabled'}><span><b style="font-weight:500">Everyone at the organization</b><br><span class="small muted">${S.isAdmin ? 'All staff can ask questions of these documents.' : 'Only administrators can create shared workspaces.'}</span></span></label></fieldset>`,
      onOpen: (d) => $('#wn', d).focus(), onSubmit: (d) => { const n = $('#wn', d).value.trim(); if (!n) return false; const w = { id: 'w' + Date.now(), name: n, desc: $('#wd', d).value.trim(), vis: $('[name=vis]:checked', d).value, owner: 'staff.member@example.org', docs: 0, created: 'Today' }; WORKSPACES.push(w); DOCS[w.id] = []; Genie._newWs = w.id; } });
    if (ok) location.hash = '#/workspaces/' + Genie._newWs;
  };
  v.onclick = (e) => { if (e.target.closest('#nw,#nw2')) make(); const c = e.target.closest('[data-chat]'); if (c) chatWithWs(c.dataset.chat); };
};
function chatWithWs(id) { S.composer.wsId = id; location.hash = '#/home'; setTimeout(() => toast('Ready to ask about ' + wsOf(id).name + '.'), 80); }
const docIcon = (t) => ic(t === 'pdf' ? 'file-pdf' : 'file-text');
const docStatus = (d) => ({ uploading: `<span class="badge">${ic('upload-simple')}Uploading ${d.p || 0}%</span><div class="progress" role="progressbar" aria-label="Uploading ${esc(d.name)}" aria-valuenow="${d.p || 0}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${d.p || 0}%"></i></div>`, uploaded: `<span class="badge">${ic('clock')}Waiting to index</span>`, indexing: `<span class="badge warn">${ic('circle-notch', 'spin')}Getting ready</span>`, ready: `<span class="badge ok">${ic('check-circle')}Ready</span>`, failed: `<span class="badge bad">${ic('warning-circle')}Failed</span>` }[d.status]);
Genie.render.workspace = (parts) => {
  const v = $('[data-view=workspace]'), w = wsOf(parts[1]); if (!w) { location.hash = '#/404'; return; } const docs = (DOCS[w.id] = DOCS[w.id] || []);
  const paintDocs = () => { $('#docs').innerHTML = docs.length ? table({ label: 'Documents', cols: 'minmax(0,2.5fr) 90px 90px 190px 90px', head: ['Document', 'Size', 'Added', 'Status', ''], rows: docs.map((d) => ({ cells: [`<span class="primary" style="display:flex;gap:8px;align-items:center">${docIcon(d.type)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(d.name)}</span></span>${d.error ? `<span class="sub" style="white-space:normal;color:var(--color-danger);margin-top:4px">${esc(d.error)}</span>` : ''}`, d.size, d.added, docStatus(d), `<button class="btn ghost sm icon" type="button" data-del="${d.id}" aria-label="Remove ${esc(d.name)}">${ic('trash')}</button>`], cellCls: ['wrap', '', '', '', 'end'] })) }) : emptyState('upload-simple', 'No documents yet', 'Drop files above. Genie reads them so you can ask questions about what is inside.'); };
  v.innerHTML = `<div class="page"><a class="back" href="#/workspaces">${ic('arrow-left', 'sm')}All workspaces</a>${pageHead(`${esc(w.name)} ${wsBadge(w)}`, esc(w.desc || 'No description yet.'), `<button class="btn primary" type="button" data-chat="${w.id}">${ic('chat-text', 'sm')}Chat with this workspace</button><button class="btn icon" type="button" id="wm" aria-label="Workspace actions" aria-haspopup="menu" aria-expanded="false">${ic('dots-three')}</button>`)}
    <div class="dropzone" id="dz"><svg class="ic" aria-hidden="true"><use href="#i-upload-simple"/></svg><b style="font-weight:500">Drag files here, or</b><button class="btn" type="button" id="pick">Choose files</button><span class="hint">PDF, Word, Excel, CSV, HTML, text or Markdown. Up to 50 MB each.</span><input type="file" id="fi" multiple hidden accept=".pdf,.csv,.doc,.docx,.xls,.xlsx,.html,.txt,.md"></div>
    <h2 class="section-title">Documents</h2><p class="small muted" style="margin:-4px 0 12px" id="docnote">Getting ready usually takes a minute or two. This list updates on its own.</p><div id="docs"></div></div>`;
  paintDocs();
  const upload = (files) => [...files].forEach((f) => {
    const ext = (f.name.split('.').pop() || '').toLowerCase(); if (![...DOC_EXT].includes(ext)) return toast(`Genie can’t read .${ext} files. Use PDF, Word, Excel, CSV, HTML, text or Markdown.`, { bad: true });
    if (f.size > 50e6) return toast(`${f.name} is larger than 50 MB.`, { bad: true });
    const d = { id: 'd' + Math.random(), name: f.name, type: ext === 'pdf' ? 'pdf' : 'doc', size: fmtSize(f.size), added: 'Today', status: 'uploading', p: 0 }; docs.unshift(d); w.docs++; paintDocs();
    const t = setInterval(() => { d.p += 20; if (d.p >= 100) { clearInterval(t); d.status = 'indexing'; paintDocs(); setTimeout(() => { if (/fail/i.test(d.name)) { d.status = 'failed'; d.error = 'Genie couldn’t read this file. Check that it opens on your computer, then upload it again.'; announce(d.name + ' failed.'); } else { d.status = 'ready'; announce(d.name + ' is ready.'); } paintDocs(); }, 2600); } else paintDocs(); }, 350);
  });
  const dz = $('#dz'); $('#pick').onclick = () => $('#fi').click(); $('#fi').onchange = (e) => { upload(e.target.files); e.target.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); }, { once: true }));
  dz.ondragleave = () => dz.classList.remove('drag'); dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('drag'); upload(e.dataTransfer.files); }; dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('drag'); };
  v.onclick = async (e) => {
    const c = e.target.closest('[data-chat]'); if (c) return chatWithWs(c.dataset.chat);
    const d = e.target.closest('[data-del]'); if (d) { const doc = docs.find((x) => x.id === d.dataset.del); if (await confirmDlg('Remove this document?', `“${esc(doc.name)}” will be removed from ${esc(w.name)}. Genie will stop using it in answers.`, 'Remove document')) { docs.splice(docs.indexOf(doc), 1); w.docs--; paintDocs(); toast('Document removed.'); } return; }
    if (e.target.closest('#wm')) menu($('#wm'), [{ label: 'Rename workspace', icon: 'pencil-simple', run: () => toast('Rename opens a small dialog, like renaming a chat.') }, { label: 'Delete workspace', icon: 'trash', danger: true, run: async () => { if (await confirmDlg('Delete this workspace?', `“${esc(w.name)}” and all ${docs.length} of its documents will be deleted. Chats that used it keep their answers. This can’t be undone.`, 'Delete workspace')) { WORKSPACES.splice(WORKSPACES.indexOf(w), 1); location.hash = '#/workspaces'; toast('Workspace deleted.'); } } }], { align: 'end', label: 'Workspace actions' });
  };
};

/* ======================= History ======================= */
Genie.render.history = () => {
  const v = $('[data-view=history]'); let q = '';
  const paint = () => {
    const list = S.sessions.filter((s) => !q || s.title.toLowerCase().includes(q.toLowerCase()));
    $('#hist-list').innerHTML = list.length ? GROUPS.map((g) => { const it = list.filter((s) => s.group === g); return it.length ? `<h2 class="section-title" style="margin-top:24px;font-size:var(--text-ui)">${g}</h2>` + table({ label: g, cols: 'minmax(0,3fr) minmax(0,1.4fr) 110px', head: ['Chat', 'Model', ''], rows: it.map((s) => ({ cells: [`<a class="primary" href="#/chat/${s.id}" style="color:var(--color-ink);text-decoration:none">${esc(s.title)}</a>${s.ws ? `<span class="sub">Workspace: ${esc(wsOf(s.ws).name)}</span>` : ''}`, `<span class="sub" style="font-size:var(--text-ui)">${esc(modelOf(s.model).label)}</span>`, `<button class="btn ghost sm icon" type="button" data-ren="${s.id}" aria-label="Rename ${esc(s.title)}">${ic('pencil-simple')}</button><button class="btn ghost sm icon" type="button" data-del="${s.id}" aria-label="Delete ${esc(s.title)}">${ic('trash')}</button>`], cellCls: ['', '', 'end'] })) }) : ''; }).join('') : (q ? emptyState('magnifying-glass', `No chats match “${esc(q)}”`, 'Try a different word, or clear the search.') : emptyState('chat-text', 'No chats yet', 'Your conversations show up here so you can come back to them.', '<a class="btn primary" href="#/home">Start a chat</a>'));
    $('#hist-n').textContent = `${list.length} ${list.length === 1 ? 'chat' : 'chats'}`;
  };
  v.innerHTML = `<div class="page">${pageHead('History', 'Everything you have asked Genie. Only you can see these chats.', `<button class="btn" type="button" id="da" style="color:var(--color-danger)">${ic('trash', 'sm')}Delete all chats</button>`)}
    <div class="toolbar"><div class="grow input-icon">${ic('magnifying-glass', 'sm')}<label class="vh" for="hq">Search your chats</label><input class="input" id="hq" type="search" placeholder="Search your chats" autocomplete="off"></div><span class="muted small" id="hist-n" role="status"></span></div><div id="hist-list"></div></div>`;
  paint(); Genie.afterChatChange = () => { if (location.hash === '#/history') paint(); };
  $('#hq').oninput = (e) => { q = e.target.value; paint(); };
  v.onclick = async (e) => {
    const r = e.target.closest('[data-ren]'); if (r) return renameChat(S.sessions.find((s) => s.id === r.dataset.ren));
    const d = e.target.closest('[data-del]'); if (d) return deleteChat(S.sessions.find((s) => s.id === d.dataset.del));
    if (e.target.closest('#da') && (await dialog({ title: 'Delete all your chats?', danger: true, confirm: 'Delete all chats', body: `<p>This permanently deletes all ${S.sessions.length} chats and their messages from your account. It can’t be undone.</p>` }))) { S.sessions = []; renderSidebar(); paint(); toast('All chats deleted.'); }
  };
};

/* ======================= Shared bits ======================= */
function emptyState(icon, title, text, action = '') { return `<div class="empty">${ic(icon)}<h2>${title}</h2><p>${text}</p>${action}</div>`; }
Genie.render.notfound = () => {
  $('[data-view=notfound]').innerHTML = `<div class="nf"><span class="code">Error 404</span><h1 id="page-title" tabindex="-1">We can’t find that page</h1><p>The link may be old, or the chat may have been deleted. Your other chats are safe.</p><div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn primary" href="#/home">Start a new chat</a><a class="btn" href="#/history">Go to history</a></div></div>`;
};

/* ======================= Account ======================= */
Genie.render.account = () => {
  const v = $('[data-view=account]');
  const paintPk = () => ($('#pks').innerHTML = PASSKEYS.length ? PASSKEYS.map((k) => `<div class="pk-row">${ic('fingerprint')}<div><b style="font-weight:500">${esc(k.name)}</b><div class="small muted">Added ${esc(k.added)}</div></div><button class="btn sm" type="button" data-rm="${k.id}" aria-label="Remove passkey ${esc(k.name)}">Remove</button></div>`).join('') : `<p class="muted">You have no passkeys yet. Add one to sign in without typing a password.</p>`);
  v.innerHTML = `<div class="page narrow">${pageHead('Account', 'Your sign-in options and appearance.')}
   <section class="acct-section" aria-labelledby="a1"><h2 id="a1">Profile</h2><dl style="display:grid;grid-template-columns:120px 1fr;gap:8px"><dt class="muted">Email</dt><dd>staff.member@example.org</dd><dt class="muted">Role</dt><dd>${S.isAdmin ? 'Administrator' : 'Staff'}</dd></dl></section>
   <section class="acct-section" aria-labelledby="a2"><h2 id="a2">Passkeys</h2><p class="lead">A passkey lets you sign in with Face ID, Touch ID or a security key. It is faster than a password and can’t be guessed or phished.</p><div id="pks"></div><div><button class="btn" type="button" id="addpk">${ic('plus', 'sm')}Add a passkey</button></div></section>
   <section class="acct-section" aria-labelledby="a3"><h2 id="a3">Change password</h2><form class="form-grid" id="pwf" novalidate>${pwField('cp', 'Current password')}${pwField('np', 'New password', 'new-password')}<div id="rules">${rulesHTML('')}</div><div><button class="btn primary" id="pws" disabled>Change password</button></div></form></section>
   <section class="acct-section" aria-labelledby="a4"><h2 id="a4">Appearance</h2><div class="seg" role="radiogroup" aria-label="Theme">${['light', 'dark', 'system'].map((t) => `<label><input type="radio" name="th" value="${t}" ${themeSetting() === t ? 'checked' : ''}><span>${t[0].toUpperCase() + t.slice(1)}</span></label>`).join('')}</div></section>
   <section class="acct-section" aria-labelledby="a5"><h2 id="a5">Sign out</h2><div><a class="btn" href="#/signin">${ic('sign-out', 'sm')}Sign out</a></div></section></div>`;
  paintPk(); $$('[data-show]', v).forEach((b) => (b.onclick = () => { const i = $('#' + b.dataset.show), on = i.type === 'password'; i.type = on ? 'text' : 'password'; b.textContent = on ? 'Hide' : 'Show'; b.setAttribute('aria-pressed', on); }));
  const chk = () => ($('#pws').disabled = !($('#cp').value && pwRules($('#np').value).every((r) => r[1]))); $('#cp').oninput = chk; $('#np').oninput = () => { $('#rules').innerHTML = rulesHTML($('#np').value); chk(); };
  $('#pwf').onsubmit = (e) => { e.preventDefault(); toast('Password changed.'); $('#pwf').reset(); $('#rules').innerHTML = rulesHTML(''); $('#pws').disabled = true; };
  $$('[name=th]', v).forEach((r) => (r.onchange = () => setTheme(r.value === 'system' ? '' : r.value)));
  v.onclick = async (e) => {
    if (e.target.closest('#addpk')) { const b = e.target.closest('#addpk'); busy(b, 'Waiting for your device'); setTimeout(() => { PASSKEYS.push({ id: 'k' + Date.now(), name: 'This device', added: 'Today' }); paintPk(); b.disabled = false; b.innerHTML = ic('plus', 'sm') + 'Add a passkey'; toast('Passkey added.'); }, 1300); }
    const rm = e.target.closest('[data-rm]'); if (rm) { const k = PASSKEYS.find((x) => x.id === rm.dataset.rm); if (await confirmDlg(`Remove “${esc(k.name)}”?`, PASSKEYS.length === 1 ? 'It is your only passkey. You will sign in with your password instead.' : 'You will no longer be able to sign in with it.', 'Remove passkey')) { PASSKEYS.splice(PASSKEYS.indexOf(k), 1); paintPk(); toast('Passkey removed.'); } }
  };
};

/* ======================= Admin ======================= */
const roleSel = (u) => `<label class="vh" for="r-${u.id}">Role for ${esc(u.email)}</label><select class="input" id="r-${u.id}" data-role="${u.id}" style="min-height:34px;padding:2px 28px 2px 10px;width:auto" ${u.self ? 'disabled' : ''}><option value="user" ${u.role === 'user' ? 'selected' : ''}>Staff</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrator</option></select>`;
const userStatus = (u) => ({ active: '<span class="badge ok">Active</span>', invited: `<span class="badge warn">${ic('envelope-simple')}Invited</span>`, suspended: `<span class="badge bad">${ic('prohibit')}Suspended</span>` }[u.status]);
function adminUsers(v) {
  v.innerHTML = `<div class="page">${pageHead('Users', 'Invite people, approve sign-ups, and change roles.', `<button class="btn primary" type="button" id="inv">${ic('user-plus', 'sm')}Invite someone</button>`)}
   ${PENDING.length ? `<h2 class="section-title" style="margin-top:0" id="pend">Waiting for approval (${PENDING.length})</h2><p class="small muted" style="margin:-6px 0 12px">These people created their own accounts. They can’t use Genie until you approve them.</p>${table({ label: 'Sign-ups waiting for approval', cols: 'minmax(0,2fr) minmax(0,1.4fr) 190px', head: ['Email', 'Signed up', ''], rows: PENDING.map((p) => ({ cells: [`<span class="primary">${esc(p.email)}</span>`, p.when, `<button class="btn primary sm" type="button" data-ap="${p.id}" aria-label="Approve ${esc(p.email)}">Approve</button><button class="btn sm" type="button" data-dc="${p.id}" aria-label="Decline ${esc(p.email)}">Decline</button>`], cellCls: ['', '', 'end'] })) })}` : `<div class="banner ok" style="margin-bottom:16px">${ic('check-circle')}<div>No sign-ups are waiting for approval.</div></div>`}
   <h2 class="section-title">Everyone (${USERS.length})</h2><div class="toolbar"><div class="grow input-icon">${ic('magnifying-glass', 'sm')}<label class="vh" for="uq">Search users</label><input class="input" id="uq" type="search" placeholder="Search by email"></div></div><div id="ul"></div></div>`;
  const paint = (q = '') => ($('#ul').innerHTML = table({ label: 'Users', cols: 'minmax(0,2.2fr) 170px 140px minmax(0,1fr) 60px', head: ['Email', 'Role', 'Status', 'Last signed in', ''], rows: USERS.filter((u) => u.email.includes(q.toLowerCase())).map((u) => ({ cells: [`<span class="primary">${esc(u.email)}${u.self ? ' <span class="badge">You</span>' : ''}</span>`, roleSel(u), userStatus(u), `<span class="sub" style="font-size:var(--text-ui)">${esc(u.last)}</span>`, `<button class="btn ghost sm icon" type="button" data-um="${u.id}" aria-label="Actions for ${esc(u.email)}" aria-haspopup="menu" aria-expanded="false">${ic('dots-three')}</button>`], cellCls: ['', '', '', '', 'end'] })) }));
  paint(); $('#uq').oninput = (e) => paint(e.target.value);
  v.onchange = (e) => { const s = e.target.closest('[data-role]'); if (s) { const u = USERS.find((x) => x.id === s.dataset.role); u.role = s.value; toast(`${u.email} is now ${s.value === 'admin' ? 'an administrator' : 'a staff member'}.`); } };
  v.onclick = async (e) => {
    if (e.target.closest('#inv')) { if (await dialog({ title: 'Invite someone', confirm: 'Send invitation', body: `<p>They get an email with a temporary password and set their own the first time they sign in.</p><div class="field"><label for="ie">Email</label><input class="input" id="ie" type="email" required placeholder="name@example.org"></div><div class="field"><label for="ir">Role</label><select class="input" id="ir"><option value="user">Staff</option><option value="admin">Administrator</option></select></div>`, onOpen: (d) => $('#ie', d).focus(), onSubmit: (d) => { const em = $('#ie', d).value.trim(); if (!emailOk(em)) return false; USERS.push({ id: 'u' + Date.now(), email: em, role: $('#ir', d).value, status: 'invited', last: 'Never signed in' }); } })) { paint(); toast('Invitation sent.'); } return; }
    const ap = e.target.closest('[data-ap]'); if (ap) { const p = PENDING.splice(PENDING.findIndex((x) => x.id === ap.dataset.ap), 1)[0]; USERS.push({ id: p.id, email: p.email, role: 'user', status: 'active', last: 'Never signed in' }); adminUsers(v); renderSidebar(); toast(`${p.email} approved. We emailed them.`); return; }
    const dc = e.target.closest('[data-dc]'); if (dc) { const p = PENDING.find((x) => x.id === dc.dataset.dc); if (await confirmDlg('Decline this sign-up?', `${esc(p.email)} won’t be able to use Genie, and their account will be removed. They can sign up again later.`, 'Decline')) { PENDING.splice(PENDING.indexOf(p), 1); adminUsers(v); renderSidebar(); toast('Sign-up declined.'); } return; }
    const um = e.target.closest('[data-um]'); if (um) { const u = USERS.find((x) => x.id === um.dataset.um); menu(um, [{ label: 'Send password reset', icon: 'key', run: () => toast('Reset code sent to ' + u.email + '.') }, u.status === 'suspended' ? { label: 'Restore access', icon: 'check-circle', run: () => { u.status = 'active'; paint(); toast('Access restored.'); } } : { label: u.self ? 'Suspend (not for yourself)' : 'Suspend access', icon: 'prohibit', disabled: u.self, run: async () => { if (await confirmDlg('Suspend ' + esc(u.email) + '?', 'They will see a message that their account is suspended. Their chats are kept.', 'Suspend')) { u.status = 'suspended'; paint(); toast('Access suspended.'); } } }, '-', { label: 'Delete user', icon: 'trash', danger: true, disabled: u.self, run: async () => { if (await confirmDlg('Delete ' + esc(u.email) + '?', 'Their account and chats are permanently deleted. This can’t be undone.', 'Delete user')) { USERS.splice(USERS.indexOf(u), 1); paint(); toast('User deleted.'); } } }], { align: 'end', label: 'User actions' }); }
  };
}
function adminModels(v) {
  const paint = () => {
    $('#mt').innerHTML = table({ label: 'Models', cols: 'minmax(0,2fr) 110px minmax(0,1.3fr) 80px 70px 190px 60px', head: ['Model', 'Provider', 'Can do', 'On', 'Default', 'Last test', ''], rows: MODELS.map((m) => ({ cells: [`<span class="primary">${esc(m.label)}</span><span class="sub mono">${esc(m.bedrock)}</span>`, esc(m.provider), `<span class="sub" style="font-size:var(--text-ui);white-space:normal">${m.vision && m.docs ? 'Images, documents' : 'Text, documents as text'}${m.think ? ', thinking' : ''}</span>`, sw(m.enabled, `Turn ${m.label} ${m.enabled ? 'off' : 'on'}`, m.id), `<label class="vh" for="df-${m.id}">Make ${esc(m.label)} the default</label><input type="radio" name="def" id="df-${m.id}" value="${m.id}" ${SETTINGS.defaultModelId === m.id ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--color-accent)">`, m.test ? (m.test.ok ? `<span class="badge ok">${ic('check-circle')}Passed, ${(m.test.ms / 1000).toFixed(1)} s</span>` : `<span class="badge bad">${ic('warning-circle')}Failed</span><span class="sub" style="white-space:normal">${esc(m.test.error)}</span>`) : '<span class="badge">Not tested</span>', `<button class="btn ghost sm icon" type="button" data-mm="${m.id}" aria-label="Actions for ${esc(m.label)}" aria-haspopup="menu" aria-expanded="false">${ic('dots-three')}</button>`], cellCls: ['', '', 'wrap', '', '', 'wrap', 'end'] })) });
  };
  v.innerHTML = `<div class="page">${pageHead('Models', 'Choose which AI models staff can use, test that they respond, and add new ones from AWS Bedrock.', `<button class="btn primary" type="button" id="am">${ic('plus', 'sm')}Add a model</button>`)}<div id="mt"></div><p class="hint" style="margin-top:12px">Turning a model off hides it from everyone. The default model can’t be turned off.</p></div>`;
  paint();
  v.onchange = (e) => { const r = e.target.closest('[name=def]'); if (r) { const m = modelOf(r.value); if (!m.enabled) { toast('Turn the model on before making it the default.', { bad: true }); return paint(); } SETTINGS.defaultModelId = r.value; toast(m.label + ' is now the default.'); paint(); } };
  v.onclick = async (e) => {
    const s = e.target.closest('[data-sw]'); if (s) { const m = modelOf(s.dataset.sw); if (m.enabled && SETTINGS.defaultModelId === m.id) return toast('The default model can’t be turned off. Choose another default first.', { bad: true }); m.enabled = !m.enabled; paint(); $(`[data-sw="${m.id}"]`).focus(); announce(`${m.label} is ${m.enabled ? 'on' : 'off'}.`); return; }
    if (e.target.closest('#am')) { const av = AVAILABLE_MODELS; if (await dialog({ title: 'Add a model', wide: true, confirm: 'Add model', body: `<p>These models are available in your AWS account but not in Genie yet.</p><fieldset style="border:0;padding:0;margin:0" class="ws-radio"><legend class="vh">Available models</legend>${av.map((a, i) => `<label class="radio-card"><input type="radio" name="am" value="${i}" ${i === 0 ? 'checked' : ''}><span><b style="font-weight:500">${esc(a.label)}</b> <span class="badge">${esc(a.provider)}</span><br><span class="mono muted">${esc(a.id)}</span></span></label>`).join('')}</fieldset><div class="field"><label for="al">Name people will see</label><input class="input" id="al" required></div>`, onOpen: (d) => { const set = () => ($('#al', d).value = av[$('[name=am]:checked', d).value].label); set(); $$('[name=am]', d).forEach((r) => (r.onchange = set)); }, onSubmit: (d) => { const a = av[$('[name=am]:checked', d).value], l = $('#al', d).value.trim(); if (!l) return false; MODELS.push({ id: 'x' + Date.now(), label: l, provider: a.provider, desc: 'Added by an administrator.', vision: false, docs: false, think: false, enabled: false, test: null, bedrock: a.id }); av.splice(av.indexOf(a), 1); } })) { paint(); toast('Model added, turned off. Test it, then turn it on.'); } return; }
    const mm = e.target.closest('[data-mm]'); if (mm) { const m = modelOf(mm.dataset.mm); menu(mm, [{ label: 'Test now', icon: 'play', run: async () => { const b = $(`[data-mm="${m.id}"]`); toast('Testing ' + m.label + '.'); await sleep(1200); m.test = m.id === 'grok' ? { ok: false, error: 'Access to this model is not turned on for this AWS account.' } : { ok: true, ms: 800 + Math.round(Math.random() * 900) }; paint(); announce(m.label + (m.test.ok ? ' passed.' : ' failed.')); } }, { label: 'Rename', icon: 'pencil-simple', run: async () => { if (await dialog({ title: 'Rename model', body: `<div class="field"><label for="rl">Name people will see</label><input class="input" id="rl" value="${esc(m.label)}" required></div>`, onOpen: (d) => $('#rl', d).select(), onSubmit: (d) => { const l = $('#rl', d).value.trim(); if (!l) return false; m.label = l; } })) { paint(); toast('Model renamed.'); } } }], { align: 'end', label: 'Model actions' }); }
  };
}
function adminTemplates(v, parts) {
  const id = parts[2];
  if (id) {
    const t = id === 'new' ? { id: 't' + Date.now(), title: '', category: 'Writing', desc: '', starter: '', system: '', enabled: true, isNew: true } : TEMPLATES.find((x) => x.id === id);
    v.innerHTML = `<div class="page"><a class="back" href="#/admin/templates">${ic('arrow-left', 'sm')}All templates</a>${pageHead(t.isNew ? 'New template' : 'Edit template', '')}
    <form class="split" id="tf" novalidate><div class="form-grid"><div class="field"><label for="tt">Title</label><input class="input" id="tt" value="${esc(t.title)}" required></div><div class="field"><label for="td">Short description</label><input class="input" id="td" value="${esc(t.desc)}"><span class="hint">Shown on the template card.</span></div>
    <div class="field"><label for="tc">Category</label><select class="input" id="tc">${CATEGORIES.map((c) => `<option ${c === t.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label for="ts">Instructions for the model</label><textarea class="input" id="ts" rows="5">${esc(t.system)}</textarea><span class="hint">People don’t see this. It tells the model how to behave for this template.</span></div>
    <div class="field"><label for="tp">Starter message</label><textarea class="input" id="tp" rows="4">${esc(t.starter)}</textarea><span class="hint">Fills the message box. Put [brackets] around parts the person should replace.</span></div>
    <label class="check"><input type="checkbox" id="te" ${t.enabled ? 'checked' : ''}><span>Show this template to staff</span></label></div>
    <div class="preview" aria-label="Preview"><p class="ph">PREVIEW</p><div class="tpl" style="pointer-events:none"><p class="tt"><span id="pv-t">${esc(t.title) || 'Template title'}</span></p><p id="pv-d">${esc(t.desc) || 'Short description'}</p><span class="cat" id="pv-c">${esc(t.category)}</span></div></div>
    <div class="save-bar" style="grid-column:1/-1">${t.isNew ? '' : `<button class="btn" type="button" id="td-del" style="margin-right:auto;color:var(--color-danger)">${ic('trash', 'sm')}Delete</button>`}<a class="btn" href="#/admin/templates">Cancel</a><button class="btn primary">Save template</button></div></form></div>`;
    const live = () => { $('#pv-t').textContent = $('#tt').value || 'Template title'; $('#pv-d').textContent = $('#td').value || 'Short description'; $('#pv-c').textContent = $('#tc').value; }; ['tt', 'td', 'tc'].forEach((i) => ($('#' + i).oninput = live));
    $('#tf').onsubmit = (e) => { e.preventDefault(); if (!$('#tt').value.trim()) { $('#tt').setAttribute('aria-invalid', 'true'); $('#tt').focus(); return toast('Give the template a title.', { bad: true }); } Object.assign(t, { title: $('#tt').value.trim(), desc: $('#td').value, category: $('#tc').value, system: $('#ts').value, starter: $('#tp').value, enabled: $('#te').checked }); delete t.isNew; if (!TEMPLATES.includes(t)) TEMPLATES.push(t); location.hash = '#/admin/templates'; setTimeout(() => toast('Template saved.'), 80); };
    const del = $('#td-del'); if (del) del.onclick = async () => { if (await confirmDlg('Delete this template?', `“${esc(t.title)}” will disappear for everyone. This can’t be undone.`, 'Delete template')) { TEMPLATES.splice(TEMPLATES.indexOf(t), 1); location.hash = '#/admin/templates'; setTimeout(() => toast('Template deleted.'), 80); } };
    return;
  }
  const paint = () => (v.innerHTML = `<div class="page">${pageHead('Templates', 'Starting points staff see in the gallery.', `<a class="btn primary" href="#/admin/templates/new">${ic('plus', 'sm')}New template</a>`)}${table({ label: 'Templates', cols: 'minmax(0,2.4fr) 140px 80px 90px', head: ['Template', 'Category', 'Shown', ''], rows: TEMPLATES.map((t) => ({ cells: [`<span class="primary">${esc(t.title)}</span><span class="sub">${esc(t.desc)}</span>`, esc(t.category), sw(t.enabled, `Show ${t.title} to staff`, t.id), `<a class="btn sm" href="#/admin/templates/${t.id}" aria-label="Edit ${esc(t.title)}">Edit</a>`], cellCls: ['', '', '', 'end'] })) })}</div>`);
  paint(); v.onclick = (e) => { const s = e.target.closest('[data-sw]'); if (s) { const t = TEMPLATES.find((x) => x.id === s.dataset.sw); t.enabled = !t.enabled; paint(); $(`[data-sw="${t.id}"]`).focus(); } }; v.onchange = null;
}
function adminSettings(v) {
  const S0 = SETTINGS, mopts = (sel) => enabledModels().map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  v.innerHTML = `<div class="page">${pageHead('Settings', 'What staff see, how much they can use, and who can sign up.')}
  <form class="split" id="sf" novalidate><div class="form-grid">
   <h2 class="section-title" style="margin:0">Welcome</h2>
   <div class="field"><label for="sn">App name</label><input class="input" id="sn" value="${esc(S0.appName)}"></div>
   <div class="field"><label for="st">Welcome title</label><input class="input" id="st" value="${esc(S0.welcomeTitle)}"></div>
   <div class="field"><label for="sm">Welcome message</label><textarea class="input" id="sm" rows="3">${esc(S0.welcomeMessage)}</textarea></div>
   <div class="field"><label for="sd">Disclaimer</label><textarea class="input" id="sd" rows="2">${esc(S0.disclaimer)}</textarea><span class="hint">Shown under the message box. Leave empty to hide it.</span></div>
   <h2 class="section-title" style="margin:16px 0 0">Models and limits</h2>
   <div class="field"><label for="sdm">Default model</label><select class="input" id="sdm">${mopts(S0.defaultModelId)}</select></div>
   <div class="field"><label for="stm">Model that names chats</label><select class="input" id="stm">${mopts(S0.titleModelId)}</select><span class="hint">A small, fast model works best. It writes a short title after the first answer.</span></div>
   <div class="field"><label for="sl">Daily messages per person</label><input class="input" id="sl" type="number" min="0" value="${S0.dailyMessageLimit}" style="max-width:140px"><span class="hint">Enter 0 for no limit.</span></div>
   <div class="field"><label for="sc">Most models in a comparison</label><input class="input" id="sc" type="number" min="2" max="4" value="${S0.maxCompareModels}" style="max-width:140px"></div>
   <div class="field"><label for="sk">Sources read per question</label><input class="input" id="sk" type="number" min="1" max="20" value="${S0.retrievalTopK}" style="max-width:140px"><span class="hint">How many passages Genie reads from a workspace to answer. More can be more complete, but slower.</span></div>
   <h2 class="section-title" style="margin:16px 0 0">Sign-up</h2>
   <fieldset style="border:0;padding:0;margin:0" class="ws-radio"><legend class="vh">Who can create an account</legend>
    <label class="radio-card"><input type="radio" name="sm" value="off" ${S0.signupMode === 'off' ? 'checked' : ''}><span><b style="font-weight:500">Invitation only</b><br><span class="small muted">Only people you invite can sign in. The sign-up page says it is closed.</span></span></label>
    <label class="radio-card"><input type="radio" name="sm" value="open" ${S0.signupMode === 'open' ? 'checked' : ''}><span><b style="font-weight:500">Anyone with an allowed email</b><br><span class="small muted">People create their own accounts with a work email.</span></span></label></fieldset>
   <div class="field"><label for="sde">Allowed email domains</label><input class="input" id="sde" value="${esc(S0.allowedEmailDomains.join(', '))}" placeholder="example.org, example.gov"><span class="hint">Separate with commas. Leave empty to allow any email address.</span></div>
   <label class="check"><input type="checkbox" id="sra" ${S0.requireApproval ? 'checked' : ''}><span>Require an administrator to approve new sign-ups<br><span class="hint">Approved people appear under Users, in a waiting list.</span></span></label>
   </div>
   <div class="preview" aria-label="Preview of the welcome screen"><p class="ph">PREVIEW OF THE HOME SCREEN</p><div class="pt" id="pv-t">${esc(S0.welcomeTitle)}</div><p id="pv-m" style="color:var(--color-ink-2)">${esc(S0.welcomeMessage)}</p><p class="small muted" id="pv-d">${esc(S0.disclaimer)}</p></div>
   <div class="save-bar" style="grid-column:1/-1"><button class="btn" type="reset">Discard changes</button><button class="btn primary">Save settings</button></div></form></div>`;
  const live = () => { $('#pv-t').textContent = $('#st').value; $('#pv-m').textContent = $('#sm').value; $('#pv-d').textContent = $('#sd').value; $('#sde').disabled = $('[name=sm]:checked').value === 'off'; }; $('#sf').oninput = live; live();
  $('#sf').onreset = () => setTimeout(() => adminSettings(v)); $('#sf').onsubmit = (e) => { e.preventDefault(); Object.assign(S0, { appName: $('#sn').value, welcomeTitle: $('#st').value, welcomeMessage: $('#sm').value, disclaimer: $('#sd').value, defaultModelId: $('#sdm').value, titleModelId: $('#stm').value, dailyMessageLimit: +$('#sl').value, maxCompareModels: +$('#sc').value, retrievalTopK: +$('#sk').value, signupMode: $('[name=sm]:checked').value, allowedEmailDomains: $('#sde').value.split(',').map((x) => x.trim()).filter(Boolean), requireApproval: $('#sra').checked }); toast('Settings saved.'); };
}
function barChart(vals, labels) {
  const W = 680, H = 220, L = 36, B = 26, T = 8, max = Math.ceil(Math.max(...vals) / 50) * 50, bw = (W - L) / vals.length, y = (n) => T + (H - T - B) * (1 - n / max);
  const ticks = [0, 1, 2, 3, 4].map((i) => (max / 4) * i);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Messages per day. Busiest day: ${labels[vals.indexOf(Math.max(...vals))]} with ${Math.max(...vals)} messages."><title>Messages per day</title>${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('')}${vals.map((n, i) => `<rect class="bar" x="${L + i * bw + bw * 0.18}" width="${bw * 0.64}" y="${y(n)}" height="${H - B - y(n)}" rx="2"/>${i % 2 === 0 ? `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">${labels[i]}</text>` : ''}`).join('')}</svg>`;
}
function adminUsage(v) {
  const labels = USAGE_DAYS.map((_, i) => 'Nov ' + (4 + i)), tot = USAGE_DAYS.reduce((a, b) => a + b, 0), mx = Math.max(...USAGE_MODELS.map((m) => m.msgs));
  v.innerHTML = `<div class="page">${pageHead('Usage', 'Messages, people and model use for the last 14 days. Sample numbers in this prototype.')}
   <div class="stats"><div class="stat"><b>${tot.toLocaleString()}</b><span>Messages</span></div><div class="stat"><b>31</b><span>People who used Genie</span></div><div class="stat"><b>3.1M</b><span>Input tokens</span></div><div class="stat"><b>1.2M</b><span>Output tokens</span></div></div>
   <p class="hint" style="margin-bottom:16px">Tokens are the pieces of text models read and write. Providers bill by them.</p>
   <div class="chart-box"><h2 class="section-title" style="margin:0 0 12px;font-size:var(--text-ui)">Messages per day</h2>${barChart(USAGE_DAYS, labels)}
   <details class="more"><summary>Show the numbers as a table</summary>${table({ label: 'Messages per day', cols: '1fr 1fr', head: ['Day', 'Messages'], rows: USAGE_DAYS.map((n, i) => ({ cells: [labels[i], String(n)], cellCls: ['', 'num'] })) })}</details></div>
   <h2 class="section-title">By model</h2>${table({ label: 'Usage by model', cols: 'minmax(0,2fr) minmax(0,2fr) 110px 110px', head: ['Model', 'Messages', 'Input tokens', 'Output tokens'], rows: USAGE_MODELS.map((m) => ({ cells: [`<span class="primary">${m.model}</span>`, `<span>${m.msgs}</span><span class="inline-bar" style="--w:${(m.msgs / mx) * 100}%" aria-hidden="true"></span>`, m.inT, m.outT], cellCls: ['', '', 'num', 'num'] })) })}
   <h2 class="section-title">By person</h2>${table({ label: 'Usage by person', cols: 'minmax(0,3fr) 120px 120px', head: ['Email', 'Messages', 'Tokens'], rows: USAGE_USERS.map((u) => ({ cells: [`<span class="primary">${u.email}</span>`, String(u.msgs), u.tok], cellCls: ['', 'num', 'num'] })) })}</div>`;
}
function adminFeedback(v) {
  v.innerHTML = `<div class="page">${pageHead('Feedback', 'Answers people marked as not helpful, with their comments. Use it to spot problems with a model or a template.')}
  <div class="toolbar"><label for="fm" class="muted">Model</label><select class="input" id="fm" style="width:auto;min-height:36px"><option value="">All models</option>${[...new Set(FEEDBACK.map((f) => f.model))].map((m) => `<option>${m}</option>`).join('')}</select></div><div id="fl"></div></div>`;
  const paint = (m = '') => { const list = FEEDBACK.filter((f) => !m || f.model === m); $('#fl').innerHTML = list.length ? list.map((f) => `<article class="t" style="margin-bottom:12px;padding:16px;display:grid;gap:8px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="badge bad">${ic('thumbs-down')}Not helpful</span><span class="badge">${esc(f.model)}</span><span class="small muted">${esc(f.user)}, ${esc(f.when)}</span></div><p style="font-size:var(--text-body)">${f.comment ? esc(f.comment) : '<span class="muted">No comment left.</span>'}</p>
    <details class="more"><summary style="margin-top:0">Show the question and answer</summary><div class="expand" style="margin-top:8px"><div><b>Question</b><q>${esc(f.prompt)}</q></div><div><b>Answer (start)</b><q>${esc(f.response)}</q></div></div></details></article>`).join('') : emptyState('thumbs-down', 'No feedback to show', 'When someone marks an answer as not helpful, it appears here.'); };
  paint(); $('#fm').onchange = (e) => paint(e.target.value);
}
function adminAudit(v) {
  v.innerHTML = `<div class="page">${pageHead('Audit log', 'Who changed what in the admin console.')}<div class="toolbar"><div class="grow input-icon">${ic('magnifying-glass', 'sm')}<label class="vh" for="aq">Search the log</label><input class="input" id="aq" type="search" placeholder="Search by person, action or target"></div></div><div id="al"></div></div>`;
  const paint = (q = '') => ($('#al').innerHTML = table({ label: 'Audit log', cols: '150px minmax(0,1.6fr) 150px minmax(0,1.4fr) minmax(0,1.4fr)', head: ['When', 'Who', 'Action', 'Target', 'Details'], rows: AUDIT.filter((a) => JSON.stringify(a).toLowerCase().includes(q.toLowerCase())).map((a) => ({ cells: [a.when, `<span class="primary">${esc(a.who)}</span>`, a.action, esc(a.target), `<span class="sub" style="font-size:var(--text-ui)">${esc(a.details)}</span>`], cellCls: ['wrap', '', 'wrap', 'wrap', 'wrap'] })) }));
  paint(); $('#aq').oninput = (e) => paint(e.target.value);
}
Genie.render.admin = (parts) => {
  const v = $('[data-view=admin]'), k = parts[1] || 'users'; v.onclick = null; v.onchange = null;
  ({ users: adminUsers, models: adminModels, templates: adminTemplates, settings: adminSettings, usage: adminUsage, feedback: adminFeedback, audit: adminAudit }[k] || adminUsers)(v, parts);
  Genie.afterRoute.length = 0; markCurrent();
};

/* ======================= States gallery ======================= */
Genie.render.states = () => {
  const v = $('[data-view=states]');
  const sk = (w) => `<div class="skel" style="width:${w}"></div>`;
  v.innerHTML = `<div class="page">${pageHead('States and errors', 'Every loading, empty, error and notice state in one place. Prototype only.')}<div class="state-grid">
  <section class="state-box" aria-labelledby="s1"><h2 id="s1">Loading (skeletons keep the layout still)</h2><div class="skel-turn" style="max-width:560px;margin-bottom:20px">${sk('30%')}${sk('96%')}${sk('88%')}${sk('64%')}</div>${table({ label: 'Loading list', cols: '2fr 1fr 1fr', head: ['Name', 'Type', 'Documents'], rows: [1, 2, 3].map(() => ({ cells: [sk('70%'), sk('50%'), sk('30%')] })) })}</section>
  <section class="state-box" aria-labelledby="s2"><h2 id="s2">Empty</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">${emptyState('chat-text', 'No chats yet', 'Your conversations show up here so you can come back to them.', '<a class="btn primary" href="#/home">Start a chat</a>')}${emptyState('books', 'No workspaces yet', 'Create one, add a few documents, and ask questions about them.', '<a class="btn primary" href="#/workspaces">New workspace</a>')}${emptyState('magnifying-glass', 'No chats match “taxes”', 'Try a different word, or clear the search.')}</div></section>
  <section class="state-box" aria-labelledby="s3"><h2 id="s3">Errors inside a chat (copy for each error code)</h2><div style="display:grid;gap:14px;max-width:640px">
    <div><p class="small muted">Model busy (BEDROCK_THROTTLED)</p>${errHTML('BEDROCK_THROTTLED', 'opus').replace(' role="alert"', '')}</div><div><p class="small muted">Message too long (CONTEXT_TOO_LONG)</p>${errHTML('CONTEXT_TOO_LONG', 'mistral').replace(' role="alert"', '')}</div>
    <div><p class="small muted">Declined to answer (REFUSED)</p>${errHTML('REFUSED', 'sonnet').replace(' role="alert"', '')}</div><div><p class="small muted">Daily limit reached (LIMIT_REACHED)</p><div class="banner warn">${ic('warning')}<div><b>You’ve reached today’s limit of ${SETTINGS.dailyMessageLimit} messages.</b> It starts over tomorrow morning. Ask your administrator if you need more.</div><a class="btn sm" href="#/home?limit" style="margin-left:auto;align-self:center;white-space:nowrap">See it live</a></div></div></div></section>
  <section class="state-box" aria-labelledby="s4"><h2 id="s4">Inline notices (quiet, in the answer)</h2><div style="display:grid;gap:10px">${noticeHTML('HISTORY_TRIMMED')}${noticeHTML('ATTACHMENT_AS_TEXT')}</div><p class="small muted" style="margin-top:10px">Try it: in a chat, send a message containing the word <b>trim</b>, <b>busy</b>, <b>refuse</b>, <b>too long</b> or <b>fail</b>.</p></section>
  <section class="state-box" aria-labelledby="s5"><h2 id="s5">Thinking</h2><div style="max-width:560px"><div class="writing" role="img" aria-label="Thinking, 12 seconds so far">${ic('circle-notch', 'sm spin')}Thinking <span class="elapsed" style="color:var(--color-ink-3)">12s</span></div>
   <details class="think" open style="margin-top:12px"><summary>${ic('caret-right', 'sm car')}<span>Thinking</span> <span class="elapsed">12s</span></summary><div class="think-body">${esc(CANNED.think)}</div></details></div></section>
  <section class="state-box" aria-labelledby="s6"><h2 id="s6">Connection and notifications</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="so">Show offline banner</button><button class="btn" id="st1">Success toast</button><button class="btn" id="st2">Toast with undo</button><button class="btn" id="st3">Error toast</button><a class="btn" href="#/404">Open the 404 page</a><a class="btn" href="#/pending">Waiting for approval</a><a class="btn" href="#/suspended">Suspended</a></div></section>
  <section class="state-box" aria-labelledby="s7"><h2 id="s7">Failed comparison column</h2><div style="max-width:420px" class="cols">${colHTML('grok', { s: 'fail', fail: true })}</div></section></div></div>`;
  v.onclick = (e) => {
    const id = e.target.id;
    if (id === 'so') { setOffline(!S.offline); e.target.textContent = S.offline ? 'Hide offline banner' : 'Show offline banner'; }
    if (id === 'st1') toast('Settings saved.'); if (id === 'st2') toast('Chat archived.', { action: 'Undo', onAction: () => toast('Restored.') }); if (id === 'st3') toast('We couldn’t save that. Check your connection and try again.', { bad: true });
  };
};
