  function dashCard(icon, count, label, space, view){
    return `
      <div class="dash-card" data-goto-space="${space}" data-goto-view="${view}">
        <div class="dash-card-icon">${icon}</div>
        <div class="dash-card-count">${count}</div>
        <div class="dash-card-label">${esc(label)}</div>
      </div>`;
  }
  const ACTIVITY_ICONS = { debit:'📐', mfg:'🏭', folders:'📁', trips:'🚗', spacing:'📏', notes:'📝', recipes:'🍽️' };
  const ACTIVITY_LABELS = { debit:'Fiche de débit', mfg:'Analyse de fabrication', folders:'Dossier', trips:'Trajet', spacing:'Répartition', notes:'Note', recipes:'Recette' };
  function getRecentActivity(limit){
    const items = [];
    state.debitSheets.forEach(s => items.push({ type:'debit', label: s.title||'(sans titre)', date: s.updatedAt||s.date, id:s.id }));
    state.manufacturingSheets.forEach(s => items.push({ type:'mfg', label: s.title||'(sans titre)', date: s.updatedAt||s.date, id:s.id }));
    state.folders.forEach(f => items.push({ type:'folders', label: f.title||'(sans titre)', date: f.updatedAt||f.date, id:f.id }));
    state.trips.forEach(t => items.push({ type:'trips', label: t.title||'(sans titre)', date: t.updatedAt||t.date, id:t.id }));
    state.spacings.forEach(s => items.push({ type:'spacing', label: s.title||'(sans titre)', date: s.updatedAt||s.date, id:s.id }));
    state.notes.forEach(n => items.push({ type:'notes', label: noteDisplayTitle(n), date: n.updatedAt||n.createdAt, id:n.id }));
    state.recipes.forEach(r => items.push({ type:'recipes', label: recipeDisplayTitle(r), date: r.updatedAt||r.createdAt, id:r.id }));
    return items
      .filter(i => i.date && state.settings.enabledFeatures[i.type] !== false)
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit);
  }
  function goToItem(type, id){
    const def = FEATURE_DEFS.find(f => f.key === type);
    if(!def) return;
    switchSpace(def.space);
    switchView(type);
    if(type === 'suppliers'){ if(id) selectedSupplierId = id; }
    else if(type === 'debit'){ selectedSheetId = id; }
    else if(type === 'mfg'){ selectedMfgId = id; }
    else if(type === 'folders'){ selectedFolderId = id; }
    else if(type === 'trips'){ selectedTripId = id; }
    else if(type === 'spacing'){ selectedSpacingId = id; }
    else if(type === 'notes'){ selectedNoteId = id; }
    else if(type === 'recipes'){ selectedRecipeId = id; }
    else if(type === 'hours'){ if(id){ selectedWeekStart = id; hoursExpandDate(id); } }
    else if(type === 'budget'){ if(id){ const parts = id.split('-'); selectedBudgetMonth = { year: parseInt(parts[0],10), month: parseInt(parts[1],10) }; } }
    else if(type === 'gifts'){ selectedPersonId = id; }
    else if(type === 'vehicles'){ selectedVehicleId = id; }
    else if(type === 'surveys'){ selectedSurveyId = id; }
    else if(type === 'gallery'){ selectedAlbumId = id; }
    else if(type === 'meals'){ if(id) mealsWeekStart = id; }
    render();
  }

  // ---------- recherche universelle (accueil) ----------
  function universalSearchResults(qRaw){
    const q = qRaw.trim().toLowerCase();
    if(q.length < 2) return [];
    const has = s => (s||'').toLowerCase().includes(q);
    const groups = [];
    // On ne propose que les rubriques actives dans Fonctionnalites
    const actif = k => state.settings.enabledFeatures[k] !== false;
    const push = (label, icon, items, key) => { if(items.length && (!key || actif(key))) groups.push({ label, icon, items }); };

    push('Fournisseurs', '🏭', state.suppliers.filter(s => {
      if(has(s.name) || has(s.category)) return true;
      return (s.products||[]).some(p => has(p.name) || (p.comments||[]).some(cm => has(cm.text)));
    }).slice(0,5).map(s => ({ type:'suppliers', id:s.id, title:s.name||'(sans nom)', meta:s.category||'' })), 'suppliers');

    push('Fiches de débit', '📋', state.debitSheets.filter(sh => has(sh.title)||has(sh.client)||has(sh.reference))
      .slice(0,5).map(sh => ({ type:'debit', id:sh.id, title:sh.title||'(sans titre)', meta:[sh.reference, sh.client].filter(Boolean).join(' · ') })), 'debit');

    push('Analyses de fabrication', '⚙️', state.manufacturingSheets.filter(sh => has(sh.title)||has(sh.client)||has(sh.reference))
      .slice(0,5).map(sh => ({ type:'mfg', id:sh.id, title:sh.title||'(sans titre)', meta:[sh.reference, sh.client].filter(Boolean).join(' · ') })), 'mfg');

    push('Dossiers', '📁', state.folders.filter(f => has(f.title)||has(f.client)||has(f.note))
      .slice(0,5).map(f => ({ type:'folders', id:f.id, title:f.title||'(sans titre)', meta:f.client||'' })), 'folders');

    push('Trajets', '🚗', state.trips.filter(t => has(t.title)||has(t.note))
      .slice(0,5).map(t => ({ type:'trips', id:t.id, title:t.title||'(sans titre)', meta:'' })), 'trips');

    push('Répartitions', '📐', state.spacings.filter(s => has(s.title)||has(s.note))
      .slice(0,5).map(s => ({ type:'spacing', id:s.id, title:s.title||'(sans titre)', meta:'' })), 'spacing');

    push('Notes', '📝', state.notes.filter(n => has(n.title)||has(n.content))
      .slice(0,5).map(n => ({ type:'notes', id:n.id, title:noteDisplayTitle(n), meta:relativeDate(n.updatedAt||n.createdAt) })), 'notes');

    push('Recettes', '🍳', state.recipes.filter(r => has(r.title) || (r.ingredients||[]).some(i => has(i.text)))
      .slice(0,5).map(r => ({ type:'recipes', id:r.id, title:r.title||'(sans titre)', meta:'' })), 'recipes');

    push('Heures', '⏱️', state.hoursWeeks.filter(w => has(w.reference) || (w.days||[]).some(d => (d.chantiers||[]).some(ch => has(ch.name))))
      .slice(0,5).map(w => {
        const chantiers = new Set();
        (w.days||[]).forEach(d => (d.chantiers||[]).forEach(ch => { if(has(ch.name)) chantiers.add(ch.name); }));
        return { type:'hours', id:w.weekStart, title:'Semaine du ' + new Date(w.weekStart).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}), meta: Array.from(chantiers).slice(0,2).join(', ') || (w.reference||'') };
      }), 'hours');

    push('Budget', '💸', state.budgetEntries.filter(e => has(e.label)||has(e.category))
      .slice(0,5).map(e => {
        const d = new Date(e.date);
        return { type:'budget', id:`${d.getFullYear()}-${d.getMonth()}`, title:e.label||'(sans libellé)', meta:budgetFmt(e.amount) + ' · ' + HOURS_MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear() };
      }), 'budget');

    push('Courses', '🛒', state.shoppingItems.filter(i => has(i.name))
      .slice(0,5).map(i => ({ type:'shopping', id:'', title:i.name, meta:i.checked ? 'coché ✓' : '' })), 'shopping');

    push('Cadeaux', '🎁', state.people.filter(p => has(p.name) || (p.gifts||[]).some(g => has(g.label) || has(g.note)))
      .slice(0,5).map(p => ({ type:'gifts', id:p.id, title:p.name||'(sans nom)', meta:(p.gifts||[]).length + ' idée(s) cadeau' })), 'gifts');

    push('Véhicules', '🚙', state.vehicles.filter(v => has(v.name)||has(v.brand)||has(v.model)||has(v.plate))
      .slice(0,5).map(v => ({ type:'vehicles', id:v.id, title:v.name||'(sans nom)', meta:[v.brand, v.model].filter(Boolean).join(' ') })), 'vehicles');

    push('Relevés', '📏', state.surveys.filter(s => has(s.title)||has(s.location)||has(s.client))
      .slice(0,5).map(s => ({ type:'surveys', id:s.id, title:s.title||'(sans titre)', meta:[s.client, s.location].filter(Boolean).join(' · ') })), 'surveys');

    push('Galerie', '🖼️', state.albums.filter(a => has(a.name)||has(a.client))
      .slice(0,5).map(a => ({ type:'gallery', id:a.id, title:a.name||'(sans nom)', meta:(a.photos||[]).length + ' photo(s)' })), 'gallery');

    const mealHits = [];
    Object.keys(state.meals||{}).forEach(weekIso => {
      Object.values(state.meals[weekIso] || {}).forEach(cell => {
        if(cell && cell.text && has(cell.text)){
          mealHits.push({ type:'meals', id: weekIso, title: cell.text, meta: 'Semaine du ' + new Date(weekIso).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) });
        }
      });
    });
    push('Repas', '🍽️', mealHits.slice(0,5), 'meals');

    return groups;
  }

  function renderHomeSearchResults(){
    const wrap = document.getElementById('homeSearchResults');
    const input = document.getElementById('homeSearchInput');
    if(!wrap || !input) return;
    const q = input.value;
    if(q.trim().length < 2){ wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    const groups = universalSearchResults(q);
    wrap.style.display = 'block';
    if(!groups.length){
      wrap.innerHTML = `<div class="empty-side" style="padding:4px 2px;">Aucun résultat pour « ${esc(q.trim())} ».</div>`;
      return;
    }
    wrap.innerHTML = groups.map(g => `
      <div class="search-group-title">${g.icon} ${g.label}</div>
      ${g.items.map(it => `
        <div class="search-result-item" data-search-type="${it.type}" data-search-id="${esc(String(it.id))}">
          <span class="search-result-title">${esc(it.title)}</span>
          ${it.meta ? `<span class="search-result-meta">${esc(it.meta)}</span>` : ''}
        </div>`).join('')}
    `).join('');
    wrap.querySelectorAll('[data-search-type]').forEach(el => {
      el.addEventListener('click', () => goToItem(el.dataset.searchType, el.dataset.searchId));
    });
  }
  function renderHomeMain(){
    const main = document.getElementById('homeMainArea');
    if(!main) return;
    const now = new Date();
    const greetingDate = now.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
    const companyName = (state.company && state.company.name) ? esc(state.company.name) : 'RF — Espace Perso & Pro';
    const sortedNotes = state.notes.slice().sort((a,b) => {
      if(!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
      return new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt);
    });
    const hs = state.settings.homeSections || {};
    const showSec = k => hs[k] !== false;

    main.innerHTML = `
      <div class="home-greeting">
        <div class="home-greeting-icon">👋</div>
        <div>
          <h2>${companyName}</h2>
          <p>${greetingDate}</p>
        </div>
      </div>

      ${showSec('search') ? `
      <div class="home-search-wrap">
        <input class="search" id="homeSearchInput" placeholder="🔍 Rechercher partout : fournisseurs, notes, dossiers, heures…" autocomplete="off" style="margin-bottom:0;">
        <div id="homeSearchResults" class="home-search-results" style="display:none;"></div>
      </div>` : ''}

      ${showSec('quickNote') ? `
      <div class="home-quick-add">
        <input type="text" id="homeQuickNoteInput" placeholder="Note rapide… (Entrée pour ajouter)">
        <button class="btn btn-gold" id="btnHomeQuickAdd">+ Ajouter</button>
      </div>` : ''}

      ${showSec('notes') ? `
      <div class="dash-section-title">
        <span>Notes</span>
        <span class="dash-count-badge">${state.notes.length}</span>
      </div>
      <div class="home-notes-grid">
        ${sortedNotes.length ? sortedNotes.map(n => `
          <div class="home-note-card" data-activity-type="notes" data-activity-id="${n.id}">
            <div class="home-note-card-title">${esc(noteDisplayTitle(n))}</div>
            <div class="home-note-card-preview">${esc(notePreview(n))}</div>
            <div class="home-note-card-date">${relativeDate(n.updatedAt||n.createdAt)}</div>
          </div>
        `).join('') : `<div class="empty-side">Aucune note pour l'instant — écris ta première ci-dessus.</div>`}
      </div>` : ''}
    `;

    const quickInput = document.getElementById('homeQuickNoteInput');
    const quickAdd = () => {
      const text = quickInput.value.trim();
      if(!text) return;
      const nowIso = new Date().toISOString();
      state.notes.unshift({ id: uid(), title:'', content:text, createdAt:nowIso, updatedAt:nowIso });
      save();
      quickInput.value = '';
      renderHomeMain();
      renderNotesSidebar();
      toast('Note ajoutée ✓');
    };
    if(quickInput){
      document.getElementById('btnHomeQuickAdd').addEventListener('click', quickAdd);
      quickInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); quickAdd(); } });
    }

    const searchInputHome = document.getElementById('homeSearchInput');
    if(searchInputHome){
      searchInputHome.addEventListener('input', renderHomeSearchResults);
      searchInputHome.addEventListener('keydown', e => {
        if(e.key === 'Escape'){ searchInputHome.value = ''; renderHomeSearchResults(); }
      });
    }

    main.querySelectorAll('[data-goto-space]').forEach(card => {
      card.addEventListener('click', () => {
        switchSpace(card.dataset.gotoSpace);
        switchView(card.dataset.gotoView);
      });
    });
    main.querySelectorAll('[data-activity-type]').forEach(item => {
      item.addEventListener('click', () => goToItem(item.dataset.activityType, item.dataset.activityId));
    });
  }

  // ---------- bibliothèques machines / étapes ----------
  function renderLibraryModal(){
    const machineList = document.getElementById('machineChipList');
    const stepList = document.getElementById('stepChipList');
    const pieceList = document.getElementById('pieceChipList');
    const materialList = document.getElementById('materialChipList');
    const marginList = document.getElementById('marginChipList');
    const byName = (a,b) => a.name.localeCompare(b.name, 'fr');
    const byNumber = (a,b) => parseFloat(a.name) - parseFloat(b.name);
    if(machineList) machineList.innerHTML = (state.machines||[]).slice().sort(byName).map(m => `
      <span class="lib-chip">${esc(m.name)}<button type="button" data-remove-machine="${m.id}" title="Retirer">&times;</button></span>
    `).join('') || `<span style="font-size:12px; color:var(--text-dim);">Aucune machine.</span>`;
    if(stepList) stepList.innerHTML = (state.operationSteps||[]).slice().sort(byName).map(s => `
      <span class="lib-chip">${esc(s.name)}<button type="button" data-remove-step="${s.id}" title="Retirer">&times;</button></span>
    `).join('') || `<span style="font-size:12px; color:var(--text-dim);">Aucune étape.</span>`;
    if(pieceList) pieceList.innerHTML = (state.pieceLibrary||[]).slice().sort(byName).map(p => `
      <span class="lib-chip">${esc(p.name)}<button type="button" data-remove-piece="${p.id}" title="Retirer">&times;</button></span>
    `).join('') || `<span style="font-size:12px; color:var(--text-dim);">Aucune pièce.</span>`;
    if(materialList) materialList.innerHTML = (state.materialLibrary||[]).slice().sort(byName).map(m => `
      <span class="lib-chip">${esc(m.name)}<button type="button" data-remove-material="${m.id}" title="Retirer">&times;</button></span>
    `).join('') || `<span style="font-size:12px; color:var(--text-dim);">Aucun matériau.</span>`;
    if(marginList) marginList.innerHTML = (state.marginLibrary||[]).slice().sort(byNumber).map(m => `
      <span class="lib-chip">${esc(m.name)} %<button type="button" data-remove-margin="${m.id}" title="Retirer">&times;</button></span>
    `).join('') || `<span style="font-size:12px; color:var(--text-dim);">Aucune marge.</span>`;
  }
  function openLibraryModal(){
    renderLibraryModal();
    document.getElementById('libraryModal').style.display = 'flex';
  }
  function closeLibraryModal(){
    document.getElementById('libraryModal').style.display = 'none';
  }

  // ---------- paramètres ----------
  function applyTheme(){
    document.documentElement.setAttribute('data-theme', state.settings.darkMode ? 'dark' : 'light');
    if(state.settings.accentColor){ document.documentElement.style.setProperty('--gold', state.settings.accentColor); }
    else { document.documentElement.style.removeProperty('--gold'); }
  }
  function applyFontSize(){
    document.body.setAttribute('data-fontsize', state.settings.fontSize || 'normal');
  }
  function applyContrast(){
    document.documentElement.setAttribute('data-contrast', state.settings.highContrast ? 'high' : 'normal');
  }
  function getStorageUsageBytes(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Blob([raw]).size : 0;
    }catch(e){ return 0; }
  }
  function formatBytes(bytes){
    if(bytes < 1024) return bytes + ' o';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' Ko';
    return (bytes/1024/1024).toFixed(2) + ' Mo';
  }
  function renderStorageGauge(){
    const label = document.getElementById('storageGaugeLabel');
    const fill = document.getElementById('storageGaugeFill');
    if(!label || !fill) return;
    const bytes = getStorageUsageBytes();
    const baseline = 5 * 1024 * 1024; // 5 Mo, quota minimum courant des navigateurs
    const pct = Math.min(100, (bytes / baseline) * 100);
    label.textContent = `${formatBytes(bytes)} utilisés sur ~5 Mo (${pct.toFixed(0)} %) — le quota exact varie selon le navigateur.`;
    fill.style.width = pct + '%';
    fill.classList.remove('warn','danger');
    if(pct >= 85) fill.classList.add('danger');
    else if(pct >= 60) fill.classList.add('warn');
  }
  function populateDefaultMarginSelect(){
    const sel = document.getElementById('defaultMarginSelect');
    if(!sel) return;
    const margins = (state.marginLibrary||[]).map(m => m.name).sort((a,b) => parseFloat(a) - parseFloat(b));
    sel.innerHTML = `<option value="">Aucune</option>` + margins.map(n => `<option value="${esc(n)}">${esc(n)} %</option>`).join('');
    sel.value = state.settings.defaultMargin || '';
  }
  // ---------- fonctionnalités (activer/désactiver des onglets) ----------
  function renderFeaturesModal(){
    const wrap = document.getElementById('featuresListWrap');
    if(!wrap) return;
    const isOn = k => state.settings.enabledFeatures[k] !== false;
    const essential = FEATURE_DEFS.filter(f => ESSENTIAL_FEATURES.includes(f.key));
    const extra = FEATURE_DEFS.filter(f => !ESSENTIAL_FEATURES.includes(f.key));
    const spaceName = s => s === 'professional' ? 'Pro' : 'Perso';

    function row(f, showSpace){
      return `
        <div class="setting-row">
          <div>
            <div class="setting-label" data-feature-label="${f.key}">${esc(f.label)}</div>
            ${showSpace ? `<div class="setting-desc">${spaceName(f.space)}</div>` : ''}
          </div>
          <label class="switch"><input type="checkbox" data-feature-toggle="${f.key}" ${isOn(f.key) ? 'checked' : ''}><span class="switch-slider"></span></label>
        </div>`;
    }
    const activeExtra = extra.filter(f => isOn(f.key)).length;

    wrap.innerHTML = `
      <div class="feature-actions">
        <button class="btn btn-line" id="btnFeaturesEssential">\u2728 Garder l'essentiel</button>
        <button class="btn btn-line" id="btnFeaturesAll">Tout activer</button>
      </div>

      <div class="section-label" style="margin-top:14px;"><span>Essentiel</span></div>
      <div class="feature-hint">Ce que tu utilises au quotidien. Recommand\u00e9 de le laisser actif.</div>
      ${essential.map(f => row(f, true)).join('')}

      <div class="section-label" style="margin-top:18px;"><span>Compl\u00e9mentaire <span class="dash-count-badge">${activeExtra} actif${activeExtra>1?'s':''}</span></span></div>
      <div class="feature-hint">D\u00e9sactive ce dont tu ne te sers pas : les onglets dispara\u00eetront de la barre. Tes donn\u00e9es sont conserv\u00e9es et reviennent si tu r\u00e9actives.</div>
      ${extra.map(f => row(f, true)).join('')}`;

    // Raccourcis
    document.getElementById('btnFeaturesEssential').addEventListener('click', () => {
      FEATURE_DEFS.forEach(f => { state.settings.enabledFeatures[f.key] = ESSENTIAL_FEATURES.includes(f.key); });
      markLocalEdit(); save(); render(); renderFeaturesModal();
      toast('Affichage simplifi\u00e9 \u2014 seul l\u2019essentiel reste visible');
    });
    document.getElementById('btnFeaturesAll').addEventListener('click', () => {
      FEATURE_DEFS.forEach(f => { state.settings.enabledFeatures[f.key] = true; });
      markLocalEdit(); save(); render(); renderFeaturesModal();
      toast('Toutes les fonctionnalit\u00e9s activ\u00e9es');
    });
  }
  function openFeaturesModal(){
    renderFeaturesModal();
    document.getElementById('featuresModal').style.display = 'flex';
  }
  function closeFeaturesModal(){
    document.getElementById('featuresModal').style.display = 'none';
  }

  function openSettingsModal(){
    document.getElementById('toggleDarkMode').checked = !!state.settings.darkMode;
    document.getElementById('fontSizeSelect').value = state.settings.fontSize || 'normal';
    document.getElementById('toggleHighContrast').checked = !!state.settings.highContrast;
    document.getElementById('toggleFicheStatus').checked = !!state.settings.ficheStatusEnabled;
    document.getElementById('defaultFicheStatusSelect').value = state.settings.defaultFicheStatus || 'brouillon';
    document.getElementById('toggleDimensionAlerts').checked = !!state.settings.dimensionAlertsEnabled;
    populateDefaultMarginSelect();
    const currentCurrency = state.settings.currency || '€';
    const currencySelect = document.getElementById('currencySelect');
    const currencyCustomInput = document.getElementById('currencyCustomInput');
    const presetValues = Array.from(currencySelect.options).map(o => o.value).filter(v => v !== '__custom__');
    if(presetValues.includes(currentCurrency)){
      currencySelect.value = currentCurrency;
      currencyCustomInput.style.display = 'none';
    } else {
      currencySelect.value = '__custom__';
      currencyCustomInput.value = currentCurrency;
      currencyCustomInput.style.display = 'block';
    }
    renderStorageGauge();
    document.getElementById('settingsModal').style.display = 'flex';
  }
  function closeSettingsModal(){
    document.getElementById('settingsModal').style.display = 'none';
  }

  // ---------- paramètres entreprise ----------
  let pendingLogo = undefined; // undefined = inchangé, null = supprimé, string = nouveau logo
  function renderLogoPreview(){
    const wrap = document.getElementById('logoPreviewWrap');
    if(!wrap) return;
    const logo = pendingLogo !== undefined ? pendingLogo : (state.company && state.company.logo);
    wrap.innerHTML = logo
      ? `<img src="${resolvePhotoSrc(logo)}" data-photo-ref="${esc(logo)}" alt="Logo entreprise"><button type="button" class="btn btn-danger" id="btnRemoveLogo">Retirer</button>`
      : `<span style="font-size:12px; color:var(--text-dim);">Aucun logo</span>`;
    const removeBtn = document.getElementById('btnRemoveLogo');
    if(removeBtn) removeBtn.addEventListener('click', () => { pendingLogo = null; renderLogoPreview(); });
  }
  function openCompanyModal(){
    const c = state.company || {};
    document.getElementById('companyName').value = c.name || '';
    document.getElementById('companyAddress').value = c.address || '';
    document.getElementById('companyPhone').value = c.phone || '';
    document.getElementById('companyEmail').value = c.email || '';
    document.getElementById('companySiret').value = c.siret || '';
    pendingLogo = undefined;
    renderLogoPreview();
    document.getElementById('companyModal').style.display = 'flex';
  }
  function closeCompanyModal(){
    document.getElementById('companyModal').style.display = 'none';
  }

  // ---------- events ----------

  const VIEW_LAYOUT_MAP = { home:'layoutHome', suppliers:'layoutSuppliers', debit:'layoutDebit', mfg:'layoutMfg', folders:'layoutFolders', trips:'layoutTrips', spacing:'layoutSpacing', notes:'layoutNotes', recipes:'layoutRecipes', hours:'layoutHours', budget:'layoutBudget', shopping:'layoutShopping', stats:'layoutStats', gallery:'layoutGallery', vehicles:'layoutVehicles', fuel:'layoutFuel', surveys:'layoutSurveys', gifts:'layoutGifts', meals:'layoutMeals' };
  const SPACE_DEFAULT_VIEW = { professional:'suppliers', personal:'trips' };

  function switchView(viewName){
    currentView = viewName;
    document.querySelectorAll('.view-tab').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
    Object.entries(VIEW_LAYOUT_MAP).forEach(([view, layoutId]) => {
      const el = document.getElementById(layoutId);
      if(el) el.style.display = (view === viewName) ? 'flex' : 'none';
    });
    const shownEl = document.getElementById(VIEW_LAYOUT_MAP[viewName]);
    if(shownEl){
      shownEl.classList.remove('view-fade-in');
      void shownEl.offsetWidth; // force reflow pour rejouer l'animation
      shownEl.classList.add('view-fade-in');
    }
    renderCurrentView();
    applyEditLock();
    // Le bouton Notes s'allume quand la vue Notes est ouverte
    const nb = document.getElementById('btnNotesSpace');
    if(nb){
      const onNotes = viewName === 'notes';
      nb.classList.toggle('active', onNotes);
      document.querySelectorAll('.space-btn[data-space]').forEach(b =>
        b.classList.toggle('active', !onNotes && b.dataset.space === currentSpace));
    }
    refreshSpaceButtons();
  }

  function applyFeatureVisibility(){
    FEATURE_DEFS.forEach(f => {
      const tab = document.querySelector(`.view-tab[data-view="${f.key}"]`);
      if(!tab) return;
      const spaceMatches = f.space === currentSpace;
      const featureEnabled = state.settings.enabledFeatures[f.key] !== false;
      tab.style.display = (spaceMatches && featureEnabled) ? '' : 'none';
    });
  }

  // Un espace vide (toutes ses fonctionnalites desactivees) ne s'affiche plus
  function refreshSpaceButtons(){
    ['professional','personal'].forEach(sp => {
      const btn = document.querySelector(`.space-btn[data-space="${sp}"]`);
      if(!btn) return;
      const any = FEATURE_DEFS.some(f => f.space === sp && state.settings.enabledFeatures[f.key] !== false);
      btn.style.display = any ? '' : 'none';
    });
  }

  function switchSpace(spaceName){
    if(spaceName === 'home'){
      currentSpace = 'home';
      document.querySelectorAll('.space-btn').forEach(b => b.classList.toggle('active', b.dataset.space === 'home'));
      document.querySelectorAll('.view-tab').forEach(b => { b.style.display = 'none'; });
      switchView('home');
      return;
    }
    currentSpace = spaceName;
    state.settings.activeSpace = spaceName;
    save();
    document.querySelectorAll('.space-btn').forEach(b => b.classList.toggle('active', b.dataset.space === spaceName));
    applyFeatureVisibility();
    const spaceFeatures = FEATURE_DEFS.filter(f => f.space === spaceName && state.settings.enabledFeatures[f.key] !== false);
    const stillValid = spaceFeatures.some(f => f.key === currentView);
    const targetView = stillValid ? currentView : (spaceFeatures[0] ? spaceFeatures[0].key : SPACE_DEFAULT_VIEW[spaceName]);
    switchView(targetView);
  }

  document.getElementById('btnNotesSpace').addEventListener('click', () => {
    switchSpace('personal');
    switchView('notes');
    render();
  });
  document.querySelectorAll('.space-btn[data-space]').forEach(btn => {
    btn.addEventListener('click', () => switchSpace(btn.dataset.space));
  });

  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('mfgSearchInput').addEventListener('input', renderMfgSidebar);

  bindListSelect('mfgList', 'mfg', id => { selectedMfgId = id; });

  document.getElementById('btnAddMfgSheet').addEventListener('click', () => {
    const sheet = {
      id: uid(),
      reference: '',
      title: 'Nouvelle analyse de fabrication',
      client: '',
      date: new Date().toISOString(),
      operator: '',
      note: '',
      linkedDebitSheetIds: [],
      operations: [newOperation(1)]
    };
    sheet.reference = generateMfgReference(state, sheet);
    addListItem('manufacturingSheets', sheet, id => { selectedMfgId = id; }, 'mfgTitle');
  });

  document.getElementById('folderSearchInput').addEventListener('input', renderFoldersSidebar);

  bindListSelect('folderList', 'folder', id => { selectedFolderId = id; });

  document.getElementById('btnAddFolder').addEventListener('click', () => {
    const folder = {
      id: uid(),
      reference: '',
      title: 'Nouveau dossier',
      client: '',
      date: new Date().toISOString(),
      note: '',
      debitSheetIds: [],
      mfgSheetIds: [],
      albumIds: [], hoursWeekIds: [], spacingIds: [], noteIds: []
    };
    folder.reference = generateFolderReference(state, folder);
    addListItem('folders', folder, id => { selectedFolderId = id; }, 'folderTitle');
  });

  document.getElementById('tripSearchInput').addEventListener('input', renderTripsSidebar);

  bindListSelect('tripList', 'trip', id => { selectedTripId = id; });

  document.getElementById('btnAddTrip').addEventListener('click', () => {
    const trip = {
      id: uid(),
      reference: '',
      title: 'Nouveau trajet',
      date: new Date().toISOString(),
      distanceKm: '',
      consumptionL100: '',
      fuelPrice: '',
      tollPrice: '',
      roundTrip: false,
      peopleCount: '',
      note: ''
    };
    trip.reference = generateTripReference(state, trip);
    addListItem('trips', trip, id => { selectedTripId = id; }, 'tripTitle');
  });

  document.getElementById('spacingSearchInput').addEventListener('input', renderSpacingsSidebar);

  bindListSelect('spacingList', 'spacing', id => { selectedSpacingId = id; });

  document.getElementById('btnAddSpacing').addEventListener('click', () => {
    const s = {
      id: uid(),
      reference: '',
      title: 'Nouvelle répartition',
      date: new Date().toISOString(),
      totalLength: '',
      elementWidth: '',
      elementCount: '',
      edgeSpace: true,
      note: ''
    };
    s.reference = generateSpacingReference(state, s);
    addListItem('spacings', s, id => { selectedSpacingId = id; }, 'spacingTitle');
  });

  document.getElementById('noteSearchInput').addEventListener('input', renderNotesSidebar);

  bindListSelect('noteList', 'note', id => { selectedNoteId = id; });

  document.getElementById('btnAddNote').addEventListener('click', () => {
    const now = new Date().toISOString();
    const n = { id: uid(), title: '', content: '', createdAt: now, updatedAt: now };
    addListItem('notes', n, id => { selectedNoteId = id; }, 'noteContent');
  });

  document.getElementById('recipeSearchInput').addEventListener('input', renderRecipesSidebar);

  bindListSelect('recipeList', 'recipe', id => { selectedRecipeId = id; });

  document.getElementById('btnAddRecipe').addEventListener('click', () => {
    const now = new Date().toISOString();
    const r = { id: uid(), title: '', ingredients: [newIngredient()], photos: [], comments: '', createdAt: now, updatedAt: now };
    addListItem('recipes', r, id => { selectedRecipeId = id; }, 'recipeTitle');
  });

  document.getElementById('hoursList').addEventListener('click', e => {
    const yearHeader = e.target.closest('[data-year-toggle]');
    if(yearHeader){
      const year = yearHeader.dataset.yearToggle;
      if(hoursExpandedYears.has(year)) hoursExpandedYears.delete(year);
      else hoursExpandedYears.add(year);
      renderHoursSidebar();
      return;
    }
    const monthHeader = e.target.closest('[data-month-toggle]');
    if(monthHeader){
      const monthKey = monthHeader.dataset.monthToggle;
      if(hoursExpandedMonths.has(monthKey)) hoursExpandedMonths.delete(monthKey);
      else hoursExpandedMonths.add(monthKey);
      renderHoursSidebar();
      return;
    }
    const item = e.target.closest('[data-week]');
    if(!item) return;
    selectedWeekStart = item.dataset.week;
    render();
  });
  document.getElementById('hoursList').addEventListener('keydown', e => {
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const toggleTarget = e.target.closest('[data-year-toggle], [data-month-toggle]');
    if(!toggleTarget) return;
    e.preventDefault();
    toggleTarget.click();
  });

  document.getElementById('btnHoursToday').addEventListener('click', () => {
    selectedWeekStart = mondayOf(new Date()).toISOString();
    hoursExpandDate(selectedWeekStart);
    render();
  });

  document.getElementById('btnAddPerson').addEventListener('click', () => {
    const p = { id: uid(), name: 'Nouveau proche', relation:'', birthday:'', likes:'', gifts: [] };
    addListItem('people', p, id => { selectedPersonId = id; }, 'gpName');
  });
  bindListSelect('personList', 'person', id => { selectedPersonId = id; });

  document.getElementById('btnAddSurvey').addEventListener('click', () => {
    const s = { id: uid(), title: 'Nouveau relev\u00e9', client:'', location:'',
                date: new Date().toISOString().slice(0,10), measures: [], sketch: null, bg: null, notes: '' };
    addListItem('surveys', s, id => { selectedSurveyId = id; }, 'svTitle');
  });
  document.getElementById('surveySearchInput').addEventListener('input', renderSurveySidebar);
  bindListSelect('surveyList', 'survey', id => { selectedSurveyId = id; });

  document.getElementById('btnAddVehicle').addEventListener('click', () => {
    const v = { id: uid(), name: 'Nouveau v\u00e9hicule', brand:'', model:'', plate:'', year:'', currentKm:'', entries: [] };
    addListItem('vehicles', v, id => { selectedVehicleId = id; }, 'vehName');
  });
  bindListSelect('vehicleList', 'vehicle', id => { selectedVehicleId = id; });

  document.getElementById('btnAddAlbum').addEventListener('click', () => {
    const album = { id: uid(), name: 'Nouveau chantier', client: '', date: new Date().toISOString().slice(0,10),
                    photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    addListItem('albums', album, id => { selectedAlbumId = id; }, 'albumName');
  });
  document.getElementById('albumSearchInput').addEventListener('input', renderAlbumSidebar);
  bindListSelect('albumList', 'album', id => { selectedAlbumId = id; });

  document.getElementById('budgetMonthList').addEventListener('click', e => {
    const yt = e.target.closest('[data-budget-year-toggle]');
    if(yt){
      const yr = parseInt(yt.dataset.budgetYearToggle, 10);
      if(budgetExpandedYears.has(yr)) budgetExpandedYears.delete(yr); else budgetExpandedYears.add(yr);
      renderBudgetSidebar();
      return;
    }
    const item = e.target.closest('[data-budget-month]');
    if(!item) return;
    const [y, m] = item.dataset.budgetMonth.split('-');
    selectedBudgetMonth = { year: parseInt(y, 10), month: parseInt(m, 10) };
    budgetCategoryFilter = '';
    renderBudgetSidebar();
    renderBudgetMain();
  });

  document.getElementById('btnBudgetToday').addEventListener('click', () => {
    const now = new Date();
    selectedBudgetMonth = { year: now.getFullYear(), month: now.getMonth() };
    budgetCategoryFilter = '';
    budgetExpandedYears.add(now.getFullYear());
    renderBudgetSidebar();
    renderBudgetMain();
  });

  document.addEventListener('click', e => {
    if(e.target.closest('#btnScanReceiptCam')){
      const inp = document.getElementById('receiptFileInputCam');
      if(inp){ inp.value = ''; inp.click(); }
    } else if(e.target.closest('#btnScanReceiptGallery')){
      const inp = document.getElementById('receiptFileInputGallery');
      if(inp){ inp.value = ''; inp.click(); }
    }
  });
  document.addEventListener('change', e => {
    if(e.target && (e.target.id === 'receiptFileInputCam' || e.target.id === 'receiptFileInputGallery') && e.target.files && e.target.files[0]){
      runReceiptOCR(e.target.files[0]);
    }
  });
  const closeReceipt = () => {
    const np = document.getElementById('numPad');
    if(np && np.style.display !== 'none'){ np.style.display = 'none'; document.body.style.paddingBottom = ''; }
    document.getElementById('receiptModal').style.display = 'none';
    receiptRows = [];
  };
  document.getElementById('btnReceiptClose').addEventListener('click', closeReceipt);
  document.getElementById('btnReceiptCancel').addEventListener('click', closeReceipt);
  document.getElementById('btnReceiptErrorClose').addEventListener('click', closeReceipt);
  document.getElementById('receiptModal').addEventListener('click', e => { if(e.target.id === 'receiptModal') closeReceipt(); });
  document.getElementById('receiptToggleAll').addEventListener('click', () => {
    const anyOff = receiptRows.some(r => !r.include);
    receiptRows.forEach(r => r.include = anyOff);
    renderReceiptRows();
  });
  document.getElementById('receiptAddRow').addEventListener('click', () => {
    receiptRows.push({ id: uid(), include: true, label: '', amount: 0, category: '' });
    renderReceiptRows();
  });
  document.getElementById('btnReceiptConfirm').addEventListener('click', () => {
    const dateVal = document.getElementById('receiptDate').value || new Date().toISOString().slice(0,10);
    const defCat = document.getElementById('receiptCategory').value.trim() || 'Autre';
    const chosen = receiptRows.filter(r => r.include && r.amount > 0);
    if(!chosen.length){ toast('Aucune ligne valide à ajouter.'); return; }
    const iso = new Date(dateVal + 'T12:00:00').toISOString();
    chosen.forEach(r => {
      const cat = (r.category && r.category.trim()) ? r.category.trim() : defCat;
      state.budgetEntries.push({ id: uid(), label: r.label.trim() || 'Dépense ticket', amount: r.amount, category: cat, date: iso, type: 'expense' });
    });
    const d = new Date(dateVal + 'T12:00:00');
    selectedBudgetMonth = { year: d.getFullYear(), month: d.getMonth() };
    budgetExpandedYears.add(d.getFullYear());
    save();
    closeReceipt();
    render();
    toast(chosen.length + (chosen.length > 1 ? ' dépenses ajoutées ✓' : ' dépense ajoutée ✓'));
  });

  ['supplierSortSelect','sheetSortSelect','noteSortSelect'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('change', render);
  });

  const fabBtn = document.getElementById('fabBtn');
  const fabMenu = document.getElementById('fabMenu');
  fabBtn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = fabMenu.style.display !== 'none';
    fabMenu.style.display = isOpen ? 'none' : 'flex';
    fabBtn.classList.toggle('fab-open', !isOpen);
  });
  document.addEventListener('click', e => {
    if(!e.target.closest('#fabMenu') && !e.target.closest('#fabBtn')){
      fabMenu.style.display = 'none';
      fabBtn.classList.remove('fab-open');
    }
  });
  fabMenu.querySelectorAll('[data-fab]').forEach(btn => {
    btn.addEventListener('click', () => {
      fabMenu.style.display = 'none';
      fabBtn.classList.remove('fab-open');
      const act = btn.dataset.fab;
      if(act === 'note'){ switchSpace('personal'); switchView('notes'); document.getElementById('btnAddNote')?.click(); }
      else if(act === 'budget'){ switchSpace('personal'); switchView('budget'); render(); setTimeout(() => document.getElementById('budgetLabel')?.focus(), 120); }
      else if(act === 'shopping'){ switchSpace('personal'); switchView('shopping'); render(); setTimeout(() => document.getElementById('shoppingNewItem')?.focus(), 120); }

    });
  });

  let numPadTarget = null;
  window.openNumPad = function(input){
    numPadTarget = input;
    const np = document.getElementById('numPad');
    np.style.display = 'grid';
    document.body.style.paddingBottom = (np.offsetHeight + 24) + 'px';
    setTimeout(() => { try{ input.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(_){} }, 60);
  };
  function closeNumPad(){
    document.getElementById('numPad').style.display = 'none';
    document.body.style.paddingBottom = '';
    numPadTarget = null;
  }
  document.getElementById('numPad').addEventListener('click', e => {
    const b = e.target.closest('button');
    if(!b || !numPadTarget) return;
    const k = b.dataset.np;
    const fire = () => numPadTarget.dispatchEvent(new Event('input', { bubbles: true }));
    if(k === 'ok'){ closeNumPad(); return; }
    if(k === 'back'){ numPadTarget.value = numPadTarget.value.slice(0, -1); fire(); return; }
    if(k === ','){
      if(!numPadTarget.value.includes(',')) numPadTarget.value += (numPadTarget.value ? ',' : '0,');
      fire();
      return;
    }
    numPadTarget.value += k;
    fire();
  });
  document.addEventListener('click', e => {
    const np = document.getElementById('numPad');
    if(np.style.display !== 'none' && numPadTarget && !e.target.closest('#numPad') && e.target !== numPadTarget) closeNumPad();
  });

  document.querySelectorAll('.accent-swatch').forEach(sw => {
    sw.classList.toggle('active', (state.settings.accentColor || '') === sw.dataset.accent);
    sw.addEventListener('click', () => {
      state.settings.accentColor = sw.dataset.accent || '';
      applyTheme();
      save();
      document.querySelectorAll('.accent-swatch').forEach(x => x.classList.toggle('active', x === sw));
    });
  });

  [['homeSecSearch','search'],['homeSecQuick','quickNote'],['homeSecNotes','notes']].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.checked = (state.settings.homeSections || {})[key] !== false;
    el.addEventListener('change', () => {
      const cur = state.settings.homeSections || {};
      cur[key] = el.checked;
      state.settings.homeSections = cur;
      save();
      renderHomeMain();
    });
  });

  const btnLogout = document.getElementById('btnCloudLogout');
  btnLogout.addEventListener('click', async () => {
    forgetUser();
    markSignedOut();
    if(sb){ try{ await sb.auth.signOut(); }catch(e){} }
    location.reload();
  });
  const btnLogin = document.getElementById('btnCloudLogin');
  btnLogin.addEventListener('click', () => {
    closeSettingsModal();
    setAuthMode('signin');
    showAuth();
  });
  function refreshCloudAccountRow(){
    const emailLbl = document.getElementById('cloudEmailLabel');
    if(cloudUser && cloudUser.email){
      emailLbl.textContent = 'Connecté : ' + cloudUser.email + ' — sauvegarde automatique.';
      btnLogout.style.display = '';
      btnLogin.style.display = 'none';
    } else {
      emailLbl.textContent = 'Non connecté — données locales à cet appareil.';
      btnLogout.style.display = 'none';
      btnLogin.style.display = '';
    }
  }

  document.getElementById('btnOpenTrash').addEventListener('click', () => {
    document.getElementById('settingsModal').style.display = 'none';
    renderTrashModal();
    document.getElementById('trashModal').style.display = 'flex';
  });

  // -------- Editeur de categories du budget --------
  let budgetCatsTab = 'expense';
  const BUDGET_TAB_LABEL = { expense:'d\u00e9pense', income:'revenu', investment:'investissement' };
  function renderBudgetCatsList(){
    const wrap = document.getElementById('budgetCatsList');
    if(!wrap) return;
    const cats = budgetCustomCats(budgetCatsTab);
    wrap.innerHTML = cats.length ? cats.map((cat, i) => `
      <div class="budget-cat-edit-row">
        <span class="budget-cat-edit-name">${budgetCatIcon(cat)} ${esc(cat)}</span>
        <button class="btn btn-line budget-cat-up" data-cat-up="${i}" ${i===0?'disabled':''} title="Monter">\u2191</button>
        <button class="budget-cat-del" data-cat-del="${esc(cat)}" title="Retirer">&times;</button>
      </div>`).join('') : `<div class="empty-side">Aucune cat\u00e9gorie \u2014 ajoutes-en une ci-dessous.</div>`;
    wrap.querySelectorAll('[data-cat-del]').forEach(btn => btn.addEventListener('click', () => {
      const arr = budgetCustomCats(budgetCatsTab).filter(x => x !== btn.dataset.catDel);
      setBudgetCustomCats(budgetCatsTab, arr);
      save(); renderBudgetCatsList();
    }));
    wrap.querySelectorAll('[data-cat-up]').forEach(btn => btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.catUp, 10);
      const arr = budgetCustomCats(budgetCatsTab).slice();
      if(i > 0){ [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setBudgetCustomCats(budgetCatsTab, arr); save(); renderBudgetCatsList(); }
    }));
  }
  function openBudgetCatsModal(){
    document.getElementById('settingsModal').style.display = 'none';
    document.getElementById('budgetCatsModal').style.display = 'flex';
    renderBudgetCatsList();
  }
  const closeBudgetCats = () => { document.getElementById('budgetCatsModal').style.display = 'none'; if(currentView === 'budget') render(); };
  document.getElementById('btnOpenBudgetCats').addEventListener('click', openBudgetCatsModal);
  document.getElementById('btnBudgetCatsClose').addEventListener('click', closeBudgetCats);
  document.getElementById('btnBudgetCatsDone').addEventListener('click', closeBudgetCats);
  document.getElementById('budgetCatsModal').addEventListener('click', e => { if(e.target.id === 'budgetCatsModal') closeBudgetCats(); });
  document.querySelectorAll('[data-cats-tab]').forEach(btn => btn.addEventListener('click', () => {
    budgetCatsTab = btn.dataset.catsTab;
    document.querySelectorAll('[data-cats-tab]').forEach(b => b.classList.toggle('active', b === btn));
    renderBudgetCatsList();
  }));
  function addBudgetCat(){
    const inp = document.getElementById('budgetCatNew');
    const val = inp.value.trim();
    if(!val) return;
    const arr = budgetCustomCats(budgetCatsTab).slice();
    if(!arr.some(x => x.toLowerCase() === val.toLowerCase())){ arr.push(val); setBudgetCustomCats(budgetCatsTab, arr); save(); }
    inp.value = '';
    renderBudgetCatsList();
    inp.focus();
  }
  document.getElementById('btnBudgetCatAdd').addEventListener('click', addBudgetCat);
  document.getElementById('budgetCatNew').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addBudgetCat(); } });
  bindConfirmDeleteButton(document.getElementById('btnBudgetCatsReset'), () => {
    setBudgetCustomCats(budgetCatsTab, budgetDefaultsFor(budgetCatsTab).slice());
    save(); renderBudgetCatsList();
    toast('Cat\u00e9gories ' + BUDGET_TAB_LABEL[budgetCatsTab] + ' r\u00e9tablies');
  }, 'R\u00e9tablir ?');
  const closeTrash = () => { document.getElementById('trashModal').style.display = 'none'; };
  document.getElementById('btnTrashModalClose').addEventListener('click', closeTrash);
  document.getElementById('btnTrashModalClose2').addEventListener('click', closeTrash);
  document.getElementById('trashModal').addEventListener('click', e => { if(e.target.id === 'trashModal') closeTrash(); });
  bindConfirmDeleteButton(document.getElementById('btnTrashEmpty'), () => {
    state.trash.forEach(t => collectTrashPhotoRefs(t.collection, t.item).forEach(deletePhotoRef));
    state.trash = [];
    save();
    renderTrashModal();
    toast('Corbeille vid\u00e9e');
  }, 'Vider ?');

  window.addEventListener('beforeunload', e => {
    const pending = ['budgetLabel','budgetAmount','homeQuickNoteInput','shoppingNewItem'].some(id => {
      const el = document.getElementById(id);
      return el && el.value.trim();
    });
    if(pending){ e.preventDefault(); e.returnValue = ''; }
  });

  // Acces cache a la salle d'arcade : tapoter rapidement le libelle "Galerie"
  // dans la fenetre Fonctionnalites (7 fois en moins de 3 secondes).
  let galleryTapCount = 0;
  let galleryTapTimer = null;
  document.getElementById('featuresListWrap').addEventListener('click', e => {
    const label = e.target.closest('[data-feature-label="gallery"]');
    if(!label) return;
    galleryTapCount++;
    clearTimeout(galleryTapTimer);
    galleryTapTimer = setTimeout(() => { galleryTapCount = 0; label.classList.remove('tap-hint'); }, 3000);

    // Retour discret a partir du 3e tapotement
    if(galleryTapCount >= 3 && galleryTapCount < 7){
      label.classList.add('tap-hint');
      label.style.transform = 'scale(' + (1 + galleryTapCount * 0.02) + ')';
    }
    if(galleryTapCount >= 7){
      galleryTapCount = 0;
      clearTimeout(galleryTapTimer);
      label.classList.remove('tap-hint');
      label.style.transform = '';
      document.getElementById('featuresModal').style.display = 'none';
      openArcadeModal();
    }
  });
  const closeTemplate = () => { document.getElementById('templateModal').style.display = 'none'; };
  document.getElementById('btnTemplateClose').addEventListener('click', closeTemplate);
  document.getElementById('btnTemplateCancel').addEventListener('click', closeTemplate);
  document.getElementById('templateModal').addEventListener('click', e => { if(e.target.id === 'templateModal') closeTemplate(); });

  document.getElementById('btnArcadeClose').addEventListener('click', () => { document.getElementById('arcadeModal').style.display = 'none'; arcadeCurrent = null; });
  document.getElementById('arcadeModal').addEventListener('click', e => { if(e.target.id === 'arcadeModal'){ document.getElementById('arcadeModal').style.display = 'none'; arcadeCurrent = null; } });
  document.getElementById('btnArcadeBack').addEventListener('click', arcadeShowMenu);
  document.querySelectorAll('[data-arcade]').forEach(btn => btn.addEventListener('click', () => {
    const g = btn.dataset.arcade;
    if(g === 'rpg'){ document.getElementById('arcadeModal').style.display = 'none'; arcadeCurrent = null; openGameModal(); }
    else arcadeStart(g);
  }));
  document.addEventListener('keydown', e => {
    if(arcadeCurrent !== 'g2048') return;
    const map = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
    if(map[e.key]){ e.preventDefault(); g2Move(map[e.key]); }
  });

  setInterval(() => {
    const el = document.getElementById('punchLiveDuration');
    if(el && state.punch && state.punch.status === 'in') el.textContent = hoursFormatDuration(punchElapsedMin() / 60);
  }, 20000);


  document.getElementById('btnManageLibraries').addEventListener('click', openLibraryModal);
  document.getElementById('btnManageLibrariesDebit').addEventListener('click', openLibraryModal);
  document.getElementById('btnLibraryModalClose').addEventListener('click', closeLibraryModal);
  document.getElementById('btnLibraryModalClose2').addEventListener('click', closeLibraryModal);
  document.getElementById('libraryModal').addEventListener('click', e => {
    if(e.target.id === 'libraryModal'){ closeLibraryModal(); return; }
    const rm = e.target.closest('[data-remove-machine]');
    if(rm){
      state.machines = state.machines.filter(m => m.id !== rm.dataset.removeMachine);
      save(); renderLibraryModal(); renderMfgMain();
      return;
    }
    const rs = e.target.closest('[data-remove-step]');
    if(rs){
      state.operationSteps = state.operationSteps.filter(s => s.id !== rs.dataset.removeStep);
      save(); renderLibraryModal(); renderMfgMain();
      return;
    }
    const rp = e.target.closest('[data-remove-piece]');
    if(rp){
      state.pieceLibrary = state.pieceLibrary.filter(p => p.id !== rp.dataset.removePiece);
      save(); renderLibraryModal(); renderSheetMain();
      return;
    }
    const rma = e.target.closest('[data-remove-material]');
    if(rma){
      state.materialLibrary = state.materialLibrary.filter(m => m.id !== rma.dataset.removeMaterial);
      save(); renderLibraryModal(); renderSheetMain();
      return;
    }
    const rmg = e.target.closest('[data-remove-margin]');
    if(rmg){
      state.marginLibrary = state.marginLibrary.filter(m => m.id !== rmg.dataset.removeMargin);
      save(); renderLibraryModal(); renderSheetMain();
      return;
    }
  });
  function addMachineFromInput(){
    const input = document.getElementById('newMachineInput');
    const name = input.value.trim();
    if(!name) return;
    state.machines = state.machines || [];
    state.machines.push({ id: uid(), name });
    input.value = '';
    save(); renderLibraryModal(); renderMfgMain();
  }
  function addStepFromInput(){
    const input = document.getElementById('newStepInput');
    const name = input.value.trim();
    if(!name) return;
    state.operationSteps = state.operationSteps || [];
    state.operationSteps.push({ id: uid(), name });
    input.value = '';
    save(); renderLibraryModal(); renderMfgMain();
  }
  function addPieceFromInput(){
    const input = document.getElementById('newPieceInput');
    const name = input.value.trim();
    if(!name) return;
    state.pieceLibrary = state.pieceLibrary || [];
    state.pieceLibrary.push({ id: uid(), name });
    input.value = '';
    save(); renderLibraryModal(); renderSheetMain();
  }
  function addMaterialFromInput(){
    const input = document.getElementById('newMaterialInput');
    const name = input.value.trim();
    if(!name) return;
    state.materialLibrary = state.materialLibrary || [];
    state.materialLibrary.push({ id: uid(), name });
    input.value = '';
    save(); renderLibraryModal(); renderSheetMain();
  }
  function addMarginFromInput(){
    const input = document.getElementById('newMarginInput');
    const raw = input.value.trim().replace('%','').replace(',','.');
    if(!raw || isNaN(parseFloat(raw))){ toast('Entre un pourcentage valide (ex. 12).'); return; }
    const name = String(parseFloat(raw));
    state.marginLibrary = state.marginLibrary || [];
    if(state.marginLibrary.some(m => m.name === name)){ input.value = ''; return; }
    state.marginLibrary.push({ id: uid(), name });
    input.value = '';
    save(); renderLibraryModal(); renderSheetMain();
  }
  document.getElementById('btnAddMachine').addEventListener('click', addMachineFromInput);
  document.getElementById('newMachineInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addMachineFromInput(); } });
  document.getElementById('btnAddStepToLibrary').addEventListener('click', addStepFromInput);
  document.getElementById('newStepInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addStepFromInput(); } });
  document.getElementById('btnAddPiece').addEventListener('click', addPieceFromInput);
  document.getElementById('newPieceInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addPieceFromInput(); } });
  document.getElementById('btnAddMaterial').addEventListener('click', addMaterialFromInput);
  document.getElementById('newMaterialInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addMaterialFromInput(); } });
  document.getElementById('btnAddMargin').addEventListener('click', addMarginFromInput);
  document.getElementById('newMarginInput').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addMarginFromInput(); } });

  document.getElementById('searchInput').addEventListener('input', e => {
    renderSidebar();
  });

  document.getElementById('brandHomeLink').addEventListener('click', () => { switchSpace('personal'); switchView('notes'); render(); });

  document.getElementById('btnMobileMenuToggle').addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('topActions').classList.toggle('mobile-open');
  });
  document.getElementById('topActions').addEventListener('click', e => {
    if(e.target.closest('button, label')){
      setTimeout(() => document.getElementById('topActions').classList.remove('mobile-open'), 150);
    }
  });
  document.addEventListener('click', e => {
    const topActions = document.getElementById('topActions');
    if(topActions.classList.contains('mobile-open') && !topActions.contains(e.target) && e.target.id !== 'btnMobileMenuToggle'){
      topActions.classList.remove('mobile-open');
    }
  });

  document.getElementById('btnSearchAll').addEventListener('click', () => {
    switchSpace('home');
    render();
    setTimeout(() => {
      const inp = document.getElementById('homeSearchInput');
      if(inp){ inp.value = ''; inp.focus(); renderHomeSearchResults(); }
    }, 90);
  });

  document.getElementById('btnFeatures').addEventListener('click', openFeaturesModal);
  document.getElementById('btnFeaturesModalClose').addEventListener('click', closeFeaturesModal);
  document.getElementById('btnFeaturesModalClose2').addEventListener('click', closeFeaturesModal);
  document.getElementById('featuresModal').addEventListener('click', e => {
    if(e.target.id === 'featuresModal') closeFeaturesModal();
  });
  document.getElementById('featuresListWrap').addEventListener('change', e => {
    const key = e.target.dataset.featureToggle;
    if(!key) return;
    const def = FEATURE_DEFS.find(f => f.key === key);
    const enabledSiblings = FEATURE_DEFS.filter(f => f.space === def.space && state.settings.enabledFeatures[f.key] !== false);
    if(!e.target.checked && enabledSiblings.length <= 1 && enabledSiblings[0]?.key === key){
      toast('Au moins une fonctionnalité doit rester active par espace.');
      e.target.checked = true;
      return;
    }
    state.settings.enabledFeatures[key] = e.target.checked;
    markLocalEdit();
    save();
    applyFeatureVisibility();
    refreshSpaceButtons();
    renderFeaturesModal();
    if(currentView === key && !e.target.checked){
      const fallback = FEATURE_DEFS.find(f => f.space === currentSpace && state.settings.enabledFeatures[f.key] !== false);
      if(fallback) switchView(fallback.key);
    }
  });

  document.getElementById('btnSettings').addEventListener('click', () => { openSettingsModal(); if(typeof refreshCloudAccountRow === 'function') refreshCloudAccountRow(); });
  document.getElementById('btnSettingsModalClose').addEventListener('click', closeSettingsModal);
  document.getElementById('btnSettingsModalClose2').addEventListener('click', closeSettingsModal);
  document.getElementById('settingsModal').addEventListener('click', e => {
    if(e.target.id === 'settingsModal') closeSettingsModal();
  });
  document.getElementById('toggleDarkMode').addEventListener('change', e => {
    state.settings.darkMode = e.target.checked;
    applyTheme();
    save();
  });
  document.getElementById('fontSizeSelect').addEventListener('change', e => {
    state.settings.fontSize = e.target.value;
    applyFontSize();
    save();
  });
  document.getElementById('toggleHighContrast').addEventListener('change', e => {
    state.settings.highContrast = e.target.checked;
    applyContrast();
    save();
  });
  document.getElementById('toggleFicheStatus').addEventListener('change', e => {
    state.settings.ficheStatusEnabled = e.target.checked;
    save();
    renderSheetMain(); renderSheetSidebar();
  });
  document.getElementById('defaultFicheStatusSelect').addEventListener('change', e => {
    state.settings.defaultFicheStatus = e.target.value;
    save();
  });
  document.getElementById('toggleDimensionAlerts').addEventListener('change', e => {
    state.settings.dimensionAlertsEnabled = e.target.checked;
    save();
  });
  document.getElementById('defaultMarginSelect').addEventListener('change', e => {
    state.settings.defaultMargin = e.target.value;
    save();
  });
  document.getElementById('currencySelect').addEventListener('change', e => {
    const customInput = document.getElementById('currencyCustomInput');
    if(e.target.value === '__custom__'){
      customInput.style.display = 'block';
      customInput.value = '';
      customInput.focus();
      return; // on attend une saisie avant d'enregistrer
    }
    customInput.style.display = 'none';
    state.settings.currency = e.target.value;
    save();
    renderTripsSidebar();
    renderTripMain();
  });
  document.getElementById('currencyCustomInput').addEventListener('change', e => {
    const val = e.target.value.trim();
    state.settings.currency = val || '€';
    e.target.value = state.settings.currency;
    save();
    renderTripsSidebar();
    renderTripMain();
  });

  document.getElementById('btnCompanySettings').addEventListener('click', openCompanyModal);
  document.getElementById('btnCompanyModalClose').addEventListener('click', closeCompanyModal);
  document.getElementById('btnCompanyModalClose2').addEventListener('click', closeCompanyModal);
  document.getElementById('companyModal').addEventListener('click', e => {
    if(e.target.id === 'companyModal') closeCompanyModal();
  });
  document.getElementById('companyLogoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if(!file) return;
    resizeLogo(file, dataUrl => { pendingLogo = dataUrl; renderLogoPreview(); });
  });
  document.getElementById('btnCompanySave').addEventListener('click', async () => {
    const oldLogo = state.company && state.company.logo;
    let newLogo = pendingLogo !== undefined ? pendingLogo : (oldLogo || null);
    if(newLogo && newLogo.startsWith('data:')) newLogo = await storePhoto(newLogo, 'logo');
    if(pendingLogo !== undefined && oldLogo && oldLogo !== newLogo) deletePhotoRef(oldLogo);
    state.company = {
      name: document.getElementById('companyName').value.trim(),
      address: document.getElementById('companyAddress').value.trim(),
      phone: document.getElementById('companyPhone').value.trim(),
      email: document.getElementById('companyEmail').value.trim(),
      siret: document.getElementById('companySiret').value.trim(),
      logo: newLogo
    };
    save();
    closeCompanyModal();
    toast('Coordonnées enregistrées ✓');
  });

  bindListSelect('supplierList', 'supplier', id => {
    selectedSupplierId = id;
    openProducts.clear();
    openNewCommentFor = null;
    openNewProductForm = false;
  });

  document.getElementById('btnAddSupplier').addEventListener('click', () => {
    const s = { id: uid(), name: 'Nouveau fournisseur', category: '', status: 'actif', phone: '', email: '', products: [] };
    addListItem('suppliers', s, id => { selectedSupplierId = id; });
    const input = document.querySelector('.name-input');
    if(input){ input.focus(); input.select(); }
  });

  document.getElementById('sheetSearchInput').addEventListener('input', renderSheetSidebar);

  bindListSelect('sheetList', 'sheet', id => { selectedSheetId = id; });

  document.getElementById('btnAddSheet').addEventListener('click', () => {
    const sheet = {
      id: uid(),
      reference: '',
      title: 'Nouvelle fiche de débit',
      client: '',
      date: new Date().toISOString(),
      operator: '',
      status: state.settings.defaultFicheStatus || 'brouillon',
      note: '',
      rows: [newRow(1)]
    };
    sheet.reference = generateSheetReference(state, sheet);
    addListItem('debitSheets', sheet, id => { selectedSheetId = id; }, 'sheetTitle');
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'registre-fournisseurs.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('Export téléchargé.');
  });

