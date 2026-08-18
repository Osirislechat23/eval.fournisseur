  function getFolder(id){ return state.folders.find(f => f.id === id); }
  const DEFAULT_FOLDER_PHOTO_SECTIONS = ['Photos avant', 'Photos fabrication et pose', 'Plans'];
  function newPhotoSection(name){ return { id: uid(), name: name||'Nouvelle section', photos: [] }; }

  function renderFoldersSidebar(){
    renderListSidebar({
      listElId: 'folderList', searchElId: 'folderSearchInput', dataAttr: 'folder',
      items: state.folders, selectedId: selectedFolderId,
      matchQuery: (f, q) => (f.title||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucun dossier pour l'instant.<br>Cliquez sur « + Nouveau » pour regrouper des fiches de débit et des analyses de fabrication d'un même chantier.</div>`,
      itemHtml: f => `
        <div class="name">${esc(f.title) || '(sans titre)'} <span class="ref-badge">${esc(f.reference||'')}</span></div>
        <div class="meta">${f.client ? esc(f.client)+' · ' : ''}${fmtDate(f.date || new Date().toISOString())}</div>
        <div class="meta">${(f.debitSheetIds||[]).length} fiche${(f.debitSheetIds||[]).length!==1?'s':''} de débit · ${(f.mfgSheetIds||[]).length} analyse${(f.mfgSheetIds||[]).length!==1?'s':''}</div>`
    });
  }

  function renderFolderMain(){
    const main = document.getElementById('folderMainArea');
    if(!main) return;
    const folder = getFolder(selectedFolderId);
    if(!folder){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucun dossier sélectionné</h2>
          <p>Un dossier regroupe une ou plusieurs fiches de débit et analyses de fabrication d'un même chantier, pour tout télécharger en un seul PDF.</p>
        </div>`;
      return;
    }
    const clientLower = (folder.client||'').trim().toLowerCase();
    const debitIds = folder.debitSheetIds || [];
    const mfgIds = folder.mfgSheetIds || [];
    const linkedDebit = debitIds.map(id => getSheet(id)).filter(Boolean);
    const linkedMfg = mfgIds.map(id => getMfgSheet(id)).filter(Boolean);
    const availableDebit = state.debitSheets.filter(ds => !debitIds.includes(ds.id)).slice().sort((a,b) => {
      const aMatch = (clientLower && (a.client||'').toLowerCase().includes(clientLower)) ? 0 : 1;
      const bMatch = (clientLower && (b.client||'').toLowerCase().includes(clientLower)) ? 0 : 1;
      if(aMatch !== bMatch) return aMatch - bMatch;
      return (a.title||'').localeCompare(b.title||'');
    });
    const availableMfg = state.manufacturingSheets.filter(ms => !mfgIds.includes(ms.id)).slice().sort((a,b) => {
      const aMatch = (clientLower && (a.client||'').toLowerCase().includes(clientLower)) ? 0 : 1;
      const bMatch = (clientLower && (b.client||'').toLowerCase().includes(clientLower)) ? 0 : 1;
      if(aMatch !== bMatch) return aMatch - bMatch;
      return (a.title||'').localeCompare(b.title||'');
    });

    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Dossier <span class="ref-badge">${esc(folder.reference||'')}</span></span></div>
          <div id="folderSaveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistré automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          <button class="btn btn-sage" id="btnSaveFolder">Enregistrer</button>
          <button class="btn btn-gold" id="btnDownloadFolder">Télécharger le dossier (PDF)</button>
          <button class="btn btn-danger" id="btnDeleteFolder">Supprimer</button>
        </div>
      </div>
      <div class="sheet-header-form">
        <div class="field full">
          <label>Titre du dossier</label>
          <input type="text" id="folderTitle" value="${esc(folder.title||'')}" placeholder="ex. Chantier Dupont — Rénovation complète">
        </div>
        <div class="field">
          <label>Client / Chantier</label>
          <input type="text" id="folderClient" value="${esc(folder.client||'')}" placeholder="ex. M. Dupont, 12 rue des Lilas">
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="folderDate" value="${(folder.date||'').slice(0,10)}">
        </div>
        <div class="field full">
          <label>Note générale</label>
          <input type="text" id="folderNote" value="${esc(folder.note||'')}" placeholder="ex. Livraison prévue semaine 34">
        </div>
      </div>

      <div class="section-label"><span>Éléments rattachés</span></div>
      <div class="folder-linked-help">Pour rattacher un élément, ouvre-le et choisis ce dossier dans le sélecteur 📁 de sa barre d'outils.</div>
      ${renderFolderLinkedGroups(folder, linkedDebit, linkedMfg)}

      <div class="section-label" style="margin-top:6px;"><span>Galeries de photos</span></div>
      ${(() => {
        const linkedAlbums = (folder.albumIds||[]).map(id => getAlbum(id)).filter(Boolean);
        return `
        ${linkedAlbums.length ? linkedAlbums.map(a => {
          const photos = a.photos || [];
          return `
          <div class="folder-album">
            <div class="folder-album-head">
              <div class="folder-linked-name">${esc(a.name || '(sans nom)')}</div>
              <span class="dash-count-badge">${photos.length} photo${photos.length!==1?'s':''}</span>
              <button class="folder-unlink" data-unlink-album="${a.id}" title="Détacher la galerie">&times;</button>
            </div>
            ${photos.length ? `<div class="folder-album-strip">
              ${photos.slice(0,8).map(ph => `<img src="${resolvePhotoSrc(ph.src)}" data-photo-ref="${esc(ph.src)}" alt="${esc(ph.caption||'')}" data-album-open="${a.id}">`).join('')}
              ${photos.length > 8 ? `<span class="folder-album-more">+${photos.length-8}</span>` : ''}
            </div>` : `<div class="empty-side" style="padding:10px;">Cette galerie ne contient pas encore de photo.</div>`}
          </div>`;
        }).join('') : `<div class="empty-side">Aucune galerie rattachée. Ouvre une galerie dans l'onglet Galerie et choisis ce dossier dans son sélecteur 📁.</div>`}
        `;
      })()}

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Fiches de débit</span><span class="val">${linkedDebit.length}</span></div>
        <div class="tot"><span class="lbl">Analyses</span><span class="val">${linkedMfg.length}</span></div>
        <div class="tot"><span class="lbl">Semaines d'heures</span><span class="val">${(folder.hoursWeekIds||[]).length}</span></div>
        <div class="tot"><span class="lbl">Heures totales</span><span class="val">${(() => {
          const mins = (folder.hoursWeekIds||[])
            .map(ws => state.hoursWeeks.find(w => w.weekStart === ws)).filter(Boolean)
            .reduce((s,w) => s + (w.days||[]).reduce((t,d) => t + hoursDayMinutes(d), 0), 0);
          return hoursFormatDuration(mins/60);
        })()}</span></div>
      </div>
    `;
    bindFolderEvents(folder);
  }

  // Elements rattaches au dossier, groupes par type
  function renderFolderLinkedGroups(folder, linkedDebit, linkedMfg){
    const linkedHours = (folder.hoursWeekIds||[]).map(ws => state.hoursWeeks.find(w => w.weekStart === ws)).filter(Boolean);
    const linkedSpacing = (folder.spacingIds||[]).map(id => state.spacings.find(s => s.id === id)).filter(Boolean);
    const linkedNotes = (folder.noteIds||[]).map(id => state.notes.find(n => n.id === id)).filter(Boolean);

    const group = (icon, title, items, kind, render) => {
      if(!items.length) return '';
      return `
        <div class="folder-group">
          <div class="folder-group-title">${icon} ${title} <span class="dash-count-badge">${items.length}</span></div>
          ${items.map(it => `
            <div class="folder-linked-item" data-goto-kind="${kind}" data-goto-id="${esc(String(render(it).id))}">
              <div class="folder-linked-body">
                <div class="folder-linked-name">${esc(render(it).name)}</div>
                ${render(it).meta ? `<div class="folder-linked-meta">${esc(render(it).meta)}</div>` : ''}
              </div>
              <button class="folder-unlink" data-unlink-kind="${kind}" data-unlink-id="${esc(String(render(it).id))}" title="Détacher">&times;</button>
            </div>`).join('')}
        </div>`;
    };

    const html =
      group('\ud83d\udccb', 'Fiches de débit', linkedDebit, 'debit',
        ds => ({ id: ds.id, name: ds.title || '(sans titre)', meta: [ds.reference, ds.client].filter(Boolean).join(' \u00b7 ') })) +
      group('\u2699\ufe0f', 'Analyses de fabrication', linkedMfg, 'mfg',
        ms => ({ id: ms.id, name: ms.title || '(sans titre)', meta: [ms.reference, ms.client].filter(Boolean).join(' \u00b7 ') })) +
      group('\u23f1\ufe0f', 'Semaines d\u2019heures', linkedHours, 'hours',
        w => {
          const total = (w.days||[]).reduce((s,d) => s + hoursDayMinutes(d), 0);
          return { id: w.weekStart,
                   name: 'Semaine du ' + new Date(w.weekStart).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}),
                   meta: hoursFormatDuration(total/60) + (w.reference ? ' \u00b7 ' + w.reference : '') };
        }) +
      group('\ud83d\udcd0', 'Répartitions', linkedSpacing, 'spacing',
        s => ({ id: s.id, name: s.title || '(sans titre)', meta: '' })) +
      group('\ud83d\udcd0', 'Relev\u00e9s de cotes', (folder.surveyIds||[]).map(id => state.surveys.find(s => s.id === id)).filter(Boolean), 'surveys',
        sv => ({ id: sv.id, name: sv.title || '(sans titre)', meta: [(sv.measures||[]).length + ' cotes', sv.location].filter(Boolean).join(' \u00b7 ') })) +
      group('\ud83d\udcdd', 'Notes', linkedNotes, 'notes',
        n => ({ id: n.id, name: noteDisplayTitle(n), meta: relativeDate(n.updatedAt||n.createdAt) }));

    return html || `<div class="empty-side">Aucun \u00e9l\u00e9ment rattach\u00e9 pour l'instant.</div>`;
  }

  function renderPhotoSection(sec){
    const photos = sec.photos || [];
    return `
    <div class="photo-section-block" data-photo-section="${sec.id}">
      <div class="photo-section-header">
        <input type="text" class="photo-section-name-input" data-section-name="${sec.id}" value="${esc(sec.name)}" placeholder="Nom de la section">
        <span class="photo-section-count">${photos.length} photo${photos.length!==1?'s':''}</span>
        <button class="btn btn-danger" data-delete-photo-section="${sec.id}" title="Supprimer la section" style="padding:2px;">&times;</button>
      </div>
      ${photos.length ? `
        <div class="photo-gallery-grid">
          ${photos.map((src,i) => `
            <div class="photo-gallery-thumb">
              <img src="${src}" data-view-section-photo="${sec.id}" data-photo-index="${i}" alt="${esc(sec.name)} ${i+1}">
              <button class="photo-remove-btn" data-remove-section-photo="${sec.id}" data-photo-index="${i}" title="Retirer cette photo">&times;</button>
            </div>
          `).join('')}
        </div>
      ` : `<div class="photo-gallery-empty">Aucune photo pour l'instant.</div>`}
      <label class="btn btn-line" style="display:inline-block; cursor:pointer; padding:6px 12px; font-size:12.5px;">
        Ajouter des photos
        <input type="file" accept="image/*" multiple data-upload-section="${sec.id}" style="display:none;">
      </label>
    </div>`;
  }

  function syncFolderFromDom(folder){
    const fieldMap = { folderTitle:'title', folderClient:'client', folderNote:'note' };
    Object.keys(fieldMap).forEach(id => {
      const el = document.getElementById(id);
      if(el) folder[fieldMap[id]] = el.value;
    });
    const dateEl = document.getElementById('folderDate');
    if(dateEl) folder.date = dateEl.value ? new Date(dateEl.value).toISOString() : (folder.date || new Date().toISOString());
  }

  function bindFolderEvents(folder){
    const main = document.getElementById('folderMainArea');

    const saveBtn = document.getElementById('btnSaveFolder');
    if(saveBtn) saveBtn.addEventListener('click', () => {
      syncFolderFromDom(folder);
      save();
      renderFoldersSidebar();
      toast('Dossier enregistré ✓');
      const status = document.getElementById('folderSaveStatus');
      if(status){
        status.textContent = 'Enregistré à l’instant ✓';
        status.style.color = 'var(--sage)';
        setTimeout(() => {
          const s = document.getElementById('folderSaveStatus');
          if(s){ s.textContent = 'Enregistré automatiquement dans ce navigateur'; s.style.color = 'var(--text-dim)'; }
        }, 2500);
      }
    });

    ['folderTitle','folderClient','folderNote'].forEach(id => {
      const fieldMap = { folderTitle:'title', folderClient:'client', folderNote:'note' };
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        folder[fieldMap[id]] = el.value;
        save(); renderFoldersSidebar();
        if(id === 'folderClient') renderFolderMain();
      });
    });
    const dateEl = document.getElementById('folderDate');
    if(dateEl) dateEl.addEventListener('change', () => {
      folder.date = dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString();
      save(); renderFoldersSidebar();
    });

    // Detacher un element du dossier
    main.querySelectorAll('[data-unlink-kind]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        setFolderLink(btn.dataset.unlinkKind, btn.dataset.unlinkId, '');
        renderFolderMain(); renderFoldersSidebar();
        toast('D\u00e9tach\u00e9 du dossier');
      });
    });
    // Ouvrir l'element rattache d'un clic
    main.querySelectorAll('[data-goto-kind]').forEach(row => {
      row.addEventListener('click', e => {
        if(e.target.closest('[data-unlink-kind]')) return;
        goToItem(row.dataset.gotoKind, row.dataset.gotoId);
      });
    });

    const delBtn = document.getElementById('btnDeleteFolder');
    if(delBtn) bindConfirmDeleteButton(delBtn, () => {
      trashPut('folders', folder.title, folder);
      state.folders = state.folders.filter(f => f.id !== folder.id);
      selectedFolderId = state.folders[0]?.id ?? null;
      save(); render();
    });

    const downloadBtn = document.getElementById('btnDownloadFolder');
    if(downloadBtn) downloadBtn.addEventListener('click', () => {
      syncFolderFromDom(folder);
      save();
      downloadFolder(folder);
    });

    // Galeries rattachees (le rattachement se fait depuis l'onglet Galerie)
    main.querySelectorAll('[data-unlink-album]').forEach(btn => {
      btn.addEventListener('click', () => {
        setFolderLink('gallery', btn.dataset.unlinkAlbum, '');
        toast('Galerie d\u00e9tach\u00e9e');
      });
    });
    main.querySelectorAll('[data-album-open]').forEach(img => {
      img.addEventListener('click', async () => {
        const a = getAlbum(img.dataset.albumOpen);
        if(!a) return;
        const srcs = await Promise.all((a.photos||[]).map(ph => getPhotoDataUrl(ph.src)));
        openLightbox(srcs, 0);
      });
    });
  }

  function downloadFolder(folder){
    const company = state.company || {};
    const linkedDebit = (folder.debitSheetIds||[]).map(id => getSheet(id)).filter(Boolean);
    const linkedMfg = (folder.mfgSheetIds||[]).map(id => getMfgSheet(id)).filter(Boolean);
    const linkedHours = (folder.hoursWeekIds||[]).map(ws => state.hoursWeeks.find(w => w.weekStart === ws)).filter(Boolean)
      .sort((a,b) => new Date(a.weekStart) - new Date(b.weekStart));
    const linkedSpacing = (folder.spacingIds||[]).map(id => state.spacings.find(s => s.id === id)).filter(Boolean);
    const linkedNotes = (folder.noteIds||[]).map(id => state.notes.find(n => n.id === id)).filter(Boolean);
    const linkedAlbums = (folder.albumIds||[]).map(id => getAlbum(id)).filter(a => a && (a.photos||[]).length);
    const photoSections = linkedAlbums.map(a => ({ name: a.name || 'Galerie', photos: (a.photos||[]).map(p => p.src) }));
    if(!linkedDebit.length && !linkedMfg.length && !photoSections.length && !linkedHours.length && !linkedSpacing.length && !linkedNotes.length){
      toast('Rattache au moins un \u00e9l\u00e9ment au dossier avant de le t\u00e9l\u00e9charger.');
      return;
    }
    const linkedHoursMinutes = linkedHours.reduce((s,w) => s + (w.days||[]).reduce((t,d) => t + hoursDayMinutes(d), 0), 0);

    const contactParts = [];
    if(company.phone) contactParts.push('Tél. ' + esc(company.phone));
    if(company.email) contactParts.push(esc(company.email));
    const contactLine = contactParts.join(' · ');

    const coverHtml = `
  <div class="pdf-doc">
  <div class="letterhead">
    <div class="company-block">
      ${company.logo ? `<img src="${resolvePhotoSrc(company.logo)}" data-photo-ref="${esc(company.logo)}" alt="Logo">` : ''}
      <div>
        <p class="company-name">${esc(company.name || 'Mon Entreprise')}</p>
        <div class="company-meta">
          ${company.address ? esc(company.address) + '<br>' : ''}
          ${contactLine}
          ${company.siret ? '<br>SIRET ' + esc(company.siret) : ''}
        </div>
      </div>
    </div>
    <div class="doc-title-block">
      <p class="doc-title">DOSSIER DE CHANTIER</p>
      <div class="doc-ref">${esc(folder.reference || '')}</div>
      <div class="doc-date">Édité le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  ${folder.title ? `<p class="project-title">${esc(folder.title)}</p>` : ''}

  <div class="cartouche">
    <div><span>Client / Chantier</span><strong>${esc(folder.client) || '—'}</strong></div>
    <div><span>Date</span><strong>${fmtDate(folder.date || new Date().toISOString())}</strong></div>
    <div><span>N° Dossier</span><strong>${esc(folder.reference) || '—'}</strong></div>
    <div><span>Documents</span><strong>${linkedDebit.length + linkedMfg.length + linkedHours.length + linkedSpacing.length + linkedNotes.length}</strong></div>
  </div>

  ${folder.note ? `<div class="note-bar">${esc(folder.note)}</div>` : ''}

  ${linkedDebit.length ? `
  <div class="cover-list">
    <h4>Fiches de débit (${linkedDebit.length})</h4>
    <ul>
      ${linkedDebit.map(ds => `<li><span><span class="cl-ref">${esc(ds.reference||'')}</span>${esc(ds.title||'(sans titre)')}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  ${linkedMfg.length ? `
  <div class="cover-list">
    <h4>Analyses de fabrication (${linkedMfg.length})</h4>
    <ul>
      ${linkedMfg.map(ms => `<li><span><span class="cl-ref">${esc(ms.reference||'')}</span>${esc(ms.title||'(sans titre)')}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  ${linkedHours.length ? `
  <div class="cover-list">
    <h4>Relev\u00e9s d'heures (${linkedHours.length} semaine${linkedHours.length>1?'s':''} \u2014 ${hoursFormatDuration(linkedHoursMinutes/60)})</h4>
    <ul>
      ${linkedHours.map(w => {
        const mins = (w.days||[]).reduce((t,d) => t + hoursDayMinutes(d), 0);
        return `<li><span><span class="cl-ref">${esc(w.reference||'')}</span>Semaine du ${new Date(w.weekStart).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}</span><span class="cl-ref">${hoursFormatDuration(mins/60)}</span></li>`;
      }).join('')}
    </ul>
  </div>` : ''}

  ${linkedSpacing.length ? `
  <div class="cover-list">
    <h4>R\u00e9partitions (${linkedSpacing.length})</h4>
    <ul>${linkedSpacing.map(s => `<li><span>${esc(s.title||'(sans titre)')}</span></li>`).join('')}</ul>
  </div>` : ''}

  ${linkedNotes.length ? `
  <div class="cover-list">
    <h4>Notes (${linkedNotes.length})</h4>
    <ul>${linkedNotes.map(n => `<li><span>${esc(noteDisplayTitle(n))}</span></li>`).join('')}</ul>
  </div>` : ''}

  ${photoSections.length ? `
  <div class="cover-list">
    <h4>Galeries photos (${photoSections.reduce((n,s) => n + s.photos.length, 0)} photo${photoSections.reduce((n,s) => n + s.photos.length, 0)!==1?'s':''})</h4>
    <ul>
      ${photoSections.map(sec => `<li><span>${esc(sec.name)}</span><span class="cl-ref">${sec.photos.length}</span></li>`).join('')}
    </ul>
  </div>` : ''}

  <footer>
    <span>${esc(folder.reference || '')} — ${esc(company.name || 'Mon Entreprise')}</span>
    <span>Généré le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;

    const photosHtml = photoSections.length ? `
  <div class="pdf-doc">
  <p class="project-title">Galeries photos</p>
  ${photoSections.map(sec => `
    <div class="photo-pdf-section">
      <h4>${esc(sec.name)} (${sec.photos.length})</h4>
      <div class="photo-pdf-grid">
        ${sec.photos.map(src => `<img src="${resolvePhotoSrc(src)}" data-photo-ref="${esc(src)}" alt="${esc(sec.name)}">`).join('')}
      </div>
    </div>
  `).join('')}
  </div>` : '';

    // Relev\u00e9 d'heures au format habituel, une page par semaine rattach\u00e9e
    const hoursHtml = linkedHours.map(w => buildHoursWeekPdfBody(w)).join('');

    const notesHtml = linkedNotes.length ? `
  <div class="pdf-doc">
  <p class="project-title">Notes du dossier</p>
  ${linkedNotes.map(n => `
    <div class="pdf-note-block">
      <h4>${esc(noteDisplayTitle(n))}</h4>
      <p>${esc(n.content||'').replace(/\n/g,'<br>')}</p>
    </div>`).join('')}
  </div>` : '';

    const bodyHtml = coverHtml
      + photosHtml
      + linkedDebit.map(ds => buildSheetPdfBody(ds)).join('')
      + linkedMfg.map(ms => buildMfgPdfBody(ms)).join('')
      + hoursHtml
      + notesHtml;

    openPrintWindow(folder.reference || folder.title || 'Dossier de chantier', bodyHtml);
  }

  // ---------- trajets (espace calcul) ----------
  function getTrip(id){ return state.trips.find(t => t.id === id); }

  function renderTripsSidebar(){
    renderListSidebar({
      listElId: 'tripList', searchElId: 'tripSearchInput', dataAttr: 'trip',
      items: state.trips, selectedId: selectedTripId,
      matchQuery: (t, q) => (t.title||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucun trajet pour l'instant.<br>Cliquez sur « + Nouveau » pour calculer le coût d'un trajet en voiture.</div>`,
      itemHtml: t => {
        const c = tripCost(t);
        return `
        <div class="name">${esc(t.title) || '(sans titre)'} <span class="ref-badge">${esc(t.reference||'')}</span></div>
        <div class="meta">${fmtDate(t.date || new Date().toISOString())} · ${t.distanceKm || 0} km</div>
        <div class="meta">Coût total : <strong>${c.totalCost.toFixed(2)} ${curr()}</strong>${c.peopleCount>1 ? ` · <strong>${c.costPerPerson.toFixed(2)} ${curr()}</strong>/pers.` : ''}</div>`;
      }
    });
  }

  function renderTripMain(){
    const main = document.getElementById('tripMainArea');
    if(!main) return;
    const trip = getTrip(selectedTripId);
    if(!trip){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucun trajet sélectionné</h2>
          <p>Calcule le coût d'un trajet en voiture à partir de la distance, du péage et de la consommation.</p>
        </div>`;
      return;
    }
    const c = tripCost(trip);
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Trajet <span class="ref-badge">${esc(trip.reference||'')}</span></span></div>
          <div id="tripSaveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistré automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          <button class="btn btn-sage" id="btnSaveTrip">Enregistrer</button>
          <button class="btn btn-danger" id="btnDeleteTrip">Supprimer</button>
        </div>
      </div>
      <div class="sheet-header-form">
        <div class="field full">
          <label>Titre du trajet</label>
          <input type="text" id="tripTitle" value="${esc(trip.title||'')}" placeholder="ex. Livraison chantier Dupont">
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="tripDate" value="${(trip.date||'').slice(0,10)}">
        </div>
        <div class="field">
          <label>Distance aller (km)</label>
          <input type="text" inputmode="decimal" id="tripDistance" value="${esc(String(trip.distanceKm ?? ''))}" placeholder="ex. 45">
        </div>
        <div class="field" style="display:flex; align-items:flex-end; padding-bottom:8px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; text-transform:none; font-size:13px; color:var(--ink);">
            <input type="checkbox" id="tripRoundTrip" ${trip.roundTrip ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--sage); cursor:pointer;">
            Aller-retour
          </label>
        </div>
        <div class="field">
          <label>Consommation (L/100km)</label>
          <input type="text" inputmode="decimal" id="tripConsumption" value="${esc(String(trip.consumptionL100 ?? ''))}" placeholder="ex. 6.5">
        </div>
        <div class="field">
          <label>Prix du carburant (${curr()}/L)</label>
          <input type="text" inputmode="decimal" id="tripFuelPrice" value="${esc(String(trip.fuelPrice ?? ''))}" placeholder="ex. 1.85">
        </div>
        <div class="field">
          <label>Péage aller (${curr()})</label>
          <input type="text" inputmode="decimal" id="tripToll" value="${esc(String(trip.tollPrice ?? ''))}" placeholder="ex. 12.40">
        </div>
        <div class="field">
          <label>Nombre de personnes</label>
          <input type="text" inputmode="numeric" id="tripPeopleCount" value="${esc(String(trip.peopleCount ?? ''))}" placeholder="1">
        </div>
        <div class="field full">
          <label>Note</label>
          <input type="text" id="tripNote" value="${esc(trip.note||'')}" placeholder="ex. Livraison + pose">
        </div>
      </div>

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Distance totale</span><span class="val">${c.distance} km</span></div>
        <div class="tot"><span class="lbl">Carburant utilisé</span><span class="val">${c.liters.toFixed(2)} L</span></div>
        <div class="tot"><span class="lbl">Coût carburant</span><span class="val">${c.fuelCost.toFixed(2)} ${curr()}</span></div>
        <div class="tot"><span class="lbl">Péage</span><span class="val">${c.toll.toFixed(2)} ${curr()}</span></div>
        <div class="tot"><span class="lbl">Coût total</span><span class="val">${c.totalCost.toFixed(2)} ${curr()}</span></div>
        <div class="tot"><span class="lbl">Coût par km</span><span class="val">${c.costPerKm.toFixed(3)} ${curr()}/km</span></div>
        <div class="tot"><span class="lbl">Coût par personne${c.peopleCount>1?` (÷${c.peopleCount})`:''}</span><span class="val">${c.costPerPerson.toFixed(2)} ${curr()}</span></div>
      </div>
    `;
    bindTripEvents(trip);
  }

  function syncTripFromDom(trip){
    const fieldMap = { tripTitle:'title', tripNote:'note' };
    Object.keys(fieldMap).forEach(id => {
      const el = document.getElementById(id);
      if(el) trip[fieldMap[id]] = el.value;
    });
    const dateEl = document.getElementById('tripDate');
    if(dateEl) trip.date = dateEl.value ? new Date(dateEl.value).toISOString() : (trip.date || new Date().toISOString());
    const roundTripEl = document.getElementById('tripRoundTrip');
    if(roundTripEl) trip.roundTrip = roundTripEl.checked;
    ['tripDistance:distanceKm','tripConsumption:consumptionL100','tripFuelPrice:fuelPrice','tripToll:tollPrice','tripPeopleCount:peopleCount'].forEach(pair => {
      const [id, field] = pair.split(':');
      const el = document.getElementById(id);
      if(!el) return;
      const num = el.value.replace(',', '.').trim();
      trip[field] = num === '' ? '' : (parseFloat(num) || 0);
    });
  }

  function refreshTripTotalsBar(trip){
    const totalsBar = document.querySelector('#tripMainArea .totals-bar');
    if(!totalsBar) return;
    const c = tripCost(trip);
    totalsBar.innerHTML = `
      <div class="tot"><span class="lbl">Distance totale</span><span class="val">${c.distance} km</span></div>
      <div class="tot"><span class="lbl">Carburant utilisé</span><span class="val">${c.liters.toFixed(2)} L</span></div>
      <div class="tot"><span class="lbl">Coût carburant</span><span class="val">${c.fuelCost.toFixed(2)} ${curr()}</span></div>
      <div class="tot"><span class="lbl">Péage</span><span class="val">${c.toll.toFixed(2)} ${curr()}</span></div>
      <div class="tot"><span class="lbl">Coût total</span><span class="val">${c.totalCost.toFixed(2)} ${curr()}</span></div>
      <div class="tot"><span class="lbl">Coût par km</span><span class="val">${c.costPerKm.toFixed(3)} ${curr()}/km</span></div>
      <div class="tot"><span class="lbl">Coût par personne${c.peopleCount>1?` (÷${c.peopleCount})`:''}</span><span class="val">${c.costPerPerson.toFixed(2)} ${curr()}</span></div>
    `;
  }

  function bindTripEvents(trip){
    const main = document.getElementById('tripMainArea');

    const saveBtn = document.getElementById('btnSaveTrip');
    if(saveBtn) saveBtn.addEventListener('click', () => {
      syncTripFromDom(trip);
      save();
      renderTripsSidebar();
      toast('Trajet enregistré ✓');
      const status = document.getElementById('tripSaveStatus');
      if(status){
        status.textContent = 'Enregistré à l’instant ✓';
        status.style.color = 'var(--sage)';
        setTimeout(() => {
          const s = document.getElementById('tripSaveStatus');
          if(s){ s.textContent = 'Enregistré automatiquement dans ce navigateur'; s.style.color = 'var(--text-dim)'; }
        }, 2500);
      }
    });

    ['tripTitle','tripNote'].forEach(id => {
      const fieldMap = { tripTitle:'title', tripNote:'note' };
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        trip[fieldMap[id]] = el.value;
        save(); renderTripsSidebar();
      });
    });
    const dateEl = document.getElementById('tripDate');
    if(dateEl) dateEl.addEventListener('change', () => {
      trip.date = dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString();
      save(); renderTripsSidebar();
    });

    const roundTripEl = document.getElementById('tripRoundTrip');
    if(roundTripEl) roundTripEl.addEventListener('change', () => {
      trip.roundTrip = roundTripEl.checked;
      save();
      renderTripsSidebar();
      refreshTripTotalsBar(trip);
    });

    [['tripDistance','distanceKm'],['tripConsumption','consumptionL100'],['tripFuelPrice','fuelPrice'],['tripToll','tollPrice'],['tripPeopleCount','peopleCount']].forEach(([id, field]) => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        const num = el.value.replace(',', '.').trim();
        trip[field] = num === '' ? '' : (parseFloat(num) || 0);
        save();
        renderTripsSidebar();
        refreshTripTotalsBar(trip);
      });
    });

    const delBtn = document.getElementById('btnDeleteTrip');
    if(delBtn) bindConfirmDeleteButton(delBtn, () => {
      trashPut('trips', trip.title, trip);
      state.trips = state.trips.filter(t => t.id !== trip.id);
      selectedTripId = state.trips[0]?.id ?? null;
      save(); render();
    });
  }

  // ---------- répartition d'espaces (espace calcul) ----------
  function getSpacing(id){ return state.spacings.find(s => s.id === id); }

  function renderSpacingsSidebar(){
    renderListSidebar({
      listElId: 'spacingList', searchElId: 'spacingSearchInput', dataAttr: 'spacing',
      items: state.spacings, selectedId: selectedSpacingId,
      matchQuery: (s, q) => (s.title||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucune répartition pour l'instant.<br>Cliquez sur « + Nouveau » pour diviser une longueur en espaces égaux (ex. balustres, lattes, tasseaux…).</div>`,
      itemHtml: s => {
        const r = spacingResult(s);
        return `
        <div class="name">${esc(s.title) || '(sans titre)'} <span class="ref-badge">${esc(s.reference||'')}</span></div>
        <div class="meta">${s.totalLength || 0} mm · ${s.elementCount || 0} élément${(s.elementCount||0)!==1?'s':''}</div>
        <div class="meta">${r.valid ? `Espace : <strong>${r.gap.toFixed(1)} mm</strong>` : 'À compléter'}</div>`;
      }
    });
  }

  function renderSpacingMain(){
    const main = document.getElementById('spacingMainArea');
    if(!main) return;
    const s = getSpacing(selectedSpacingId);
    if(!s){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucune répartition sélectionnée</h2>
          <p>Divise une longueur en espaces égaux — pratique pour répartir des balustres, lattes, tasseaux ou tout élément régulièrement espacé.</p>
        </div>`;
      return;
    }
    const r = spacingResult(s);
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Répartition <span class="ref-badge">${esc(s.reference||'')}</span></span></div>
          <div id="spacingSaveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistré automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          ${folderLinkControl('spacing', s.id)}
          <button class="btn btn-sage" id="btnSaveSpacing">Enregistrer</button>
          <button class="btn btn-danger" id="btnDeleteSpacing">Supprimer</button>
        </div>
      </div>
      <div class="sheet-header-form">
        <div class="field full">
          <label>Titre</label>
          <input type="text" id="spacingTitle" value="${esc(s.title||'')}" placeholder="ex. Balustrade terrasse">
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="spacingDate" value="${(s.date||'').slice(0,10)}">
        </div>
        <div class="field">
          <label>Longueur totale (mm)</label>
          <input type="text" inputmode="decimal" id="spacingLength" value="${esc(String(s.totalLength ?? ''))}" placeholder="ex. 2400">
        </div>
        <div class="field">
          <label>Largeur de l'élément (mm)</label>
          <input type="text" inputmode="decimal" id="spacingWidth" value="${esc(String(s.elementWidth ?? ''))}" placeholder="ex. 40">
        </div>
        <div class="field">
          <label>Nombre d'éléments</label>
          <input type="text" inputmode="numeric" id="spacingCount" value="${esc(String(s.elementCount ?? ''))}" placeholder="ex. 12">
        </div>
        <div class="field" style="display:flex; align-items:flex-end; padding-bottom:8px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; text-transform:none; font-size:13px; color:var(--ink);">
            <input type="checkbox" id="spacingEdgeSpace" ${s.edgeSpace !== false ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--sage); cursor:pointer;">
            Espace au début et à la fin
          </label>
        </div>
        <div class="field full">
          <label>Note</label>
          <input type="text" id="spacingNote" value="${esc(s.note||'')}" placeholder="ex. Balustres 40x40mm, main courante comprise">
        </div>
      </div>

      <div id="spacingTotalsWrap">${renderSpacingTotals(r)}</div>

      <div class="section-label" style="margin-top:18px;"><span>Détail des positions</span></div>
      <div id="spacingPositionsWrap">${renderSpacingPositionsTable(r)}</div>
    `;
    bindSpacingEvents(s);
  }

  function renderSpacingTotals(r){
    if(!r.valid){
      return `<div class="empty-side" style="padding:10px 0;">Renseigne la longueur totale, la largeur de l'élément et le nombre d'éléments pour voir le résultat.</div>`;
    }
    return `
      <div class="totals-bar">
        <div class="tot"><span class="lbl">Espace entre éléments</span><span class="val" style="${r.warn?'color:var(--brick);':''}">${r.gap.toFixed(1)} mm</span></div>
        <div class="tot"><span class="lbl">Nombre d'espaces</span><span class="val">${r.gapsCount}</span></div>
        <div class="tot"><span class="lbl">Largeur totale éléments</span><span class="val">${r.totalElementsWidth.toFixed(1)} mm</span></div>
        <div class="tot"><span class="lbl">Espace restant réparti</span><span class="val">${r.remainingSpace.toFixed(1)} mm</span></div>
      </div>
      ${r.warn ? `<div class="note-bar" style="background:color-mix(in srgb, var(--brick) 12%, var(--paper-raised)); border-left-color:var(--brick); margin-top:10px;">⚠️ Les éléments ne tiennent pas dans la longueur donnée (espace négatif). Réduis le nombre d'éléments ou leur largeur.</div>` : ''}
    `;
  }

  function renderSpacingPositionsTable(r){
    if(!r.valid || !r.positions.length){
      return `<div class="empty-side" style="padding:10px 0;">—</div>`;
    }
    return `
      <div class="debit-table-wrap">
        <table class="debit-table">
          <thead>
            <tr>
              <th style="width:70px;">Repère</th>
              <th>Départ (mm)</th>
              <th>Fin (mm)</th>
            </tr>
          </thead>
          <tbody>
            ${r.positions.map(p => `
              <tr>
                <td class="op-num-cell">E${p.index}</td>
                <td class="op-num-cell">${p.start.toFixed(1)}</td>
                <td class="op-num-cell">${p.end.toFixed(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function syncSpacingFromDom(s){
    const fieldMap = { spacingTitle:'title', spacingNote:'note' };
    Object.keys(fieldMap).forEach(id => {
      const el = document.getElementById(id);
      if(el) s[fieldMap[id]] = el.value;
    });
    const dateEl = document.getElementById('spacingDate');
    if(dateEl) s.date = dateEl.value ? new Date(dateEl.value).toISOString() : (s.date || new Date().toISOString());
    const edgeEl = document.getElementById('spacingEdgeSpace');
    if(edgeEl) s.edgeSpace = edgeEl.checked;
    ['spacingLength:totalLength','spacingWidth:elementWidth','spacingCount:elementCount'].forEach(pair => {
      const [id, field] = pair.split(':');
      const el = document.getElementById(id);
      if(!el) return;
      const num = el.value.replace(',', '.').trim();
      s[field] = num === '' ? '' : (parseFloat(num) || 0);
    });
  }

  function refreshSpacingResults(s){
    const r = spacingResult(s);
    const totalsWrap = document.getElementById('spacingTotalsWrap');
    const positionsWrap = document.getElementById('spacingPositionsWrap');
    if(totalsWrap) totalsWrap.innerHTML = renderSpacingTotals(r);
    if(positionsWrap) positionsWrap.innerHTML = renderSpacingPositionsTable(r);
  }

  function bindSpacingEvents(s){
    const main = document.getElementById('spacingMainArea');

    const saveBtn = document.getElementById('btnSaveSpacing');
    if(saveBtn) saveBtn.addEventListener('click', () => {
      syncSpacingFromDom(s);
      save();
      renderSpacingsSidebar();
      toast('Répartition enregistrée ✓');
      const status = document.getElementById('spacingSaveStatus');
      if(status){
        status.textContent = 'Enregistrée à l’instant ✓';
        status.style.color = 'var(--sage)';
        setTimeout(() => {
          const el = document.getElementById('spacingSaveStatus');
          if(el){ el.textContent = 'Enregistré automatiquement dans ce navigateur'; el.style.color = 'var(--text-dim)'; }
        }, 2500);
      }
    });

    ['spacingTitle','spacingNote'].forEach(id => {
      const fieldMap = { spacingTitle:'title', spacingNote:'note' };
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        s[fieldMap[id]] = el.value;
        save(); renderSpacingsSidebar();
      });
    });
    const dateEl = document.getElementById('spacingDate');
    if(dateEl) dateEl.addEventListener('change', () => {
      s.date = dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString();
      save(); renderSpacingsSidebar();
    });

    const edgeEl = document.getElementById('spacingEdgeSpace');
    if(edgeEl) edgeEl.addEventListener('change', () => {
      s.edgeSpace = edgeEl.checked;
      save();
      renderSpacingsSidebar();
      refreshSpacingResults(s);
    });

    [['spacingLength','totalLength'],['spacingWidth','elementWidth'],['spacingCount','elementCount']].forEach(([id, field]) => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        const num = el.value.replace(',', '.').trim();
        s[field] = num === '' ? '' : (parseFloat(num) || 0);
        save();
        renderSpacingsSidebar();
        refreshSpacingResults(s);
      });
    });

    const delBtn = document.getElementById('btnDeleteSpacing');
    if(delBtn) bindConfirmDeleteButton(delBtn, () => {
      trashPut('spacings', s.title, s);
      state.spacings = state.spacings.filter(x => x.id !== s.id);
      selectedSpacingId = state.spacings[0]?.id ?? null;
      save(); render();
    });
  }

  // ---------- notes (espace calcul) ----------
  function getNote(id){ return state.notes.find(n => n.id === id); }
  function noteDisplayTitle(n){
    if(n.title && n.title.trim()) return n.title.trim();
    const firstLine = (n.content||'').split('\n').find(l => l.trim());
    return firstLine ? firstLine.trim().slice(0, 60) : 'Sans titre';
  }
  function notePreview(n){
    const text = (n.content||'').replace(/\s+/g, ' ').trim();
    return text.slice(0, 90) || 'Note vide';
  }
  function relativeDate(iso){
    if(!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if(diffMin < 1) return "à l'instant";
    if(diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if(diffH < 24) return `il y a ${diffH} h`;
    const diffDays = Math.floor(diffH / 24);
    if(diffDays === 1) return 'hier';
    if(diffDays < 7) return `il y a ${diffDays} j`;
    return fmtDate(iso);
  }

  function renderNotesSidebar(){
    const noteSort = document.getElementById('noteSortSelect')?.value || 'recent';
    const sorted = state.notes.slice().sort((a,b) => {
      // Les favoris remontent toujours en haut
      if(!!a.favorite !== !!b.favorite) return a.favorite ? -1 : 1;
      return noteSort === 'title'
        ? noteDisplayTitle(a).localeCompare(noteDisplayTitle(b), 'fr')
        : new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt);
    });
    const favCount = sorted.filter(n => n.favorite).length;
    renderListSidebar({
      listElId: 'noteList', searchElId: 'noteSearchInput', dataAttr: 'note',
      items: sorted, selectedId: selectedNoteId,
      matchQuery: (n, q) => noteDisplayTitle(n).toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucune note pour l'instant.<br>Cliquez sur « + Nouvelle » pour écrire librement — tout se sauvegarde automatiquement pendant que tu tapes.</div>`,
      itemClass: () => 'note-item',
      groupLabel: (n, i) => (favCount && i === 0) ? `<div class="note-group-label">\u2605 Favoris</div>` : (favCount && i === favCount) ? `<div class="note-group-label">Autres notes</div>` : '',
      itemHtml: n => `
        <button class="note-fav-btn ${n.favorite?'on':''}" data-fav-note="${n.id}" title="${n.favorite?'Retirer des favoris':'Mettre en favori'}">${n.favorite?'\u2605':'\u2606'}</button>
        <div class="name">${esc(noteDisplayTitle(n))}</div>
        <div class="meta">${esc(notePreview(n))}</div>
        <div class="meta">${relativeDate(n.updatedAt||n.createdAt)}</div>`,
      afterRender: list => list.querySelectorAll('[data-fav-note]').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        const note = getNote(btn.dataset.favNote);
        if(!note) return;
        note.favorite = !note.favorite;
        save();
        renderNotesSidebar();
        renderNoteMain();
        toast(note.favorite ? 'Ajout\u00e9e aux favoris \u2605' : 'Retir\u00e9e des favoris');
      }))
    });
  }

  const NOTE_DRAFT_PREFIX = 'note-draft:';
  function noteDraftKey(id){ return NOTE_DRAFT_PREFIX + id; }
  function saveNoteDraft(id, title, content){
    try{ localStorage.setItem(noteDraftKey(id), JSON.stringify({ title, content, at: new Date().toISOString() })); }catch(e){}
  }
  function getNoteDraft(id){
    try{ const raw = localStorage.getItem(noteDraftKey(id)); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function clearNoteDraft(id){ try{ localStorage.removeItem(noteDraftKey(id)); }catch(e){} }
  function noteDraftIsRestorable(n){
    const d = getNoteDraft(n.id);
    if(!d) return false;
    if((d.title||'') === (n.title||'') && (d.content||'') === (n.content||'')){ clearNoteDraft(n.id); return false; }
    return true;
  }

  function renderNoteMain(){
    const main = document.getElementById('noteMainArea');
    if(!main) return;
    const n = getNote(selectedNoteId);
    if(!n){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucune note sélectionnée</h2>
          <p>Écris librement — la note se sauvegarde automatiquement pendant que tu tapes, pas besoin de bouton "Enregistrer".</p>
        </div>`;
      return;
    }
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Note</span></div>
          <div id="noteSaveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistrée automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          ${folderLinkControl('notes', n.id)}
          <button class="btn btn-line note-fav-toggle ${n.favorite?'on':''}" id="btnNoteFav">${n.favorite ? '\u2605 Favori' : '\u2606 Favori'}</button>
          <button class="btn btn-danger" id="btnDeleteNote">Supprimer</button>
        </div>
      </div>
      ${noteDraftIsRestorable(n) ? `
      <div class="note-restore" id="noteRestoreBanner">
        <div class="note-restore-text">
          ✨ Une version non enregistrée de cette note a été retrouvée${(() => { const d = getNoteDraft(n.id); return d && d.at ? ' (' + relativeDate(d.at) + ')' : ''; })()}.
        </div>
        <div class="note-restore-actions">
          <button class="btn btn-gold" id="btnNoteRestore" style="padding:5px 12px; font-size:12.5px;">Restaurer</button>
          <button class="btn btn-line" id="btnNoteDiscardDraft" style="padding:5px 12px; font-size:12.5px;">Ignorer</button>
        </div>
      </div>` : ''}
      <input type="text" id="noteTitle" value="${esc(n.title||'')}" placeholder="Titre (optionnel)"
        style="width:100%; border:none; background:transparent; font-family:'Fraunces',serif; font-weight:600; font-size:20px; color:var(--ink); padding:6px 0; margin-bottom:6px; border-bottom:1px solid var(--line);">
      <textarea id="noteContent" placeholder="Écris ici…"
        style="width:100%; min-height:200px; border:1px solid var(--line); border-radius:6px; padding:14px; font-family:'IBM Plex Sans'; font-size:14.5px; line-height:1.6; background:var(--paper-raised); color:var(--ink); resize:none; overflow:hidden;">${esc(n.content||'')}</textarea>
    `;
    bindNoteEvents(n);
  }

  // La note s'affiche en entier : la zone grandit avec le texte,
  // c'est la page qui defile, pas le cadre.
  function autoGrowNote(){
    const ta = document.getElementById('noteContent');
    if(!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(ta.scrollHeight, 160) + 'px';
  }

  function bindNoteEvents(n){
    const favBtn = document.getElementById('btnNoteFav');
    if(favBtn) favBtn.addEventListener('click', () => {
      n.favorite = !n.favorite;
      save();
      render();
      toast(n.favorite ? 'Ajout\u00e9e aux favoris \u2605' : 'Retir\u00e9e des favoris');
    });
    const titleInput = document.getElementById('noteTitle');
    const contentInput = document.getElementById('noteContent');
    let saveTimer = null;
    function scheduleSave(){
      const status = document.getElementById('noteSaveStatus');
      if(status){ status.textContent = 'Modification en cours…'; status.style.color = 'var(--gold)'; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        n.title = titleInput.value;
        n.content = contentInput.value;
        n.updatedAt = new Date().toISOString();
        save();
        clearNoteDraft(n.id);
        renderNotesSidebar();
        const s = document.getElementById('noteSaveStatus');
        if(s){ s.textContent = 'Enregistrée automatiquement dans ce navigateur'; s.style.color = 'var(--text-dim)'; }
      }, 600);
    }
    autoGrowNote();
    if(contentInput) contentInput.addEventListener('input', autoGrowNote);
    function stashDraft(){ saveNoteDraft(n.id, titleInput.value, contentInput.value); }
    if(titleInput){ titleInput.addEventListener('input', scheduleSave); titleInput.addEventListener('input', stashDraft); }
    if(contentInput){ contentInput.addEventListener('input', scheduleSave); contentInput.addEventListener('input', stashDraft); }

    const restoreBtn = document.getElementById('btnNoteRestore');
    if(restoreBtn) restoreBtn.addEventListener('click', () => {
      const d = getNoteDraft(n.id);
      if(d){ n.title = d.title || ''; n.content = d.content || ''; n.updatedAt = new Date().toISOString(); save(); }
      clearNoteDraft(n.id);
      render();
      toast('Note restaurée ✓');
    });
    const discardBtn = document.getElementById('btnNoteDiscardDraft');
    if(discardBtn) discardBtn.addEventListener('click', () => {
      clearNoteDraft(n.id);
      const banner = document.getElementById('noteRestoreBanner');
      if(banner) banner.remove();
    });

    const delBtn = document.getElementById('btnDeleteNote');
    if(delBtn) bindConfirmDeleteButton(delBtn, () => {
      trashPut('notes', noteDisplayTitle(n), n);
      state.notes = state.notes.filter(x => x.id !== n.id);
      selectedNoteId = state.notes[0]?.id ?? null;
      save(); render();
    });
  }

  // ---------- recettes (espace calcul) ----------
