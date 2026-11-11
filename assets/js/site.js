// Fills the portfolio from content/site.json (which the admin site edits), so the pages
// themselves never need changing. Also: the latest NdalamoPDF downloads from GitHub, the
// approved reviews from the reviews spreadsheet, the theme switch and a gentle reveal on scroll.
(async function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  // Theme switch, remembered in this browser only.
  document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  }));
  const nav = $('.nav');
  addEventListener('scroll', () => nav && nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  let site;
  try {
    site = await (await fetch('content/site.json', { cache: 'no-cache' })).json();
  } catch (e) {
    console.error('Could not load content/site.json', e);
    return;
  }

  // Visitor counts (GoatCounter: no cookies, no personal details), once a code is set in the admin.
  const gc = site.analytics && site.analytics.goatcounter;
  if (gc && /^[a-z0-9-]+$/.test(gc) && !/^(localhost|127\.)/.test(location.hostname)) {
    const s = document.createElement('script');
    s.async = true; s.src = 'https://gc.zgo.at/count.js'; s.dataset.goatcounter = `https://${gc}.goatcounter.com/count`;
    document.head.appendChild(s);
  }

  // Simple bindings: text, show-if-set, links, pictures, email.
  document.querySelectorAll('[data-bind]').forEach(el => { const v = get(site, el.dataset.bind); if (v) el.textContent = v; });
  document.querySelectorAll('[data-show]').forEach(el => { if (!get(site, el.dataset.show)) el.hidden = true; });
  document.querySelectorAll('[data-href]').forEach(el => { const v = get(site, el.dataset.href); if (v) el.href = v; });
  document.querySelectorAll('[data-src]').forEach(el => { const v = get(site, el.dataset.src); if (v) el.src = v; });
  document.querySelectorAll('[data-mailto]').forEach(el => { const v = get(site, el.dataset.mailto); if (v) el.href = 'mailto:' + v; });

  const tags = items => `<ul class="tags">${items.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;

  // Until a CV is added, "Download CV" leads to the contact section instead of a missing file.
  if (!site.profile.cv) document.querySelectorAll('[data-href="profile.cv"]').forEach(a => {
    a.href = '#contact'; a.removeAttribute('download'); a.title = 'The CV is on its way: ask for it here';
  });
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(get(site, btn.dataset.copy)); btn.textContent = 'Copied'; }
    catch (e) { btn.textContent = 'Press Ctrl+C'; }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  }));

  if ($('#about-text')) renderHome(site);
  if ($('#project')) renderProject(site);
  if ($('#contact-form')) contactForm(site);
  reveal();

  // The message form: sent to the owner's spreadsheet script (a "Messages" sheet, with an email to
  // the owner). Robots that fill the hidden field are told it went through, and nothing is sent.
  function contactForm(site) {
    const form = $('#contact-form'), status = $('#form-status'), button = $('button[type=submit]', form);
    const opened = Date.now();
    const say = (text, kind) => { status.textContent = text; status.className = 'form-status' + (kind ? ' ' + kind : ''); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      form.querySelectorAll('input, textarea').forEach(f => f.classList.remove('invalid'));
      const missing = ['name', 'email', 'message'].filter(k => !String(data[k] || '').trim());
      if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) missing.push('email');
      if (missing.length) {
        missing.forEach(k => form.elements[k].classList.add('invalid'));
        say(missing.includes('email') && data.email ? 'Please check your email address.' : 'Please fill in your name, email and message.', 'error');
        return;
      }
      if (data.website || Date.now() - opened < 3000) { say('Thanks, your message was sent.', 'ok'); form.reset(); return; }
      if (!site.contactUrl) { say(`Messages can't be sent from here yet. Please email ${site.profile.email}.`, 'error'); return; }
      button.disabled = true; say('Sending…');
      try {
        const reply = await fetch(site.contactUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // a simple request: no CORS preflight
          body: JSON.stringify({ kind: 'contact', name: data.name.trim(), email: data.email.trim(), topic: data.topic,
                                 message: data.message.trim(), page: location.href })
        });
        const result = await reply.json();
        if (!result.ok) throw new Error(result.error || 'not accepted');
        form.reset();
        say("Thanks, your message was sent. I'll reply by email.", 'ok');
      } catch (err) {
        say(`That didn't go through. Please try again, or email ${site.profile.email}.`, 'error');
      } finally {
        button.disabled = false;
      }
    });
  }

  function renderHome(site) {
    $('#about-text').innerHTML = site.about.map(p => `<p>${esc(p)}</p>`).join('');
    $('#education').innerHTML = site.education.map(e =>
      `<li><strong>${esc(e.title)}</strong><span class="when">${esc(e.when)}</span><span class="place">${esc(e.place)}</span></li>`).join('');
    $('#experience-list').innerHTML = site.experience.map(j => `
      <article class="job reveal">
        <header><h3>${esc(j.title)} <span>· ${esc(j.place)}</span></h3><span class="when">${esc(j.when)}</span></header>
        <ul>${j.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        ${tags(j.tags || [])}
      </article>`).join('');
    $('#skills-list').innerHTML = site.skills.map(g =>
      `<div class="skill-group reveal"><h3>${esc(g.group)}</h3>${tags(g.items)}</div>`).join('');
    $('#project-cards').innerHTML = site.projects.filter(p => p.featured !== false).map(p => {
      const shot = (p.screenshots || [])[0];
      const thumb = shot ? `<div class="thumb"><img src="${esc(shot.src)}" alt="" loading="lazy"></div>`
                         : `<div class="thumb empty">${esc(p.title)}</div>`;
      const free = /free/i.test(p.status) ? ' free' : '';
      return `<a class="card reveal" href="project.html?p=${encodeURIComponent(p.slug)}">
        ${thumb}<span class="badge${free}">${esc(p.status)}</span>
        <h3>${esc(p.title)}</h3><p>${esc(p.tagline)}</p>${tags(p.tech.slice(0, 5))}
        <span class="more">View project →</span></a>`;
    }).join('');
    loadDownloads(site);
    loadReviews(site);
  }

  function renderProject(site) {
    const slug = new URLSearchParams(location.search).get('p');
    const p = site.projects.find(x => x.slug === slug);
    const root = $('#project');
    if (!p) { root.innerHTML = '<p>That project isn\'t here. <a href="index.html#projects">See all projects</a>.</p>'; return; }
    document.title = `${p.title} · ${site.profile.name}`;
    const links = [
      p.download ? `<a class="button primary" href="${esc(p.download)}">Download</a>` : '',
      p.repo ? `<a class="button" href="${esc(p.repo)}" target="_blank" rel="noopener">View code on GitHub</a>` : ''
    ].join('');
    const gallery = (p.screenshots || []).length
      ? `<div class="gallery">${p.screenshots.map((s, i) =>
          `<button type="button" data-i="${i}"><img src="${esc(s.src)}" alt="${esc(s.caption)}" loading="lazy"><span>${esc(s.caption)}</span></button>`).join('')}</div>`
      : '<p class="placeholder">Screenshots are on their way.</p>';
    root.innerHTML = `
      <div class="eyebrow"><span>Project</span><span class="badge">${esc(p.status)}</span></div>
      <h1>${esc(p.title)}</h1>
      <p class="tagline">${esc(p.tagline)}</p>
      <div class="links">${links}</div>
      <div class="project-grid">
        <div class="body">
          ${p.summary.map(s => `<p>${esc(s)}</p>`).join('')}
          ${(p.highlights || []).length ? `<h2>Highlights</h2><div class="job"><ul>${p.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
          <h2>Screenshots</h2>${gallery}
          ${p.video ? `<h2>Demo</h2>${videoHtml(p.video)}` : ''}
          ${p.linkedinPost ? `<h2>On LinkedIn</h2>${linkedinHtml(p.linkedinPost)}` : ''}
        </div>
        <aside class="facts">
          <h3>Built with</h3>${tags(p.tech)}
          <h3>My role</h3><p>${esc(p.role)}</p>
          ${p.repo ? `<h3>Code</h3><p><a href="${esc(p.repo)}" target="_blank" rel="noopener">${esc(p.repo.replace('https://', ''))}</a></p>` : ''}
        </aside>
      </div>`;
    const box = $('#lightbox');
    root.querySelectorAll('.gallery button').forEach(b => b.addEventListener('click', () => {
      const s = p.screenshots[+b.dataset.i];
      $('img', box).src = s.src; $('p', box).textContent = s.caption; box.hidden = false;
    }));
    box.addEventListener('click', () => { box.hidden = true; });
    addEventListener('keydown', e => { if (e.key === 'Escape') box.hidden = true; });
  }

  // A YouTube link becomes the YouTube player; anything else is played as a video file.
  function videoHtml(url) {
    const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
    if (yt) return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="Demo video" allowfullscreen loading="lazy"></iframe></div>`;
    return `<div class="video"><video src="${esc(url)}" controls preload="metadata"></video></div>`;
  }

  // LinkedIn's "Embed this post" link, or a post link with its activity number.
  function linkedinHtml(url) {
    let src = url;
    const urn = url.match(/urn:li:(?:share|activity|ugcPost):\d+/) || url.match(/activity-(\d+)/);
    if (urn) src = 'https://www.linkedin.com/embed/feed/update/' + (urn[0].startsWith('urn') ? urn[0] : 'urn:li:activity:' + urn[1]);
    if (!/linkedin\.com\/embed/.test(src)) return `<p><a href="${esc(url)}" target="_blank" rel="noopener">Read the post on LinkedIn →</a></p>`;
    return `<div class="linkedin-post"><iframe src="${esc(src)}" title="LinkedIn post" loading="lazy"></iframe></div>`;
  }

  // The latest release's setups, straight from GitHub (falls back to the plain link if that fails).
  async function loadDownloads(site) {
    try {
      const r = await fetch(`https://api.github.com/repos/${site.ndalamo.repo}/releases/latest`);
      if (!r.ok) return;
      const rel = await r.json();
      const setups = rel.assets.filter(a => a.name.endsWith('.exe'));
      if (!setups.length) return;
      const full = setups.find(a => /LibreOffice/i.test(a.name));
      const small = setups.find(a => a !== full);
      const mb = a => Math.round(a.size / 1048576) + ' MB';
      $('#downloads').innerHTML = [
        full ? `<a class="button primary" href="${esc(full.browser_download_url)}">Download <small>with LibreOffice · ${mb(full)}</small></a>` : '',
        small ? `<a class="button" href="${esc(small.browser_download_url)}">NdalamoPDF only <small>${mb(small)}</small></a>` : ''
      ].join('');
      const count = setups.reduce((n, a) => n + a.download_count, 0);
      $('#download-facts').textContent = `Version ${rel.tag_name.replace(/^v/, '')} · Windows 10 and 11, 64-bit · Free, with no ads`
        + (count >= 100 ? ` · ${count.toLocaleString()} downloads` : '');
    } catch (e) { /* the plain link stays */ }
  }

  // Reviews the owner chose to show (the spreadsheet script returns only those).
  async function loadReviews(site) {
    if (!site.ndalamo.reviewsUrl) return;
    try {
      const data = await (await fetch(site.ndalamo.reviewsUrl)).json();
      const list = (data.reviews || []).slice(0, site.ndalamo.reviewsShown || 3);
      if (!list.length) return;
      $('#review-list').innerHTML = list.map(r => `
        <figure class="review"><div class="stars" aria-label="${r.stars} of 5 stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</div>
        ${r.review ? `<blockquote>${esc(r.review)}</blockquote>` : ''}<figcaption>${esc(r.date || '')}</figcaption></figure>`).join('');
      if (data.average) $('#rating').textContent = `★ ${data.average.toFixed(1)} from ${data.count} reviews`;
      $('#reviews').hidden = false;
    } catch (e) { /* no reviews shown */ }
  }

  function reveal() {
    const items = document.querySelectorAll('.reveal, .section-title, .spotlight-card, .timeline li');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('shown')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('reveal', 'shown'); io.unobserve(e.target); }
    }), { threshold: .12 });
    items.forEach(i => { i.classList.add('reveal'); io.observe(i); });
  }
})();
