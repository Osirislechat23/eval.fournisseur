  const MAINT_TYPES = [
    { key:'vidange',  label:'Vidange',            icon:'\ud83d\udee2\ufe0f', km:15000,  months:12 },
    { key:'revision', label:'R\u00e9vision',           icon:'\ud83d\udd27', km:30000,  months:24 },
    { key:'ct',       label:'Contr\u00f4le technique', icon:'\ud83d\udccb', km:null,   months:24 },
    { key:'pneus',    label:'Pneus',              icon:'\u2b55', km:40000,  months:null },
    { key:'freins',   label:'Freins',             icon:'\ud83d\uded1', km:40000,  months:null },
    { key:'courroie', label:'Courroie',           icon:'\u26d3\ufe0f', km:120000, months:null },
    { key:'assurance',label:'Assurance',          icon:'\ud83d\udee1\ufe0f', km:null,   months:12 },
    { key:'carburant',label:'Carburant',          icon:'\u26fd', km:null,   months:null },
    { key:'autre',    label:'Autre',              icon:'\ud83d\udd29', km:null,   months:null }
  ];
  function maintType(key){ return MAINT_TYPES.find(t => t.key === key) || MAINT_TYPES[MAINT_TYPES.length-1]; }
  function getVehicle(id){ return state.vehicles.find(v => v.id === id) || null; }

  function vehicleDueList(v){
    const currentKm = parseInt(v.currentKm, 10) || 0;
    const today = new Date();
    return MAINT_TYPES.filter(t => t.km || t.months).map(t => {
      const last = (v.entries||[]).filter(e => e.type === t.key)
        .sort((a,b) => new Date(b.date) - new Date(a.date))[0];
      if(!last) return { type:t, status:'unknown', last:null, kmLeft:null, daysLeft:null };
      let kmLeft = null, daysLeft = null;
      if(t.km && last.km) kmLeft = (parseInt(last.km,10) + t.km) - currentKm;
      if(t.months){
        const due = new Date(last.date);
        due.setMonth(due.getMonth() + t.months);
        daysLeft = Math.round((due - today) / 86400000);
      }
      let status = 'ok';
      if((kmLeft !== null && kmLeft <= 0) || (daysLeft !== null && daysLeft <= 0)) status = 'late';
      else if((kmLeft !== null && kmLeft <= 1500) || (daysLeft !== null && daysLeft <= 30)) status = 'soon';
      return { type:t, status, last, kmLeft, daysLeft };
    });
  }

  function renderVehicleSidebar(){
    renderListSidebar({
      listElId: 'vehicleList', dataAttr: 'vehicle',
      items: state.vehicles, selectedId: selectedVehicleId,
      matchQuery: () => true,
      emptyMessage: '<div class="empty-side">Aucun v\u00e9hicule. Ajoute ta camionnette ou ta voiture pour suivre son entretien.</div>',
      itemHtml: v => {
        const due = vehicleDueList(v);
        const late = due.filter(d => d.status === 'late').length;
        const soon = due.filter(d => d.status === 'soon').length;
        return `
        <div class="name">${esc(v.name || '(sans nom)')}</div>
        <div class="meta">${esc([v.brand, v.model].filter(Boolean).join(' '))}${v.plate ? ' \u00b7 ' + esc(v.plate) : ''}</div>
        <div class="meta">${(parseInt(v.currentKm,10)||0).toLocaleString('fr-FR')} km</div>
        ${late ? `<div class="veh-badge late">${late} en retard</div>` : (soon ? `<div class="veh-badge soon">${soon} bient\u00f4t</div>` : '')}`;
      }
    });
  }

  function renderVehicleMain(){
    const main = document.getElementById('vehicleMainArea');
    if(!main) return;
    const v = getVehicle(selectedVehicleId);
    if(!v){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucun v\u00e9hicule s\u00e9lectionn\u00e9</h2>
          <p>Suis les vidanges, r\u00e9visions, pneus et contr\u00f4les techniques de tes v\u00e9hicules, avec un rappel avant chaque \u00e9ch\u00e9ance.</p>
        </div>`;
      return;
    }
    const entries = (v.entries||[]).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    const due = vehicleDueList(v).filter(d => d.last);
    const totalCost = entries.reduce((s,e) => s + (parseFloat(e.cost)||0), 0);
    const yearCost = entries.filter(e => new Date(e.date).getFullYear() === new Date().getFullYear())
      .reduce((s,e) => s + (parseFloat(e.cost)||0), 0);
    const currentKm = parseInt(v.currentKm,10) || 0;
    const rank = { late:0, soon:1, ok:2, unknown:3 };

    main.innerHTML = `
      <div class="sheet-toolbar">
        <div><div class="section-label" style="margin-bottom:0;"><span>V\u00e9hicule</span></div></div>
        <div class="sheet-toolbar-actions">
          <button class="btn btn-danger" id="btnDeleteVehicle">Supprimer</button>
        </div>
      </div>

      <div class="sheet-header-form">
        <div class="field full"><label>Nom</label><input type="text" id="vehName" value="${esc(v.name||'')}" placeholder="ex. Camionnette atelier"></div>
        <div class="field"><label>Marque</label><input type="text" id="vehBrand" value="${esc(v.brand||'')}" placeholder="ex. Renault"></div>
        <div class="field"><label>Mod\u00e8le</label><input type="text" id="vehModel" value="${esc(v.model||'')}" placeholder="ex. Trafic"></div>
        <div class="field"><label>Immatriculation</label><input type="text" id="vehPlate" value="${esc(v.plate||'')}" placeholder="AB-123-CD"></div>
        <div class="field"><label>Ann\u00e9e</label><input type="text" id="vehYear" value="${esc(v.year||'')}" placeholder="2019"></div>
        <div class="field"><label>Kilom\u00e9trage actuel</label><input type="text" id="vehKm" value="${esc(String(v.currentKm||''))}" placeholder="128000" inputmode="none"></div>
      </div>

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Kilom\u00e9trage</span><span class="val">${currentKm.toLocaleString('fr-FR')} km</span></div>
        <div class="tot"><span class="lbl">Co\u00fbt cette ann\u00e9e</span><span class="val">${budgetFmt(yearCost)}</span></div>
        <div class="tot"><span class="lbl">Co\u00fbt total</span><span class="val">${budgetFmt(totalCost)}</span></div>
        <div class="tot"><span class="lbl">Interventions</span><span class="val">${entries.length}</span></div>
      </div>

      <div class="dash-section-title">\u00c9ch\u00e9ances</div>
      ${due.length ? `<div class="veh-due-list">
        ${due.sort((a,b) => rank[a.status] - rank[b.status]).map(d => {
          const parts = [];
          if(d.kmLeft !== null) parts.push(d.kmLeft > 0 ? 'dans ' + d.kmLeft.toLocaleString('fr-FR') + ' km' : 'd\u00e9pass\u00e9 de ' + Math.abs(d.kmLeft).toLocaleString('fr-FR') + ' km');
          if(d.daysLeft !== null) parts.push(d.daysLeft > 0 ? 'dans ' + d.daysLeft + ' j' : 'en retard de ' + Math.abs(d.daysLeft) + ' j');
          return `
          <div class="veh-due ${d.status}">
            <span class="veh-due-icon">${d.type.icon}</span>
            <div class="veh-due-body">
              <div class="veh-due-name">${d.type.label}</div>
              <div class="veh-due-meta">Dernier : ${fmtDate(d.last.date)}${d.last.km ? ' \u00b7 ' + parseInt(d.last.km,10).toLocaleString('fr-FR') + ' km' : ''}</div>
            </div>
            <div class="veh-due-status">${parts.join(' \u00b7 ') || '\u2014'}</div>
          </div>`;
        }).join('')}
      </div>` : '<div class="empty-side">Enregistre une premi\u00e8re intervention pour voir appara\u00eetre les \u00e9ch\u00e9ances.</div>'}

      <div class="dash-section-title">Ajouter une intervention</div>
      <div class="veh-add-form">
        <select id="vehNewType">${MAINT_TYPES.map(t => `<option value="${t.key}">${t.icon} ${t.label}</option>`).join('')}</select>
        <input type="date" id="vehNewDate" value="${new Date().toISOString().slice(0,10)}">
        <input type="text" id="vehNewKm" placeholder="Km" inputmode="none" value="${currentKm || ''}">
        <input type="text" id="vehNewCost" placeholder="Co\u00fbt \u20ac" inputmode="none">
        <input type="text" id="vehNewNote" placeholder="Note (garage, r\u00e9f\u00e9rence\u2026)">
        <button class="btn btn-gold" id="btnVehAddEntry">+ Ajouter</button>
      </div>

      <div class="dash-section-title">Historique <span class="dash-count-badge">${entries.length}</span></div>
      ${entries.length ? entries.map(e => {
        const t = maintType(e.type);
        return `
        <div class="veh-entry">
          <span class="veh-due-icon">${t.icon}</span>
          <div class="veh-due-body">
            <div class="veh-due-name">${t.label}${e.note ? ' \u2014 ' + esc(e.note) : ''}</div>
            <div class="veh-due-meta">${fmtDate(e.date)}${e.km ? ' \u00b7 ' + parseInt(e.km,10).toLocaleString('fr-FR') + ' km' : ''}</div>
          </div>
          <div class="veh-entry-cost">${e.cost ? budgetFmt(parseFloat(e.cost)) : ''}</div>
          <button class="veh-entry-del" data-del-entry="${e.id}" title="Supprimer">&times;</button>
        </div>`;
      }).join('') : '<div class="empty-side">Aucune intervention enregistr\u00e9e.</div>'}
    `;
    bindVehicleEvents(v);
    if(fuelPermission === 'unknown') checkFuelPermission().then(() => {
      if(fuelPermission === 'prompt' && currentView === 'vehicles'){ renderVehicleMain(); applyEditLock(); }
    });
  }

  function bindVehicleEvents(v){
    [['vehName','name'],['vehBrand','brand'],['vehModel','model'],['vehPlate','plate'],['vehYear','year']].forEach(pair => {
      const el = document.getElementById(pair[0]);
      if(el) el.addEventListener('input', () => { v[pair[1]] = el.value; save(); renderVehicleSidebar(); });
    });
    const kmEl = document.getElementById('vehKm');
    if(kmEl){
      kmEl.addEventListener('input', () => { v.currentKm = kmEl.value.replace(/\D/g,''); save(); });
      kmEl.addEventListener('blur', renderVehicleSidebar);
      ['focus','click'].forEach(ev => kmEl.addEventListener(ev, () => openNumPad(kmEl)));
    }
    ['vehNewKm','vehNewCost'].forEach(id => {
      const el = document.getElementById(id);
      if(el) ['focus','click'].forEach(ev => el.addEventListener(ev, () => openNumPad(el)));
    });

    const addBtn = document.getElementById('btnVehAddEntry');
    if(addBtn) addBtn.addEventListener('click', () => {
      const type = document.getElementById('vehNewType').value;
      const date = document.getElementById('vehNewDate').value || new Date().toISOString().slice(0,10);
      const km = document.getElementById('vehNewKm').value.replace(/\D/g,'');
      const cost = (document.getElementById('vehNewCost').value||'').replace(',','.');
      const note = document.getElementById('vehNewNote').value.trim();
      v.entries = v.entries || [];
      v.entries.push({ id: uid(), type, date: new Date(date + 'T12:00:00').toISOString(), km, cost, note });
      if(km && parseInt(km,10) > (parseInt(v.currentKm,10)||0)) v.currentKm = km;
      save(); renderVehicleSidebar(); renderVehicleMain(); applyEditLock();
      toast('Intervention enregistr\u00e9e \u2713');
    });

    document.querySelectorAll('[data-del-entry]').forEach(btn => bindConfirmDeleteButton(btn, () => {
      v.entries = (v.entries||[]).filter(e => e.id !== btn.dataset.delEntry);
      save(); renderVehicleSidebar(); renderVehicleMain(); applyEditLock();
      toast('Intervention supprim\u00e9e');
    }, '?'));

    bindConfirmDeleteButton(document.getElementById('btnDeleteVehicle'), () => {
      trashPut('vehicles', v.name, v);
      state.vehicles = state.vehicles.filter(x => x.id !== v.id);
      selectedVehicleId = state.vehicles[0]?.id ?? null;
      save(); render();
      toast('V\u00e9hicule supprim\u00e9');
    });
  }

  // ---------- galerie de chantiers ----------
  function getAlbum(id){ return state.albums.find(a => a.id === id) || null; }

  function renderAlbumSidebar(){
    renderListSidebar({
      listElId: 'albumList', searchElId: 'albumSearchInput', dataAttr: 'album',
      items: state.albums, selectedId: selectedAlbumId,
      sortFn: (a,b) => new Date(b.updatedAt||b.createdAt||0) - new Date(a.updatedAt||a.createdAt||0),
      matchQuery: (a, q) => (a.name||'').toLowerCase().includes(q) || (a.client||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucun chantier. Cr\u00e9e ton premier album pour y ranger les photos.</div>`,
      noMatchMessage: () => `<div class="empty-side">Aucun chantier ne correspond \u00e0 cette recherche.</div>`,
      itemClass: () => 'album-item',
      itemHtml: a => {
        const n = (a.photos||[]).length;
        const cover = (a.photos||[])[0];
        return `
        ${cover ? `<img class="album-thumb" src="${resolvePhotoSrc(cover.src)}" data-photo-ref="${esc(cover.src)}" alt="">` : `<div class="album-thumb album-thumb-empty">\ud83d\udcf7</div>`}
        <div class="album-item-body">
          <div class="name">${esc(a.name||'(sans nom)')}</div>
          <div class="meta">${esc(a.client||'')}</div>
          <div class="meta">${n} photo${n!==1?'s':''}</div>
        </div>`;
      }
    });
  }

  function renderGalleryMain(){
    const main = document.getElementById('galleryMainArea');
    if(!main) return;
    const album = getAlbum(selectedAlbumId);
    if(!album){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucun chantier s\u00e9lectionn\u00e9</h2>
          <p>Cr\u00e9e un album par chantier pour rassembler les photos d'avancement, les d\u00e9tails techniques et le r\u00e9sultat final.</p>
        </div>`;
      return;
    }
    const photos = album.photos || [];
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Chantier</span></div>
          <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">${photos.length} photo${photos.length!==1?'s':''} \u00b7 enregistr\u00e9es avec tes donn\u00e9es</div>
        </div>
        <div class="sheet-toolbar-actions">
          ${folderLinkControl('gallery', album.id)}
          <label class="btn btn-gold" style="cursor:pointer;">
            \ud83d\udcf7 Ajouter des photos
            <input type="file" id="albumPhotoInput" accept="image/*" multiple style="display:none;">
          </label>
          <button class="btn btn-danger" id="btnDeleteAlbum">Supprimer</button>
        </div>
      </div>

      <div class="sheet-header-form">
        <div class="field full">
          <label>Nom du chantier</label>
          <input type="text" id="albumName" value="${esc(album.name||'')}" placeholder="ex. R\u00e9novation cuisine Bellevue">
        </div>
        <div class="field">
          <label>Client</label>
          <input type="text" id="albumClient" value="${esc(album.client||'')}" placeholder="ex. M. Durand">
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="albumDate" value="${(album.date||'').slice(0,10)}">
        </div>
      </div>

      ${photos.length ? `
        <div class="gallery-grid">
          ${photos.map((ph, i) => `
            <figure class="gallery-cell">
              <img src="${resolvePhotoSrc(ph.src)}" data-photo-ref="${esc(ph.src)}" alt="${esc(ph.caption||'')}" data-gallery-open="${i}" loading="lazy">
              <figcaption>
                <input type="text" class="gallery-caption" data-caption="${ph.id}" value="${esc(ph.caption||'')}" placeholder="L\u00e9gende\u2026">
                <button class="gallery-del" data-del-photo="${ph.id}" title="Supprimer la photo">&times;</button>
              </figcaption>
            </figure>`).join('')}
        </div>
      ` : `<div class="empty-side">Aucune photo pour l'instant. Utilise \u00ab Ajouter des photos \u00bb pour d\u00e9marrer l'album.</div>`}
    `;
    bindGalleryEvents(album);
  }

  function bindGalleryEvents(album){
    const touch = () => { album.updatedAt = new Date().toISOString(); save(); };
    const nameEl = document.getElementById('albumName');
    if(nameEl) nameEl.addEventListener('input', () => { album.name = nameEl.value; touch(); renderAlbumSidebar(); });
    const clientEl = document.getElementById('albumClient');
    if(clientEl) clientEl.addEventListener('input', () => { album.client = clientEl.value; touch(); renderAlbumSidebar(); });
    const dateEl = document.getElementById('albumDate');
    if(dateEl) dateEl.addEventListener('change', () => { album.date = dateEl.value; touch(); });

    const input = document.getElementById('albumPhotoInput');
    if(input) input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      if(!files.length) return;
      let remaining = files.length;
      toast(files.length > 1 ? files.length + ' photos en cours d\u2019ajout\u2026' : 'Ajout de la photo\u2026');
      files.forEach(file => {
        resizeImage(file, async dataUrl => {
          const ref = await storePhoto(dataUrl, 'album');
          if(!Array.isArray(album.photos)) album.photos = [];
          album.photos.push({ id: uid(), src: ref, caption: '', addedAt: new Date().toISOString() });
          if(--remaining === 0){
            touch();
            renderAlbumSidebar();
            renderGalleryMain();
            toast('Photos ajout\u00e9es \u2713');
          }
        });
      });
      input.value = '';
    });

    document.querySelectorAll('[data-gallery-open]').forEach(img => img.addEventListener('click', async () => {
      const srcs = await Promise.all((album.photos||[]).map(p => getPhotoDataUrl(p.src)));
      openLightbox(srcs, parseInt(img.dataset.galleryOpen, 10));
    }));

    document.querySelectorAll('[data-caption]').forEach(el => el.addEventListener('input', () => {
      const ph = (album.photos||[]).find(p => p.id === el.dataset.caption);
      if(ph){ ph.caption = el.value; touch(); }
    }));

    document.querySelectorAll('[data-del-photo]').forEach(btn => bindConfirmDeleteButton(btn, () => {
      const removed = (album.photos||[]).find(p => p.id === btn.dataset.delPhoto);
      if(removed) deletePhotoRef(removed.src);
      album.photos = (album.photos||[]).filter(p => p.id !== btn.dataset.delPhoto);
      touch();
      renderAlbumSidebar();
      renderGalleryMain();
      toast('Photo supprim\u00e9e');
    }, '?'));

    bindConfirmDeleteButton(document.getElementById('btnDeleteAlbum'), () => {
      trashPut('albums', album.name, album);
      state.albums = state.albums.filter(a => a.id !== album.id);
      selectedAlbumId = state.albums[0]?.id ?? null;
      save(); render();
      toast('Chantier supprim\u00e9');
    });
  }

  // ---------- mode consultation / modification ----------
  // Un element deja enregistre s'ouvre en lecture seule : il faut appuyer sur
  // \u00ab Modifier \u00bb pour le changer. Cela evite les corrections involontaires
  // quand on consulte une fiche sur le chantier.
  let editUnlocked = false;
  let editLockKey = null;
  let forceUnlockNext = false;   // pose par les creations d'elements
  // Vues que l'on remplit au fil de l'eau : jamais verrouillees
  const ALWAYS_EDITABLE = new Set(['budget','shopping','stats','home','hours','meals','fuel']);

  function currentLockKey(){
    const ids = { suppliers:selectedSupplierId, debit:selectedSheetId, mfg:selectedMfgId,
                  folders:selectedFolderId, trips:selectedTripId, spacing:selectedSpacingId,
                  notes:selectedNoteId, recipes:selectedRecipeId, gallery:selectedAlbumId,
                  vehicles:selectedVehicleId, surveys:selectedSurveyId, gifts:selectedPersonId,
                  hours:selectedWeekStart };
    return currentView + ':' + (ids[currentView] == null ? '' : ids[currentView]);
  }
  function unlockEditing(){ editUnlocked = true; applyEditLock(); }
  function lockEditing(){ editUnlocked = false; applyEditLock(); }

  function applyEditLock(){
    const layoutId = VIEW_LAYOUT_MAP[currentView];
    const layout = layoutId ? document.getElementById(layoutId) : null;
    if(!layout) return;
    const main = layout.querySelector('.main');
    if(!main) return;

    const key = currentLockKey();
    if(key !== editLockKey){
      editLockKey = key;
      editUnlocked = forceUnlockNext;   // un element tout juste cree reste modifiable
    }
    forceUnlockNext = false;

    const alwaysOn = ALWAYS_EDITABLE.has(currentView);
    const locked = !alwaysOn && !editUnlocked;

    main.classList.toggle('view-locked', locked);
    main.querySelectorAll('input, textarea, select').forEach(el => {
      if(el.closest('.no-lock')) return;
      if(el.type === 'file'){ el.disabled = locked; return; }
      if(el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'date'){
        el.disabled = locked;
      } else {
        el.readOnly = locked;
      }
    });

    const bar = main.querySelector('.sheet-toolbar-actions');
    if(bar && !alwaysOn){
      let btn = bar.querySelector('.edit-lock-btn');
      if(!btn){
        btn = document.createElement('button');
        btn.className = 'btn edit-lock-btn no-lock';
        btn.addEventListener('click', () => { editUnlocked ? lockEditing() : unlockEditing(); });
        bar.insertBefore(btn, bar.firstChild);
      }
      btn.textContent = locked ? '\u270e Modifier' : '\u2713 Terminer';
      if(currentView === 'notes') setTimeout(autoGrowNote, 0);
      btn.classList.toggle('editing', !locked);
      btn.title = locked ? 'Passer en modification' : 'Revenir \u00e0 la lecture';
    }
  }

  // ---------- liaison des elements aux dossiers ----------
  const FOLDER_LINK_FIELDS = {
    debit:   'debitSheetIds',
    mfg:     'mfgSheetIds',
    hours:   'hoursWeekIds',
    spacing: 'spacingIds',
    notes:   'noteIds',
    gallery: 'albumIds',
    surveys: 'surveyIds'
  };

  // Dossiers auxquels un element est rattache
  function foldersLinkedTo(kind, id){
    const field = FOLDER_LINK_FIELDS[kind];
    if(!field || !id) return [];
    return state.folders.filter(f => (f[field] || []).includes(id));
  }

  function setFolderLink(kind, id, folderId){
    const field = FOLDER_LINK_FIELDS[kind];
    if(!field || !id) return;
    // Un element appartient a un seul dossier : on nettoie les autres
    state.folders.forEach(f => {
      f[field] = (f[field] || []).filter(x => x !== id);
    });
    if(folderId){
      const target = state.folders.find(f => f.id === folderId);
      if(target){
        if(!Array.isArray(target[field])) target[field] = [];
        target[field].push(id);
      }
    }
    save();
    // La vue Dossiers n'est pas reconstruite au changement d'onglet : on la met a jour ici
    renderFoldersSidebar();
    renderFolderMain();
  }

  // Petit selecteur discret, place dans la barre d'outils de chaque element
  function folderLinkControl(kind, id){
    if(!id) return '';
    const current = foldersLinkedTo(kind, id)[0];
    const label = current ? esc(current.title || current.reference || 'Dossier') : 'Aucun dossier';
    return `
      <div class="folder-link" title="Rattacher \u00e0 un dossier de chantier">
        <span class="folder-link-icon">\ud83d\udcc1</span>
        <select class="folder-link-select ${current ? 'linked' : ''}" data-folder-link="${kind}" data-folder-link-id="${esc(String(id))}">
          <option value="">Aucun dossier</option>
          ${state.folders.map(f => `<option value="${f.id}" ${current && current.id===f.id ? 'selected' : ''}>${esc(f.title || '(sans titre)')}${f.reference ? ' \u00b7 ' + esc(f.reference) : ''}</option>`).join('')}
        </select>
      </div>`;
  }

  // Un seul gestionnaire pour tous les selecteurs
  document.addEventListener('change', e => {
    const sel = e.target.closest('[data-folder-link]');
    if(!sel) return;
    setFolderLink(sel.dataset.folderLink, sel.dataset.folderLinkId, sel.value);
    sel.classList.toggle('linked', !!sel.value);
    toast(sel.value ? 'Rattach\u00e9 au dossier \u2713' : 'D\u00e9tach\u00e9 du dossier');
  });

  // ---------- corbeille ----------
  const TRASH_LABELS = { suppliers:'Fournisseur', debitSheets:'Fiche de d\u00e9bit', manufacturingSheets:'Analyse de fabrication', folders:'Dossier', trips:'Trajet', spacings:'R\u00e9partition', notes:'Note', recipes:'Recette', budgetEntries:'Budget' };
  function trashPut(collection, label, item){
    state.trash.push({ id: uid(), collection, label: label || '', item, deletedAt: new Date().toISOString() });
  }
  function renderTrashModal(){
    const wrap = document.getElementById('trashListWrap');
    if(!wrap) return;
    if(!state.trash.length){ wrap.innerHTML = `<div class="empty-side">La corbeille est vide.</div>`; return; }
    const items = state.trash.slice().sort((a,b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    wrap.innerHTML = items.map(t => `
      <div class="trash-item">
        <div class="trash-item-body">
          <div class="trash-item-label">${esc(t.label || '(sans titre)')}</div>
          <div class="trash-item-meta">${TRASH_LABELS[t.collection] || t.collection} \u00b7 supprim\u00e9 ${relativeDate(t.deletedAt)}</div>
        </div>
        <button class="btn btn-line" data-restore-trash="${t.id}" style="padding:4px 10px; font-size:12px;">\u21a9 Restaurer</button>
      </div>`).join('');
    wrap.querySelectorAll('[data-restore-trash]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = state.trash.find(x => x.id === btn.dataset.restoreTrash);
        if(!t) return;
        if(Array.isArray(state[t.collection])) state[t.collection].push(t.item);
        state.trash = state.trash.filter(x => x.id !== t.id);
        save(); render(); renderTrashModal();
        toast('\u00c9l\u00e9ment restaur\u00e9 \u2713');
      });
    });
  }

  // ---------- scan de ticket (OCR local) ----------
  let receiptRows = [];
  let receiptDeclaredTotal = null;
  let tesseractLoading = null;

  function loadTesseract(){
    if(window.Tesseract) return Promise.resolve(window.Tesseract);
    if(tesseractLoading) return tesseractLoading;
    tesseractLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error('load'));
      document.head.appendChild(s);
    });
    return tesseractLoading;
  }

  const CATEGORY_RULES = [
    ['Alimentation', /(pain|baguette|croissant|brioche|viennois|lait|beurre|margarine|oeuf|\u0153uf|yaourt|yogourt|fromage|emmental|comt\u00e9|comte|camembert|gruy\u00e8re|gruyere|jambon|saucisse|saucisson|lardon|p\u00e2t\u00e9|pate|rillette|pomme|poire|banane|orange|citron|raisin|fraise|l\u00e9gume|legume|fruit|salade|tomate|carotte|courgette|oignon|patate|pdt|pomme de terre|poireau|haricot|petit pois|\u00e9pinard|epinard|champignon|viande|boeuf|b\u0153uf|poulet|dinde|porc|steak|escalope|c\u00f4te|cote|merguez|poisson|saumon|thon|cabillaud|crevette|riz|p\u00e2tes|pates|semoule|bl\u00e9|ble|lentille|farine|sucre|sel|poivre|huile|vinaigre|moutarde|ketchup|mayo|cafe|caf\u00e9|the|th\u00e9|chocolat|cacao|biscuit|gateau|g\u00e2teau|bonbon|confiture|miel|c\u00e9r\u00e9ale|cereale|muesli|eau|jus|soda|coca|limonade|sirop|boisson|lessive|nettoyant|savon|shampoing|dentifrice|papier|mouchoir|essuie|sopalin|couche|conserve|surgel|glace|pizza|quiche|sandwich|chips|apero|ap\u00e9ro|olive|yaourt|cr\u00e8me|creme|dessert|compote|flan|beurre|epicerie|\u00e9picerie)/],
    ['Transport', /(essence|gasoil|gazole|diesel|sans plomb|carburant|super|station|p\u00e9age|peage|parking|stationnement|billet|train|sncf|ter|tgv|bus|tram|m\u00e9tro|metro|ticket|taxi|uber|blablacar|p\u00e9riph|autoroute|vignette|lavage auto|pneu|vidange|garage|contr\u00f4le technique|controle technique)/],
    ['Mat\u00e9riel', /(vis|clou|pointe|planche|tasseau|liteau|bois|ch\u00eane|chene|h\u00eatre|hetre|sapin|pin|scie|lame|perceuse|visseuse|foret|m\u00e8che|meche|ponce|abrasif|papier de verre|vernis|lasure|colle|mastic|silicone|peinture|enduit|pl\u00e2tre|platre|ciment|b\u00e9ton|beton|quincaill|outil|cheville|boulon|\u00e9crou|ecrou|rondelle|charni\u00e8re|charniere|gond|serrure|verrou|poign\u00e9e|poignee|brico|scierie|panneau|contreplaqu|cp|mdf|agglo|osb|m\u00e9lamin\u00e9|melamine|stratifi\u00e9|parquet|lambris|isolant|laine|placo|pl\u00e2que|plaque|tuyau|raccord|joint|c\u00e2ble|cable|gaine|fil \u00e9lec|prise|interrupteur|ampoule|led)/],
    ['Sant\u00e9', /(pharmacie|m\u00e9dicament|medicament|doliprane|dafalgan|parac\u00e9tamol|paracetamol|ibuprof\u00e8ne|ibuprofene|advil|spasfon|smecta|sirop|pansement|compresse|antiseptique|ordonnance|opticien|optic|lunette|verre|dentiste|m\u00e9decin|medecin|kin\u00e9|kine|labo|analyse|vitamine|complement|compl\u00e9ment|cr\u00e8me solaire|masque)/],
    ['Loisirs', /(cin\u00e9ma|cinema|resto|restaurant|brasserie|bar|pub|caf\u00e9|bi\u00e8re|biere|vin|ap\u00e9ritif|aperitif|jeu|jouet|livre|magazine|bd|sport|foot|piscine|salle de sport|fitness|concert|spectacle|mus\u00e9e|musee|parc|abonnement|netflix|spotify|disney|canal|deezer|mcdo|mcdonald|burger|kfc|quick|kebab|pizza|sushi|glacier)/],
    ['Logement', /(loyer|edf|engie|total energie|\u00e9lectricit\u00e9|electricite|gaz|eau|veolia|suez|internet|box|freebox|livebox|sfr|orange|bouygues|free|forfait|mobile|assurance|mutuelle|charges|syndic|taxe|imp\u00f4t|impot|meuble|d\u00e9co|deco|ikea|but|conforama|rideau|coussin|ampoule|lampe|electrom\u00e9nager|electromenager)/],
    ['V\u00eatements', /(v\u00eatement|vetement|pantalon|jean|chemise|t-shirt|tshirt|pull|veste|manteau|robe|jupe|chaussure|basket|botte|chaussette|sous-v\u00eatement|slip|culotte|soutien|ceinture|\u00e9charpe|echarpe|gant|bonnet|casquette|zara|h&m|kiabi|celio|jules|decathlon)/]
  ];
  function guessCategory(label){
    const s = (label || '').toLowerCase();
    for(const [cat, re] of CATEGORY_RULES) if(re.test(s)) return cat;
    return '';
  }
  const STORE_RULES = [
    ['Alimentation', /(carrefour|leclerc|e\.?leclerc|auchan|lidl|aldi|intermarch\u00e9|intermarche|super u|hyper u|u express|casino|monoprix|franprix|cora|netto|biocoop|grand frais|picard|g\u00e9ant|geant|match|colruyt|spar|proxi|boulangerie|boucherie|charcuterie|primeur|march\u00e9|marche|\u00e9picerie|epicerie|supermarch\u00e9|supermarche)/],
    ['Mat\u00e9riel', /(leroy merlin|brico ?d\u00e9p\u00f4t|brico ?depot|castorama|bricomarch\u00e9|bricomarche|mr\.? ?bricolage|weldom|point ?p|gedimat|bigmat|tridome|scierie|bois & ?mat|quincaillerie|self )/],
    ['Transport', /(totalenergies|total access|esso|\bbp\b|shell|avia|agip|station.?service|station essence|sncf|autoroute|p\u00e9age|peage|vinci autoroute|sanef|aprr)/],
    ['Sant\u00e9', /(pharmacie|parapharmacie|optic|optical|krys|afflelou|grand optical|laboratoire|labo )/],
    ['Loisirs', /(fnac|cultura|decathlon|d\u00e9cathlon|intersport|go sport|mcdonald|mc ?do|burger king|kfc|quick|restaurant|brasserie|cin\u00e9|cinema|gaumont|ugc|path\u00e9|pathe)/],
    ['Logement', /(ikea|but|conforama|maisons du monde|leroy|castorama|edf|engie|veolia|suez|free|orange|sfr|bouygues)/]
  ];
  function guessStoreCategory(text){
    const raw = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const header = [];
    for(const l of raw){
      if(/\d{1,4}[.,]\d{2}/.test(l)) break; // on s'arrete au 1er prix
      header.push(l);
      if(header.length >= 5) break;
    }
    const head = header.join(' ').toLowerCase();
    for(const [cat, re] of STORE_RULES) if(re.test(head)) return cat;
    return '';
  }
  // Prepare la photo pour l'OCR : redimensionne, niveaux de gris, seuillage adaptatif local.
  // C'est ce qui ameliore le plus la lecture des tickets (papier froisse, eclairage inegal).
  // Prepare la photo pour l'OCR.
  // mode 'gray'   : niveaux de gris + etirement de contraste + accentuation (peu destructeur)
  // mode 'binary' : + seuillage adaptatif local (utile si photo tres inegale)
  async function preprocessReceiptImage(file, mode){
    try {
      let bmp;
      try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      catch(_) { bmp = await createImageBitmap(file); }
      let w = bmp.width, h = bmp.height;
      if(!w || !h) return file;

      // Vise ~2000px sur le grand cote : assez de detail pour l'OCR
      const longSide = Math.max(w, h);
      const scale = Math.min(2.5, Math.max(1, 2000 / longSide));
      w = Math.round(w * scale); h = Math.round(h * scale);
      if(w * h > 16000000) return file;

      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, w, h);
      if(bmp.close) bmp.close();

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const n = w * h;
      const gray = new Uint8ClampedArray(n);
      const hist = new Uint32Array(256);
      for(let i = 0, p = 0; p < n; i += 4, p++){
        const g = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114) | 0;
        gray[p] = g; hist[g]++;
      }

      // Etirement de contraste. Sur un ticket le texte represente tres peu de pixels :
      // on prend des percentiles serres, et on retombe sur min/max si la plage est trop etroite.
      let trueMin = 255, trueMax = 0;
      for(let v = 0; v < 256; v++){
        if(hist[v]){ if(v < trueMin) trueMin = v; if(v > trueMax) trueMax = v; }
      }
      let lo = trueMin, hi = trueMax, acc = 0;
      const loCut = n * 0.005, hiCut = n * 0.995;
      for(let v = 0; v < 256; v++){ acc += hist[v]; if(acc >= loCut){ lo = v; break; } }
      acc = 0;
      for(let v = 0; v < 256; v++){ acc += hist[v]; if(acc >= hiCut){ hi = v; break; } }
      if(hi - lo < 40){ lo = trueMin; hi = trueMax; }   // securite : texte rare
      const span = Math.max(1, hi - lo);
      if(span > 8){
        for(let p = 0; p < n; p++){
          gray[p] = Math.max(0, Math.min(255, ((gray[p] - lo) * 255 / span) | 0));
        }
      }

      let out = gray;

      if(mode === 'binary'){
        // Seuillage adaptatif (Bradley) : fenetre large, seuil doux
        const iw = w + 1;
        const integral = new Float64Array(iw * (h + 1));
        for(let y = 0; y < h; y++){
          let rowSum = 0;
          for(let x = 0; x < w; x++){
            rowSum += gray[y * w + x];
            integral[(y+1) * iw + (x+1)] = integral[y * iw + (x+1)] + rowSum;
          }
        }
        const win = Math.max(16, Math.floor(w / 12));
        const half = win >> 1;
        const T = 0.94;
        const bin = new Uint8ClampedArray(n);
        for(let y = 0; y < h; y++){
          const y1 = Math.max(0, y - half), y2 = Math.min(h - 1, y + half);
          for(let x = 0; x < w; x++){
            const x1 = Math.max(0, x - half), x2 = Math.min(w - 1, x + half);
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const sum = integral[(y2+1)*iw + (x2+1)] - integral[y1*iw + (x2+1)] - integral[(y2+1)*iw + x1] + integral[y1*iw + x1];
            bin[y*w + x] = (gray[y*w + x] * count < sum * T) ? 0 : 255;
          }
        }
        out = bin;
      } else {
        // Accentuation legere (masque flou 3x3) pour les caracteres fins des tickets
        const sharp = new Uint8ClampedArray(n);
        for(let y = 0; y < h; y++){
          for(let x = 0; x < w; x++){
            const i0 = y*w + x;
            if(x === 0 || y === 0 || x === w-1 || y === h-1){ sharp[i0] = gray[i0]; continue; }
            const c0 = gray[i0];
            const around = gray[i0-1] + gray[i0+1] + gray[i0-w] + gray[i0+w];
            sharp[i0] = Math.max(0, Math.min(255, (c0 * 5 - around) | 0));
          }
        }
        out = sharp;
      }

      for(let p = 0, i = 0; p < n; p++, i += 4){
        d[i] = d[i+1] = d[i+2] = out[p]; d[i+3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      return blob || file;
    } catch(e){
      return file;
    }
  }

  // Reconstruit les lignes du ticket a partir de la position des mots (TSV de Tesseract).
  // Bien plus fiable que le texte brut, qui melange les colonnes prix/libelle.
  function linesFromTsv(tsv){
    if(!tsv) return null;
    const rows = tsv.split('\n');
    const groups = new Map();
    for(const r of rows){
      const f = r.split('\t');
      if(f.length < 12) continue;
      if(f[0] !== '5') continue;                 // niveau 5 = mot
      const conf = parseFloat(f[10]);
      const txt = (f[11] || '').trim();
      if(!txt || conf < 30) continue;            // on jette les mots peu surs
      const key = f[2] + '_' + f[3] + '_' + f[4]; // bloc_paragraphe_ligne
      const left = parseInt(f[6], 10), top = parseInt(f[7], 10), width = parseInt(f[8], 10);
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ txt, left, top, right: left + width });
    }
    const lines = [];
    for(const words of groups.values()){
      if(!words.length) continue;
      words.sort((a, b) => a.left - b.left);
      lines.push({
        text: words.map(w => w.txt).join(' '),
        top: Math.min(...words.map(w => w.top)),
        lastWord: words[words.length - 1].txt
      });
    }
    lines.sort((a, b) => a.top - b.top);
    return lines.length ? lines.map(l => l.text) : null;
  }

  function cleanLabel(raw){
    let s = raw
      .replace(/[|¥€£$#*»«~^_=]+/g, ' ')       // bruit OCR
      .replace(/\b[A-Z]?\d{6,}\b/g, ' ')         // codes-barres / references longues
      .replace(/\bsp\s?\d{2}\b/gi, ' ')          // SP95 / SP98 (avant le reste)
      .replace(/\b\d+\s*[x*]\s*\d+\b/gi, ' ')     // "4x40"
      .replace(/\b\d+([.,]\d+)?\s*(kg|g|l|ml|cl|pce?s?|un|u)\b/gi, ' ') // quantites/poids
      .replace(/\b\d+\s*[x*]\b/gi, ' ')           // "2x"
      .replace(/\s[x*]\s/gi, ' ')                 // "x" isole
      .replace(/[.\-–—:;,]+/g, ' ')
      .replace(/\bTVA\b.*/i, ' ')
      .replace(/\b(qt\u00e9|qte|qty|ref|r\u00e9f|prix|pu|montant|unit\u00e9|unite|art|article|remise|promo)\b/gi, ' ')
      .replace(/\b\d+[.,]\d{2}\s*[€]?\s*\/\s*(kg|l|pce?|un|u)\b/gi, ' ') // prix au kilo/litre
      .replace(/\b(eur|euro?s?)\s*\/\s*(kg|l|pce?|un|u)\b/gi, ' ')            // "EUR/KG"
      .replace(/\/\s*(kg|l|pce?|un|u)\b/gi, ' ')                               // "/KG"
      .replace(/\b(eur|euro?s?)\b/gi, ' ')                                      // "EUR"
      .replace(/\bbte\d*\b/gi, ' ')                                            // "BTE100\
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Enlever chiffres isoles en debut/fin
    s = s.replace(/^[\d\s]+/, '').replace(/[\d\s]+$/, '').replace(/\s+[a-z]$/i, '').trim();
    // Mise en forme : Majuscule initiale, minuscules pour les mots tout en capitales
    s = s.split(' ').map(w => {
      if(w.length > 1 && w === w.toUpperCase()) return w.charAt(0) + w.slice(1).toLowerCase();
      return w;
    }).join(' ').trim();
    if(s.length) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s;
  }
  // Corrige les confusions classiques de l'OCR dans les zones chiffrees
  function fixOcrDigits(s){
    const swap = t => t
      .replace(/[oO]/g, '0').replace(/[lI|]/g, '1').replace(/[sS]/g, '5')
      .replace(/[bB]/g, '6').replace(/[gG]/g, '9').replace(/[zZ]/g, '2');
    return (s || '')
      // Montants du type "2,4O" / "4,9S" / "l,85" : on corrige les 2 decimales et l'entier
      .replace(/\b([0-9OlIsSbBgGzZ|]{1,4})[.,]([0-9OlIsSbBgGzZ|]{2})(?![0-9])/g,
        (m, a, b2) => (/[0-9]/.test(a + b2) ? swap(a) + ',' + swap(b2) : m))
      // ";" mal lu a la place de la virgule (on ne touche PAS aux ":" des heures)
      .replace(/(\d);(\d{2})(?!\d)/g, '$1,$2');
  }

  function parseReceiptText(rawText){
    const text = fixOcrDigits(rawText || '');
    const lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 1);
    // Montant : gere le signe -, le symbole euro, et la lettre de taux de TVA collee
    const amountReG = /(-)?\s*(\d{1,4})[.,](\d{2})(?!\d)\s*(?:€|EUR)?\s*[a-dA-D]?(?![\d.,])/g;
    const totalRe = /\b(total|net [aà] payer|montant d[uû])\b/i;
    const ignoreRe = /(sous[- ]?total|^total|^tva|^t\.v\.a|rendu|monnaie|esp[eè]ce|carte|cb\b|change|solde|montant d[uû]|\bht\b|\bttc\b|\bnet [aà] payer|paiement|caisse|ticket|merci|au revoir|siret|n°|tel[:\s]|www\.|\.fr|\.com|nombre d.article|nb article|nb d.art|articles?\s*:|fid[eé]lit|points?\b|cagnotte|00\d{3,})/i;
    const storeCat = guessStoreCategory(text);
    const rows = [];
    let declaredTotal = null;

    const usedLabelLine = new Set();   // evite de donner 2 fois le meme nom
    const dateTimeOnlyRe = /^[\s\d\/.:\-hH]+$/;   // ligne composee uniquement d'une date/heure

    lines.forEach((line, li) => {
      // Lignes purement date/heure : jamais des articles
      if(dateTimeOnlyRe.test(line)) return;
      // Tous les montants de la ligne
      const found = [];
      let mm; amountReG.lastIndex = 0;
      while((mm = amountReG.exec(line)) !== null){
        found.push({ neg: !!mm[1], value: parseFloat(mm[2] + '.' + mm[3]), index: mm.index });
      }
      if(!found.length) return;

      // Ligne de total : on la retient pour verification, sans en faire un article
      if(totalRe.test(line) && !/sous[- ]?total/i.test(line)){
        const t = found[found.length - 1].value;
        if(t > 0 && (declaredTotal === null || t > declaredTotal)) declaredTotal = t;
      }

      // Le montant retenu = le plus a droite (total de ligne, pas le prix unitaire)
      let chosen = found[found.length - 1];
      // Cas "3 x 1,50  4,50" : si le dernier vaut ~ quantite x un des precedents, c'est bien lui
      // Cas "1,50 x 3" (total absent) : on multiplie
      const qtyMatch = line.match(/\b(\d{1,2})\s*[x*]\s*(?=\d)/i);
      if(qtyMatch && found.length === 1){
        const q = parseInt(qtyMatch[1], 10);
        if(q > 1 && q <= 50) chosen = { neg: chosen.neg, value: +(chosen.value * q).toFixed(2), index: chosen.index };
      }

      let amount = chosen.value;
      if(amount <= 0 || amount > 10000) return;
      // Remise / montant negatif
      const isDiscount = chosen.neg || /remise|promo|r[eé]duction|avoir/i.test(line);

      let label = cleanLabel(line.slice(0, chosen.index));
      const alphaLen = s => s.replace(/[^a-zA-Zà-ÿ]/g, '').length;
      const usableLine = i => i >= 0 && i < lines.length && !usedLabelLine.has(i)
        && !/\d{1,4}[.,]\d{2}/.test(lines[i]) && !dateTimeOnlyRe.test(lines[i])
        && alphaLen(cleanLabel(lines[i])) >= 3;
      if(alphaLen(label) < 3){
        // Le nom est sur la ligne du dessus, ou du dessous si celle du dessus est deja prise
        if(usableLine(li - 1)){ label = cleanLabel(lines[li-1]); usedLabelLine.add(li - 1); }
        else if(usableLine(li + 1)){ label = cleanLabel(lines[li+1]); usedLabelLine.add(li + 1); }
      }
      if(alphaLen(label) < 2) label = 'Article';

      const looksNoise = ignoreRe.test(line);
      const cat = guessCategory(label) || storeCat;
      rows.push({
        id: uid(),
        include: !looksNoise && !isDiscount,
        isDiscount,
        label: label.slice(0, 60),
        amount,
        category: cat
      });
    });

    // ---- Date : plusieurs formats ----
    let date = null;
    const MONTHS_FR = ['janv','f[eé]vr','mars','avr','mai','juin','juil','ao[uû]t','sept','oct','nov','d[eé]c'];
    const dm = text.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
    const dIso = text.match(/(20\d{2})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
    if(dm){
      let y = dm[3]; if(y.length === 2) y = '20' + y;
      const mo = Math.min(12, Math.max(1, parseInt(dm[2],10)));
      const da = Math.min(31, Math.max(1, parseInt(dm[1],10)));
      date = `${y}-${String(mo).padStart(2,'0')}-${String(da).padStart(2,'0')}`;
    } else if(dIso){
      date = `${dIso[1]}-${String(Math.min(12,Math.max(1,parseInt(dIso[2],10)))).padStart(2,'0')}-${String(Math.min(31,Math.max(1,parseInt(dIso[3],10)))).padStart(2,'0')}`;
    } else {
      for(let i = 0; i < MONTHS_FR.length; i++){
        const re = new RegExp('(\\d{1,2})\\s+' + MONTHS_FR[i] + '[a-zé.]*\\s+(20\\d{2})', 'i');
        const m2 = text.match(re);
        if(m2){
          date = `${m2[2]}-${String(i+1).padStart(2,'0')}-${String(Math.min(31,Math.max(1,parseInt(m2[1],10)))).padStart(2,'0')}`;
          break;
        }
      }
    }

    let merchant = '';
    for(const l of lines){ if(/[a-zA-Zà-ÿ]{3,}/.test(l) && !/\d{1,4}[.,]\d{2}/.test(l)){ merchant = l.slice(0, 30); break; } }
    return { rows, date, merchant, storeCategory: storeCat, declaredTotal };
  }

  async function runReceiptOCR(file){
    document.getElementById('receiptModal').style.display = 'flex';
    document.getElementById('receiptProcessing').style.display = 'block';
    document.getElementById('receiptReview').style.display = 'none';
    document.getElementById('receiptError').style.display = 'none';
    const progressEl = document.getElementById('receiptProgress');
    try {
      let text;
      if(window.__receiptOCRStub){ text = window.__receiptOCRStub; }
      else {
        progressEl.textContent = 'Chargement du lecteur…';
        const T = await loadTesseract();
        const logger = m => { if(m.status === 'recognizing text') progressEl.textContent = 'Lecture : ' + Math.round(m.progress * 100) + '%'; };
        // Note un resultat : nb de montants + richesse du texte
        const scoreOf = t => (t.match(/\d{1,4}[.,]\d{2}/g) || []).length * 3 + (t.match(/[A-Za-zÀ-ÿ]{3,}/g) || []).length;

        let worker = null;
        try { if(T.createWorker) worker = await T.createWorker('fra', 1, { logger }); } catch(_) { worker = null; }

        if(worker){
          await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });

          // Lit une image et reconstruit les lignes a partir de la POSITION des mots
          const readOnce = async (blob) => {
            let res;
            try { res = await worker.recognize(blob, {}, { text: true, tsv: true }); }
            catch(_) { res = await worker.recognize(blob); }
            const viaTsv = linesFromTsv(res.data && res.data.tsv);
            const raw = (res.data && res.data.text) || '';
            const joined = viaTsv ? viaTsv.join('\n') : '';
            // On garde la version la plus riche des deux
            return (scoreOf(joined) >= scoreOf(raw)) ? joined : raw;
          };

          progressEl.textContent = 'Amélioration de la photo…';
          const grayImg = await preprocessReceiptImage(file, 'gray');
          progressEl.textContent = 'Lecture du ticket…';
          text = await readOnce(grayImg);

          // Si la lecture est pauvre, on retente avec une image binarisee (photos tres inegales)
          if(scoreOf(text) < 25){
            progressEl.textContent = 'Nouvelle tentative…';
            const binImg = await preprocessReceiptImage(file, 'binary');
            const alt = await readOnce(binImg);
            if(scoreOf(alt) > scoreOf(text)) text = alt;
          }
          // Toujours pauvre : on essaie le mode colonnes sur l'original
          if(scoreOf(text) < 15){
            progressEl.textContent = 'Dernière tentative…';
            await worker.setParameters({ tessedit_pageseg_mode: '4' });
            const alt2 = await readOnce(grayImg);
            if(scoreOf(alt2) > scoreOf(text)) text = alt2;
          }
          await worker.terminate();
        } else {
          const prepared = await preprocessReceiptImage(file, 'gray');
          const res = await T.recognize(prepared, 'fra', { logger });
          text = res.data.text;
        }
      }
      const parsed = parseReceiptText(text);
      receiptRows = parsed.rows;
      receiptDeclaredTotal = parsed.declaredTotal;
      if(!receiptRows.length){
        showReceiptError("Aucun montant n'a pu être lu. Réessaie avec une photo bien nette, cadrée et éclairée.");
        return;
      }
      document.getElementById('receiptProcessing').style.display = 'none';
      document.getElementById('receiptReview').style.display = 'block';
      const today = new Date().toISOString().slice(0,10);
      document.getElementById('receiptDate').value = parsed.date || today;
      document.getElementById('receiptCategory').value = parsed.storeCategory || '';
      document.getElementById('budgetCategoriesList2').innerHTML = budgetKnownCategories().map(c => `<option value="${esc(c)}">`).join('');
      renderReceiptRows();
    } catch(err){
      showReceiptError("Le lecteur n'a pas pu démarrer. Vérifie ta connexion (le premier scan a besoin d'internet pour charger l'outil), puis réessaie.");
    }
  }

  function showReceiptError(msg){
    document.getElementById('receiptProcessing').style.display = 'none';
    document.getElementById('receiptReview').style.display = 'none';
    document.getElementById('receiptError').style.display = 'block';
    document.getElementById('receiptErrorMsg').textContent = msg;
  }

  function updateReceiptCheckBar(){
    document.getElementById('receiptCount').textContent = receiptRows.filter(r => r.include).length;
    const check = document.getElementById('receiptCheck');
    if(check){
      const sum = receiptRows.filter(r => r.include).reduce((s, r) => s + (r.amount || 0), 0);
      const discounts = receiptRows.filter(r => r.isDiscount && !r.include).reduce((s, r) => s + (r.amount || 0), 0);
      if(receiptDeclaredTotal){
        const diff = Math.abs((sum - discounts) - receiptDeclaredTotal);
        const ok = diff < 0.02;
        check.className = 'receipt-check-bar ' + (ok ? 'ok' : 'warn');
        check.innerHTML = ok
          ? `\u2713 Total v\u00e9rifi\u00e9 : ${budgetFmt(sum)}${discounts > 0 ? ' (remises \u2212' + budgetFmt(discounts) + ')' : ''} \u2014 correspond au ticket.`
          : `\u26a0 S\u00e9lection : <b>${budgetFmt(sum)}</b> \u2014 total lu sur le ticket : <b>${budgetFmt(receiptDeclaredTotal)}</b> (\u00e9cart ${budgetFmt(diff)}). V\u00e9rifie les lignes.`;
      } else {
        check.className = 'receipt-check-bar';
        check.innerHTML = `S\u00e9lection : <b>${budgetFmt(sum)}</b>`;
      }
    }
  }

  function renderReceiptRows(){
    const wrap = document.getElementById('receiptRows');
    updateReceiptCheckBar();
    wrap.innerHTML = receiptRows.map(r => `
      <div class="receipt-row ${r.include ? '' : 'excluded'}" data-rid="${r.id}">
        <input type="checkbox" class="receipt-check" ${r.include ? 'checked' : ''} data-rid="${r.id}">
        <div class="receipt-fields">
          <div class="receipt-line-1">
            <input type="text" class="receipt-label" value="${esc(r.label)}" data-rid="${r.id}" placeholder="Libellé">
            <input type="text" class="receipt-amount" value="${r.amount.toFixed(2).replace('.', ',')}" data-rid="${r.id}" inputmode="none" autocomplete="off">
          </div>
          <input type="text" class="receipt-cat" value="${esc(r.category || '')}" data-rid="${r.id}" list="budgetCategoriesList2" placeholder="Catégorie (optionnel)">
        </div>
        <button class="receipt-del" data-rid="${r.id}" title="Retirer">&times;</button>
      </div>`).join('');
    wrap.querySelectorAll('.receipt-check').forEach(el => el.addEventListener('change', () => {
      const r = receiptRows.find(x => x.id === el.dataset.rid); if(r){ r.include = el.checked; renderReceiptRows(); }
    }));
    wrap.querySelectorAll('.receipt-label').forEach(el => el.addEventListener('input', () => {
      const r = receiptRows.find(x => x.id === el.dataset.rid); if(r) r.label = el.value;
    }));
    wrap.querySelectorAll('.receipt-cat').forEach(el => el.addEventListener('input', () => {
      const r = receiptRows.find(x => x.id === el.dataset.rid); if(r) r.category = el.value;
    }));
    wrap.querySelectorAll('.receipt-amount').forEach(el => {
      ['focus','click','touchend'].forEach(evt => el.addEventListener(evt, e => {
        if(evt === 'touchend') e.preventDefault();
        el.focus();
        openNumPad(el);
      }));
      // Mise a jour en direct pendant la frappe sur le pave
      el.addEventListener('input', () => {
        const r = receiptRows.find(x => x.id === el.dataset.rid);
        if(r){
          r.amount = parseFloat((el.value || '').replace(',', '.')) || 0;
          updateReceiptCheckBar();
        }
      });
    });
    wrap.querySelectorAll('.receipt-del').forEach(el => el.addEventListener('click', () => {
      receiptRows = receiptRows.filter(x => x.id !== el.dataset.rid); renderReceiptRows();
    }));
  }

  // ---------- budget (espace calcul) ----------
