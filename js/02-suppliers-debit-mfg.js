  const VIEW_RENDER_MAP = {
    home: () => renderHomeMain(),
    suppliers: () => { renderSidebar(); renderMain(); },
    debit: () => { renderSheetSidebar(); renderSheetMain(); },
    mfg: () => { renderMfgSidebar(); renderMfgMain(); },
    folders: () => { renderFoldersSidebar(); renderFolderMain(); },
    trips: () => { renderTripsSidebar(); renderTripMain(); },
    spacing: () => { renderSpacingsSidebar(); renderSpacingMain(); },
    notes: () => { renderNotesSidebar(); renderNoteMain(); },
    recipes: () => { renderRecipesSidebar(); renderRecipeMain(); },
    hours: () => { renderHoursSidebar(); renderHoursMain(); },
    budget: () => { renderBudgetSidebar(); renderBudgetMain(); },
    shopping: () => renderShoppingMain(),
    stats: () => renderStatsMain(),
    gallery: () => { renderAlbumSidebar(); renderGalleryMain(); },
    vehicles: () => { renderVehicleSidebar(); renderVehicleMain(); },
    fuel: () => renderFuelMain(),
    surveys: () => { renderSurveySidebar(); renderSurveyMain(); },
    gifts: () => { renderPersonSidebar(); renderGiftMain(); },
    meals: () => renderMealsMain(),
  };
  function renderCurrentView(){
    const fn = VIEW_RENDER_MAP[currentView];
    if(fn) fn();
    else Object.values(VIEW_RENDER_MAP).forEach(f => f()); // vue inconnue : par securite, tout reconstruire
  }
  function render(){
    renderCurrentView();
    refreshSpaceButtons();
    applyEditLock();
  }

  function supplierMatchQuery(s, q){
    if(!q) return { match:true, hint:null };
    if((s.name||'').toLowerCase().includes(q)) return { match:true, hint:null };
    if((s.category||'').toLowerCase().includes(q)) return { match:true, hint:null };
    for(const p of (s.products||[])){
      if((p.name||'').toLowerCase().includes(q)) return { match:true, hint:p.name };
      for(const c of (p.comments||[])){
        if((c.text||'').toLowerCase().includes(q)) return { match:true, hint:p.name };
      }
    }
    return { match:false, hint:null };
  }

  const STATUS_LABELS = { actif:'Actif', test:'En test', eviter:'À éviter' };
  function statusClass(status){ return 'status-' + (status || 'actif'); }
  function statusLabel(status){ return STATUS_LABELS[status] || STATUS_LABELS.actif; }

  const FICHE_STATUS_LABELS = { brouillon:'Brouillon', en_cours:'En cours', validee:'Validée', terminee:'Terminée' };
  function ficheStatusClass(status){ return 'fiche-status-' + (status || 'brouillon'); }
  function ficheStatusLabel(status){ return FICHE_STATUS_LABELS[status] || FICHE_STATUS_LABELS.brouillon; }

  function renderSidebar(){
    const supSort = document.getElementById('supplierSortSelect')?.value || 'added';
    renderListSidebar({
      listElId: 'supplierList', searchElId: 'searchInput', dataAttr: 'supplier',
      wrapperClass: 'supplier-item',
      items: state.suppliers, selectedId: selectedSupplierId,
      sortFn: supSort === 'name' ? (a,b) => (a.name||'').localeCompare(b.name||'', 'fr')
        : supSort === 'rating' ? (a,b) => (supplierAvg(b)||0) - (supplierAvg(a)||0)
        : null,
      matchQuery: (s, q) => supplierMatchQuery(s, q).match,
      emptyMessage: `<div class="empty-side">Aucun fournisseur pour l'instant.<br>Cliquez sur « + Ajouter » pour commencer votre registre.</div>`,
      noMatchMessage: q => `<div class="empty-side">Aucun résultat pour « ${esc(q)} » (nom, catégorie, produit ou commentaire).</div>`,
      itemHtml: s => {
        const avg = supplierAvg(s);
        const cls = ratingClass(avg);
        const nbProducts = (s.products||[]).length;
        const q = (document.getElementById('searchInput').value || '').toLowerCase().trim();
        const hint = q ? supplierMatchQuery(s, q).hint : null;
        return `
        <div class="name">${esc(s.name) || '(sans nom)'}</div>
        ${s.category ? `<div class="cat">${esc(s.category)}</div>` : ''}
        <div class="badge-row">
          <span class="mini-stamp ${cls}">${avg===null ? '—' : avg.toFixed(1)+' / 10'}</span>
          <span class="status-pill ${statusClass(s.status)}">${statusLabel(s.status)}</span>
          <span style="font-size:11px; color:var(--text-dim);">${nbProducts} produit${nbProducts!==1?'s':''}</span>
        </div>
        ${hint ? `<div class="search-hint">🔎 trouvé dans « ${esc(hint)} »</div>` : ''}`;
      }
    });
  }

  function renderMain(){
    const main = document.getElementById('mainArea');
    const supplier = getSupplier(selectedSupplierId);
    if(!supplier){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Votre registre est vide</h2>
          <p>Ajoutez un premier fournisseur pour commencer à noter ses produits et à consigner vos observations.</p>
        </div>`;
      return;
    }
    const avg = supplierAvg(supplier);
    const cls = ratingClass(avg);
    const products = supplier.products || [];

    main.innerHTML = `
      <div class="supplier-header">
        <div class="supplier-title-block" style="flex:1; min-width:0;">
          <input class="name-input" data-field="name" value="${esc(supplier.name)}" placeholder="Nom du fournisseur">
          <input class="cat-input" data-field="category" value="${esc(supplier.category||'')}" placeholder="Catégorie (ex. emballage, matières premières…)">
          <div class="contact-row">
            <div class="contact-field">
              <input class="contact-input" data-field="phone" value="${esc(supplier.phone||'')}" placeholder="☎ Téléphone">
              ${supplier.phone ? `<a class="contact-link" href="tel:${esc(supplier.phone.replace(/\s+/g,''))}">Appeler</a>` : ''}
            </div>
            <div class="contact-field">
              <input class="contact-input" data-field="email" value="${esc(supplier.email||'')}" placeholder="✉ Email">
              ${supplier.email ? `<a class="contact-link" href="mailto:${esc(supplier.email)}">Écrire</a>` : ''}
            </div>
          </div>
        </div>
        <div class="supplier-overall sheet-toolbar-actions">
          <select class="status-select ${statusClass(supplier.status)}" data-field="status" id="supplierStatus">
            <option value="actif" ${(supplier.status||'actif')==='actif'?'selected':''}>Actif</option>
            <option value="test" ${supplier.status==='test'?'selected':''}>En test</option>
            <option value="eviter" ${supplier.status==='eviter'?'selected':''}>À éviter</option>
          </select>
          <div class="stamp ${cls}">
            <div class="num">${avg===null?'—':avg.toFixed(1)}</div>
            <div class="lbl">/ 10 GLOBAL</div>
          </div>
          <button class="btn btn-danger" id="btnDeleteSupplier" title="Supprimer ce fournisseur">Supprimer</button>
        </div>
      </div>
      <hr class="rule">
      <div class="section-label">
        <span>Produits (${products.length})</span>
        <button class="btn btn-line" id="btnToggleNewProduct" style="padding:5px 10px; font-size:12px;">+ Nouveau produit</button>
      </div>
      ${openNewProductForm ? renderNewProductForm() : ''}
      ${products.length ? products.map(p => renderProductCard(supplier, p)).join('') : `
        <div class="empty-side" style="padding:20px 0;">Aucun produit enregistré. Ajoutez-en un pour pouvoir noter et commenter.</div>
      `}
    `;
    bindMainEvents(supplier);
  }

  function renderNewProductForm(){
    return `
      <div class="new-product-form" id="newProductForm">
        <div class="field">
          <label>Nom du produit</label>
          <input type="text" id="newProductName" placeholder="ex. Carton ondulé 40x30">
        </div>
        <div class="form-actions">
          <button class="btn btn-sage" id="btnSaveProduct">Ajouter le produit</button>
          <button class="btn btn-line" id="btnCancelProduct">Annuler</button>
        </div>
      </div>`;
  }

  function renderProductCard(supplier, product){
    const avg = productAvg(product);
    const isOpen = openProducts.has(product.id);
    const comments = allComments(product).slice().sort((a,b)=> b.date.localeCompare(a.date));
    return `
    <div class="product-card">
      <div class="product-head" data-toggle-product="${product.id}">
        <div class="product-head-left">
          <span class="chevron ${isOpen?'open':''}">▸</span>
          <div>
            <div class="product-name">${esc(product.name)}</div>
            <div class="product-meta">
              ${avg===null ? 'Aucun commentaire' : `<span class="score-badge ${ratingClass(avg)}">${avg.toFixed(1)}<span style="opacity:.55; font-weight:400;">/10</span></span> · ${comments.length} commentaire${comments.length!==1?'s':''}`}
            </div>
          </div>
        </div>
        <button class="btn btn-danger" data-delete-product="${product.id}" title="Supprimer ce produit">Supprimer</button>
      </div>
      ${isOpen ? `
      <div class="product-body">
        ${comments.map(c => renderComment(product, c)).join('') || `<div class="empty-side" style="padding:14px 0;">Pas encore de commentaire sur ce produit.</div>`}
        <div class="add-row">
          ${openNewCommentFor === product.id ? renderNewCommentForm(product) : `
            <button class="btn btn-line" data-open-comment="${product.id}" style="padding:6px 12px; font-size:12.5px;">+ Ajouter un commentaire</button>
          `}
        </div>
      </div>` : ''}
    </div>`;
  }

  function renderComment(product, c){
    const isEditing = editingComment && editingComment.pid === product.id && editingComment.cid === c.id;
    if(isEditing) return renderEditCommentForm(c);
    const photos = c.photos || [];
    return `
    <div class="comment">
      ${photos.length ? `
        <div class="comment-photos">
          ${photos.map((src, i) => `<img class="comment-photo" src="${resolvePhotoSrc(src)}" data-photo-ref="${esc(src)}" data-view-photo data-view-pid="${product.id}" data-view-cid="${c.id}" data-view-index="${i}" alt="Photo ${i+1} jointe au commentaire">`).join('')}
        </div>` : `<div class="comment-photo-placeholder"></div>`}
      <div class="comment-body">
        <div class="comment-top">
          <span class="score-badge ${ratingClass(c.rating)}">${scoreLabel(c.rating)}</span>
          <span class="comment-date mono">${fmtDate(c.date)}</span>
        </div>
        <div class="comment-text">${esc(c.text) || '<span style="color:var(--text-dim)">(sans texte)</span>'}</div>
        <div style="margin-top:6px; display:flex; gap:14px;">
          <button class="btn btn-danger" data-edit-comment="${product.id}|${c.id}" style="padding:2px 0; color:var(--ink-soft);">Modifier</button>
          <button class="btn btn-danger" data-delete-comment="${product.id}|${c.id}" style="padding:2px 0;">Supprimer</button>
        </div>
      </div>
    </div>`;
  }

  function renderEditCommentForm(c){
    return `
    <div class="new-comment-form" id="editCommentForm">
      <div class="field">
        <label>Note (1 à 10)</label>
        <div class="score-picker" id="editStarPicker">
          ${Array.from({length:10}, (_,idx)=>idx+1).map(i => `<span data-edit-star="${i}" class="${i<=editRating?'filled':''}">${i}</span>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Commentaire</label>
        <textarea id="editCommentText">${esc(editText)}</textarea>
      </div>
      <div class="field">
        <label>Photos (optionnelles)</label>
        <label class="btn btn-line" style="display:inline-block; cursor:pointer; padding:6px 12px; font-size:12.5px;">
          Ajouter des photos
          <input type="file" id="editCommentPhoto" accept="image/*" multiple>
        </label>
        ${editPhotos.length ? `
          <div class="photo-preview">
            ${editPhotos.map((src,i) => `
              <div class="photo-thumb">
                <img src="${resolvePhotoSrc(src)}" data-photo-ref="${esc(src)}" alt="Aperçu ${i+1}">
                <button class="photo-thumb-remove" data-remove-edit-photo="${i}" title="Retirer">&times;</button>
              </div>`).join('')}
          </div>` : ''}
      </div>
      <div class="form-actions">
        <button class="btn btn-sage" id="btnSaveEditComment">Enregistrer les modifications</button>
        <button class="btn btn-line" id="btnCancelEditComment">Annuler</button>
      </div>
    </div>`;
  }

  function renderNewCommentForm(product){
    return `
    <div class="new-comment-form" id="newCommentForm">
      <div class="field">
        <label>Note (1 à 10)</label>
        <div class="score-picker" id="starPicker">
          ${Array.from({length:10}, (_,idx)=>idx+1).map(i => `<span data-star="${i}" class="${i<=pendingRating?'filled':''}">${i}</span>`).join('')}
        </div>
      </div>
      <div class="field">
        <label>Commentaire</label>
        <textarea id="newCommentText" placeholder="Qualité, délai de livraison, conformité…">${esc(pendingText)}</textarea>
      </div>
      <div class="field">
        <label>Photos (optionnelles)</label>
        <label class="btn btn-line" style="display:inline-block; cursor:pointer; padding:6px 12px; font-size:12.5px;">
          Ajouter des photos
          <input type="file" id="newCommentPhoto" accept="image/*" multiple>
        </label>
        ${pendingPhotos.length ? `
          <div class="photo-preview">
            ${pendingPhotos.map((src,i) => `
              <div class="photo-thumb">
                <img src="${resolvePhotoSrc(src)}" data-photo-ref="${esc(src)}" alt="Aperçu ${i+1}">
                <button class="photo-thumb-remove" data-remove-pending-photo="${i}" title="Retirer">&times;</button>
              </div>`).join('')}
          </div>` : ''}
      </div>
      <div class="form-actions">
        <button class="btn btn-sage" id="btnSaveComment">Enregistrer</button>
        <button class="btn btn-line" id="btnCancelComment">Annuler</button>
      </div>
    </div>`;
  }

  // ---------- fiches de débit ----------
  function renderSheetSidebar(){
    const shSort = document.getElementById('sheetSortSelect')?.value || 'recent';
    renderListSidebar({
      listElId: 'sheetList', searchElId: 'sheetSearchInput', dataAttr: 'sheet',
      items: state.debitSheets, selectedId: selectedSheetId,
      sortFn: shSort === 'title'
        ? (a,b) => (a.title||'').localeCompare(b.title||'', 'fr')
        : (a,b) => new Date(b.date||0) - new Date(a.date||0),
      matchQuery: (s, q) => (s.title||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucune fiche pour l'instant.<br>Cliquez sur « + Nouvelle » pour créer votre première fiche de débit.</div>`,
      itemHtml: s => {
        const t = sheetTotals(s);
        return `
        <div class="name">${esc(s.title) || '(sans titre)'} <span class="ref-badge">${esc(s.reference||'')}</span></div>
        <div class="meta">${s.client ? esc(s.client)+' · ' : ''}${fmtDate(s.date || new Date().toISOString())}</div>
        <div class="meta">${(s.rows||[]).length} ligne${(s.rows||[]).length!==1?'s':''} · ${t.pieces} pièce${t.pieces!==1?'s':''}</div>
        ${state.settings.ficheStatusEnabled ? `<div class="badge-row"><span class="status-pill ${ficheStatusClass(s.status)}">${ficheStatusLabel(s.status)}</span></div>` : ''}`;
      }
    });
  }

  function renderSheetMain(){
    const main = document.getElementById('debitMainArea');
    if(!main) return;
    const sheet = getSheet(selectedSheetId);
    if(!sheet){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucune fiche sélectionnée</h2>
          <p>Créez une fiche de débit pour lister les pièces à découper (menuiserie, ébénisterie…) avec leurs dimensions, puis téléchargez-la en PDF ou en CSV.</p>
        </div>`;
      return;
    }
    const rows = sheet.rows || [];
    const t = sheetTotals(sheet);
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Fiche de débit <span class="ref-badge">${esc(sheet.reference||'')}</span></span></div>
          <div id="saveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistrée automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          ${state.settings.ficheStatusEnabled ? `
            <select class="fiche-status-select ${ficheStatusClass(sheet.status)}" data-field="status" id="sheetStatus">
              <option value="brouillon" ${(sheet.status||'brouillon')==='brouillon'?'selected':''}>Brouillon</option>
              <option value="en_cours" ${sheet.status==='en_cours'?'selected':''}>En cours</option>
              <option value="validee" ${sheet.status==='validee'?'selected':''}>Validée</option>
              <option value="terminee" ${sheet.status==='terminee'?'selected':''}>Terminée</option>
            </select>
          ` : ''}
          ${folderLinkControl('debit', sheet.id)}
          <button class="btn btn-sage" id="btnSaveSheet">Enregistrer</button>
          <button class="btn btn-line" id="btnExportSheetCsv">Télécharger CSV</button>
          <button class="btn btn-gold" id="btnPrintSheet">Télécharger PDF</button>
          <button class="btn btn-danger" id="btnDeleteSheet">Supprimer</button>
        </div>
      </div>
      <div class="sheet-header-form">
        <div class="field full">
          <label>Titre / Projet</label>
          <input type="text" id="sheetTitle" value="${esc(sheet.title||'')}" placeholder="ex. Portail double vantaux — Chantier Dupont">
        </div>
        <div class="field">
          <label>Client / Chantier</label>
          <input type="text" id="sheetClient" value="${esc(sheet.client||'')}" placeholder="ex. M. Dupont, 12 rue des Lilas">
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="sheetDate" value="${(sheet.date||'').slice(0,10)}">
        </div>
        <div class="field">
          <label>Réalisé par</label>
          <input type="text" id="sheetOperator" value="${esc(sheet.operator||'')}" placeholder="ex. J. Martin">
        </div>
        <div class="field">
          <label>N° de fiche</label>
          <input type="text" id="sheetReference" value="${esc(sheet.reference||'')}">
        </div>
        <div class="field full">
          <label>Note générale</label>
          <input type="text" id="sheetNote" value="${esc(sheet.note||'')}" placeholder="ex. Matériau principal : PVC blanc, épaisseur profilé 70mm">
        </div>
      </div>

      <div class="debit-table-wrap">
        <table class="debit-table">
          <thead>
            <tr>
              <th style="width:56px;">Repère</th>
              <th>Désignation</th>
              <th style="width:90px;">Long. (mm)</th>
              <th style="width:90px;">Larg. (mm)</th>
              <th style="width:90px;">Ép. (mm)</th>
              <th style="width:64px;">Qté</th>
              <th style="width:140px;">Matériau</th>
              <th style="width:80px;">Marge</th>
              <th>Observations</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody id="sheetRowsBody">
            ${rows.map(r => renderSheetRow(r)).join('') || `<tr><td colspan="10" style="color:var(--text-dim); font-size:12.5px; padding:14px 8px;">Aucune pièce. Ajoutez une ligne pour commencer le débit.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="add-row">
        <button class="btn btn-line" id="btnAddRow" style="padding:6px 12px; font-size:12.5px;">+ Ajouter une ligne</button>
      </div>

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Total pièces</span><span class="val">${t.pieces}</span></div>
        <div class="tot"><span class="lbl">Longueur cumulée</span><span class="val">${t.linear.toFixed(2)} m</span></div>
        <div class="tot"><span class="lbl">Surface cumulée</span><span class="val">${t.surface.toFixed(2)} m²</span></div>
        <div class="tot"><span class="lbl">Volume (sans marge)</span><span class="val">${t.volume.toFixed(3)} m³</span></div>
        <div class="tot"><span class="lbl">Volume (avec marge)</span><span class="val">${t.volumeWithMargin.toFixed(3)} m³</span></div>
      </div>
    `;
    bindSheetEvents(sheet);
  }

  function renderSheetRow(r){
    const pieceNames = (state.pieceLibrary||[]).map(p => p.name).sort((a,b) => a.localeCompare(b, 'fr'));
    if(r.designation && !pieceNames.includes(r.designation)) pieceNames.unshift(r.designation);
    const materialNames = (state.materialLibrary||[]).map(m => m.name).sort((a,b) => a.localeCompare(b, 'fr'));
    if(r.materiau && !materialNames.includes(r.materiau)) materialNames.unshift(r.materiau);
    const marginNames = (state.marginLibrary||[]).map(m => m.name).sort((a,b) => parseFloat(a) - parseFloat(b));
    if(r.marge !== '' && r.marge != null && !marginNames.includes(String(r.marge))) marginNames.unshift(String(r.marge));
    return `
    <tr data-row="${r.id}">
      <td><input type="text" data-row-field="repere" value="${esc(r.repere||'')}" placeholder="P1"></td>
      <td>
        <select data-row-field="designation">
          <option value="">—</option>
          ${pieceNames.map(n => `<option value="${esc(n)}" ${n === r.designation ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" class="num" inputmode="decimal" data-row-field="longueur" value="${esc(String(r.longueur ?? ''))}"></td>
      <td><input type="text" class="num" inputmode="decimal" data-row-field="largeur" value="${esc(String(r.largeur ?? ''))}"></td>
      <td><input type="text" class="num" inputmode="decimal" data-row-field="epaisseur" value="${esc(String(r.epaisseur ?? ''))}"></td>
      <td><input type="text" class="num" inputmode="numeric" data-row-field="quantite" value="${esc(String(r.quantite ?? ''))}"></td>
      <td>
        <select data-row-field="materiau">
          <option value="">—</option>
          ${materialNames.map(n => `<option value="${esc(n)}" ${n === r.materiau ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
      </td>
      <td>
        <select data-row-field="marge">
          <option value="">—</option>
          ${marginNames.map(n => `<option value="${esc(n)}" ${n === String(r.marge) ? 'selected' : ''}>${esc(n)} %</option>`).join('')}
        </select>
      </td>
      <td><input type="text" data-row-field="observation" value="${esc(r.observation||'')}"></td>
      <td class="col-actions"><button class="btn btn-danger" data-delete-row="${r.id}" title="Supprimer la ligne" style="padding:2px;">&times;</button></td>
    </tr>`;
  }

  function syncSheetFromDom(sheet){
    const titleEl = document.getElementById('sheetTitle');
    const clientEl = document.getElementById('sheetClient');
    const dateEl = document.getElementById('sheetDate');
    const noteEl = document.getElementById('sheetNote');
    const operatorEl = document.getElementById('sheetOperator');
    const referenceEl = document.getElementById('sheetReference');
    const statusEl = document.getElementById('sheetStatus');
    if(titleEl) sheet.title = titleEl.value;
    if(clientEl) sheet.client = clientEl.value;
    if(dateEl) sheet.date = dateEl.value ? new Date(dateEl.value).toISOString() : (sheet.date || new Date().toISOString());
    if(noteEl) sheet.note = noteEl.value;
    if(operatorEl) sheet.operator = operatorEl.value;
    if(referenceEl) sheet.reference = referenceEl.value;
    if(statusEl) sheet.status = statusEl.value;
    document.querySelectorAll('#sheetRowsBody [data-row]').forEach(tr => {
      const row = sheet.rows.find(r => r.id === tr.dataset.row);
      if(!row) return;
      tr.querySelectorAll('[data-row-field]').forEach(input => {
        const field = input.dataset.rowField;
        if(['longueur','largeur','epaisseur','quantite'].includes(field)){
          const num = input.value.replace(',', '.').trim();
          row[field] = num === '' ? '' : (parseFloat(num) || 0);
        } else {
          row[field] = input.value;
        }
      });
    });
  }

  function bindSheetEvents(sheet){
    const main = document.getElementById('debitMainArea');

    const saveSheetBtn = document.getElementById('btnSaveSheet');
    if(saveSheetBtn) saveSheetBtn.addEventListener('click', () => {
      syncSheetFromDom(sheet);
      save();
      renderSheetSidebar();
      toast('Fiche enregistrée ✓');
      const status = document.getElementById('saveStatus');
      if(status){
        status.textContent = 'Enregistrée à l’instant ✓';
        status.style.color = 'var(--sage)';
        setTimeout(() => {
          const s = document.getElementById('saveStatus');
          if(s){ s.textContent = 'Enregistrée automatiquement dans ce navigateur'; s.style.color = 'var(--text-dim)'; }
        }, 2500);
      }
    });

    ['sheetTitle','sheetClient','sheetNote','sheetOperator','sheetReference','sheetStatus'].forEach(id => {
      const fieldMap = { sheetTitle:'title', sheetClient:'client', sheetNote:'note', sheetOperator:'operator', sheetReference:'reference', sheetStatus:'status' };
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        sheet[fieldMap[id]] = el.value;
        save(); renderSheetSidebar();
        if(id === 'sheetStatus') el.className = 'fiche-status-select ' + ficheStatusClass(el.value);
      });
    });
    const dateEl = document.getElementById('sheetDate');
    if(dateEl) dateEl.addEventListener('change', () => {
      sheet.date = dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString();
      save(); renderSheetSidebar();
    });

    main.querySelectorAll('[data-row-field]').forEach(input => {
      input.addEventListener('change', () => {
        const tr = input.closest('[data-row]');
        const row = sheet.rows.find(r => r.id === tr.dataset.row);
        const field = input.dataset.rowField;
        if(['longueur','largeur','epaisseur','quantite'].includes(field)){
          const num = input.value.replace(',', '.').trim();
          row[field] = num === '' ? '' : (parseFloat(num) || 0);
          const warning = checkDimensionAlert(field, row[field]);
          input.classList.toggle('input-invalid', !!warning);
          if(warning) toast(warning);
        } else {
          row[field] = input.value;
        }
        save();
        renderSheetSidebar();
        const totalsBar = document.querySelector('.totals-bar');
        if(totalsBar){
          const t = sheetTotals(sheet);
          totalsBar.innerHTML = `
            <div class="tot"><span class="lbl">Total pièces</span><span class="val">${t.pieces}</span></div>
            <div class="tot"><span class="lbl">Longueur cumulée</span><span class="val">${t.linear.toFixed(2)} m</span></div>
            <div class="tot"><span class="lbl">Surface cumulée</span><span class="val">${t.surface.toFixed(2)} m²</span></div>
            <div class="tot"><span class="lbl">Volume (sans marge)</span><span class="val">${t.volume.toFixed(3)} m³</span></div>
            <div class="tot"><span class="lbl">Volume (avec marge)</span><span class="val">${t.volumeWithMargin.toFixed(3)} m³</span></div>
          `;
        }
      });
    });

    const addRowBtn = document.getElementById('btnAddRow');
    if(addRowBtn) addRowBtn.addEventListener('click', () => {
      sheet.rows = sheet.rows || [];
      sheet.rows.push(newRow(sheet.rows.length + 1));
      save(); renderSheetMain(); renderSheetSidebar();
      const designationSelect = document.querySelector('#sheetRowsBody tr:last-child [data-row-field="designation"]');
      if(designationSelect) designationSelect.focus();
    });

    main.querySelectorAll('[data-delete-row]').forEach(btn => {
      btn.addEventListener('click', () => {
        sheet.rows = (sheet.rows||[]).filter(r => r.id !== btn.dataset.deleteRow);
        save(); renderSheetMain(); renderSheetSidebar();
      });
    });

    const delSheetBtn = document.getElementById('btnDeleteSheet');
    if(delSheetBtn) bindConfirmDeleteButton(delSheetBtn, () => {
      trashPut('debitSheets', sheet.title, sheet);
      state.debitSheets = state.debitSheets.filter(s => s.id !== sheet.id);
      selectedSheetId = state.debitSheets[0]?.id ?? null;
      save(); render();
    });

    const csvBtn = document.getElementById('btnExportSheetCsv');
    if(csvBtn) csvBtn.addEventListener('click', () => { syncSheetFromDom(sheet); save(); exportSheetCsv(sheet); });

    const printBtn = document.getElementById('btnPrintSheet');
    if(printBtn) printBtn.addEventListener('click', () => { syncSheetFromDom(sheet); save(); printSheet(sheet); });
  }

  function exportSheetCsv(sheet){
    const t = sheetTotals(sheet);
    const meta = [
      `Fiche;${sheet.reference||''}`,
      `Titre;${sheet.title||''}`,
      `Client;${sheet.client||''}`,
      `Date;${fmtDate(sheet.date || new Date().toISOString())}`,
      `Réalisé par;${sheet.operator||''}`,
      `Volume sans marge (m³);${t.volume.toFixed(3)}`,
      `Volume avec marge (m³);${t.volumeWithMargin.toFixed(3)}`
    ];
    const headers = ['Repère','Désignation','Longueur (mm)','Largeur (mm)','Épaisseur (mm)','Quantité','Matériau','Marge (%)','Observations'];
    const lines = [...meta, '', headers.join(';')];
    (sheet.rows||[]).forEach(r => {
      const vals = [r.repere, r.designation, r.longueur, r.largeur, r.epaisseur, r.quantite, r.materiau, r.marge, r.observation]
        .map(v => `"${String(v ?? '').replace(/"/g,'""')}"`);
      lines.push(vals.join(';'));
    });
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (sheet.title || 'fiche-de-debit').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    a.href = url; a.download = `${safeName || 'fiche-de-debit'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV téléchargé.');
  }

 function pdfSharedStyle(){
    return `
    .pdf-note-block{margin-bottom:16px; padding:12px 14px; border:1px solid #ddd; border-radius:4px; background:#faf9f6;}
    .pdf-note-block h4{margin:0 0 6px; font-size:12px; text-transform:uppercase; letter-spacing:.05em;}
    .pdf-note-block p{margin:0; font-size:11.5px; line-height:1.6;}
    .pdf-table{width:100%; border-collapse:collapse; margin:16px 0; font-size:11px;}
    .pdf-table thead th{background:#1a1a1a; color:#fff; text-align:left; padding:7px 9px; font-weight:600; text-transform:uppercase; font-size:9.5px; letter-spacing:.04em;}
    .pdf-table tbody td{padding:6px 9px; border-bottom:1px solid #ddd;}
    .pdf-table tbody tr:nth-child(even){background:#faf9f6;}
    .pdf-table .num{text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap;}
    .pdf-table .num.income{color:#2f7a3f;}
    .pdf-table .num.expense{color:#a63d2f;}
    .pdf-table .num.investment{color:#9a7b1e;}

  @page{ margin:14mm; }
  *{box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif; color:#1a1a1a; margin:0; padding:22px; font-size:12.5px;}
  .pdf-doc{ }
  .pdf-doc + .pdf-doc{ page-break-before:always; margin-top:0; padding-top:22px; }
  .letterhead{display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #1a1a1a; padding-bottom:14px; margin-bottom:16px;}
  .company-block{display:flex; gap:12px; align-items:flex-start;}
  .company-block img{max-width:64px; max-height:64px; object-fit:contain;}
  .company-name{font-size:15px; font-weight:700; margin:0 0 2px;}
  .company-meta{font-size:10.5px; color:#444; line-height:1.5;}
  .doc-title-block{text-align:right; flex-shrink:0;}
  .doc-title{font-size:19px; font-weight:800; letter-spacing:.06em; margin:0;}
  .doc-ref{font-family:'Courier New',monospace; font-size:13px; color:#1a1a1a; margin-top:4px; font-weight:700;}
  .doc-date{font-size:10.5px; color:#666; margin-top:2px;}

  .project-title{font-size:14px; font-weight:700; margin:0 0 12px;}

  .cartouche{display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #1a1a1a; margin-bottom:14px;}
  .cartouche div{padding:8px 10px; border-right:1px solid #1a1a1a;}
  .cartouche div:last-child{border-right:none;}
  .cartouche span{display:block; font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:#666; margin-bottom:3px;}
  .cartouche strong{font-size:12.5px;}

  .note-bar{background:#f4f2ec; border-left:3px solid #1a1a1a; padding:8px 12px; font-size:11.5px; margin-bottom:14px;}
  .linked-bar{font-size:11px; color:#444; margin-bottom:14px;}
  .linked-bar b{color:#1a1a1a;}

  table.pieces{width:100%; border-collapse:collapse; font-size:11.5px;}
  table.pieces th{background:#1a1a1a; color:#fff; text-align:left; padding:7px 8px; font-size:10px; text-transform:uppercase; letter-spacing:.04em;}
  table.pieces th.c-num{text-align:center;}
  table.pieces td{padding:6px 8px; border-bottom:1px solid #ddd;}
  table.pieces tbody tr:nth-child(even){background:#f7f6f2;}
  .c-repere{font-family:'Courier New',monospace; font-weight:700; width:50px;}
  .c-num{text-align:center; font-family:'Courier New',monospace;}

  .recap{margin-top:18px;}
  .recap h4{font-size:11px; text-transform:uppercase; letter-spacing:.05em; margin:0 0 6px; color:#444;}
  table.recap-table{width:auto; min-width:340px; border-collapse:collapse; font-size:11.5px;}
  table.recap-table th{background:#efeadd; text-align:left; padding:5px 10px; font-size:10px; text-transform:uppercase;}
  table.recap-table td{padding:5px 10px; border-bottom:1px solid #ddd;}

  .totals-strip{display:flex; margin-top:18px; border:1px solid #1a1a1a;}
  .totals-strip div{flex:1; padding:10px 14px; border-right:1px solid #1a1a1a; text-align:center;}
  .totals-strip div:last-child{border-right:none;}
  .totals-strip span{display:block; font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:#666; margin-bottom:3px;}
  .totals-strip b{font-size:17px;}

  .cover-list{margin-top:18px; border:1px solid var(--line, #ddd); border-radius:4px;}
  .cover-list h4{font-size:11px; text-transform:uppercase; letter-spacing:.05em; margin:0; padding:10px 14px; background:#1a1a1a; color:#fff;}
  .cover-list ul{list-style:none; margin:0; padding:0;}
  .cover-list li{padding:9px 14px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; font-size:12px;}
  .cover-list li:last-child{border-bottom:none;}
  .cover-list li .cl-ref{font-family:'Courier New',monospace; color:#666; margin-right:10px;}
  .cover-note{background:#f4f2ec; border-left:3px solid #1a1a1a; padding:10px 14px; font-size:12px; margin-top:16px;}

  .agenda-week{margin-bottom:16px; break-inside:avoid;}
  .agenda-week-header{
    display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; color:#fff;
    padding:7px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.03em; border-radius:4px 4px 0 0;
  }
  .agenda-week-total{font-family:'Courier New',monospace; font-size:12px;}
  .agenda-day-row{
    display:flex; align-items:flex-start; gap:10px; padding:7px 12px; border:1px solid #ddd; border-top:none;
    font-size:10.5px;
  }
  .agenda-day-row:nth-child(even){background:#f7f6f2;}
  .agenda-day-empty{color:#aaa;}
  .agenda-day-label{width:100px; flex-shrink:0; font-weight:700; color:#1a1a1a; padding-top:1px;}
  .agenda-day-empty .agenda-day-label{color:#aaa; font-weight:500;}
  .agenda-outside{font-weight:400; font-style:italic; font-size:9px;}
  .agenda-day-content{flex:1; min-width:0;}
  .agenda-chantier{margin-bottom:2px; color:#333;}
  .agenda-empty-label{color:#ccc;}
  .agenda-off-label{color:#8a6d1f; font-style:italic; font-weight:600;}
  .agenda-day-total{width:56px; flex-shrink:0; text-align:right; font-family:'Courier New',monospace; font-weight:700; color:#5F7455; font-size:10.5px;}
  .cal-dot{display:inline-block; width:7px; height:7px; border-radius:50%; margin-right:4px; vertical-align:middle; flex-shrink:0;}
  .cal-legend{display:flex; flex-wrap:wrap; gap:10px; margin-top:6px; margin-bottom:16px; font-size:9.5px; color:#444;}
  .cal-legend-item{display:flex; align-items:center;}

  .recap-columns{display:flex; gap:24px; margin-top:18px; align-items:flex-start;}
  .recap-columns .recap{flex:1; margin-top:0;}
  .bar-chart{display:flex; align-items:flex-end; gap:10px; height:110px; padding-top:8px;}
  .bar-col{display:flex; flex-direction:column; align-items:center; flex:1; height:100%; justify-content:flex-end;}
  .bar-value{font-size:9px; font-weight:700; color:#1a1a1a; margin-bottom:4px;}
  .bar-track{width:100%; max-width:32px; height:70px; background:#f0eee6; border-radius:3px 3px 0 0; display:flex; align-items:flex-end; overflow:hidden;}
  .bar-fill{width:100%; background:var(--sage,#5F7455); border-radius:3px 3px 0 0;}
  .bar-label{font-size:8.5px; color:#777; margin-top:5px;}

  .signatures{display:flex; gap:24px; margin-top:32px;}
  .sig-box{flex:1; border-top:1px solid #999; padding-top:8px;}
  .sig-box .sig-label{font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:#444; margin-bottom:26px;}
  .sig-box .sig-line{font-size:10.5px; color:#888;}

  .photo-pdf-section{margin-top:18px; break-inside:avoid;}
  .photo-pdf-section h4{font-size:11px; text-transform:uppercase; letter-spacing:.05em; margin:0 0 8px; color:#444; border-bottom:1px solid #ddd; padding-bottom:6px;}
  .photo-pdf-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:8px;}
  .photo-pdf-grid img{width:100%; height:130px; object-fit:cover; border-radius:3px; border:1px solid #ddd;}

  footer{margin-top:30px; font-size:9.5px; color:#999; border-top:1px solid #ddd; padding-top:8px; display:flex; justify-content:space-between;}
  @media print{ .no-print{display:none;} }`;
  }

  function buildSheetPdfBody(sheet){
    const t = sheetTotals(sheet);
    const rows = sheet.rows || [];
    const company = state.company || {};

    const rowsHtml = rows.map(r => `
      <tr>
        <td class="c-repere">${esc(r.repere||'')}</td>
        <td>${esc(r.designation)}</td>
        <td class="c-num">${esc(String(r.longueur ?? ''))}</td>
        <td class="c-num">${esc(String(r.largeur ?? ''))}</td>
        <td class="c-num">${esc(String(r.epaisseur ?? ''))}</td>
        <td class="c-num">${esc(String(r.quantite ?? ''))}</td>
        <td>${esc(r.materiau||'')}</td>
        <td class="c-num">${r.marge !== '' && r.marge != null ? esc(String(r.marge)) + ' %' : ''}</td>
        <td>${esc(r.observation||'')}</td>
      </tr>`).join('') || `<tr><td colspan="9" style="color:#888; padding:14px;">Aucune pièce renseignée.</td></tr>`;

    const recap = materialSummary(rows);
    const recapHtml = recap.length >= 2 ? `
      <div class="recap">
        <h4>Récapitulatif par matériau</h4>
        <table class="recap-table">
          <thead><tr><th>Matériau</th><th>Pièces</th><th>Longueur cumulée</th><th>Surface cumulée</th><th>Volume (sans marge)</th><th>Volume (avec marge)</th></tr></thead>
          <tbody>
            ${recap.map(g => `<tr><td>${esc(g.key)}</td><td>${g.pieces}</td><td>${g.linear.toFixed(2)} m</td><td>${g.surface.toFixed(2)} m²</td><td>${g.volume.toFixed(3)} m³</td><td>${g.volumeWithMargin.toFixed(3)} m³</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    const contactParts = [];
    if(company.phone) contactParts.push('Tél. ' + esc(company.phone));
    if(company.email) contactParts.push(esc(company.email));
    const contactLine = contactParts.join(' · ');

    return `
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
      <p class="doc-title">FICHE DE DÉBIT</p>
      <div class="doc-ref">${esc(sheet.reference || '')}</div>
      <div class="doc-date">Édité le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  ${sheet.title ? `<p class="project-title">${esc(sheet.title)}</p>` : ''}

  <div class="cartouche">
    <div><span>Client / Chantier</span><strong>${esc(sheet.client) || '—'}</strong></div>
    <div><span>Date</span><strong>${fmtDate(sheet.date || new Date().toISOString())}</strong></div>
    <div><span>N° Fiche</span><strong>${esc(sheet.reference) || '—'}</strong></div>
    <div><span>Réalisé par</span><strong>${esc(sheet.operator) || '—'}</strong></div>
  </div>

  ${sheet.note ? `<div class="note-bar">${esc(sheet.note)}</div>` : ''}

  <table class="pieces">
    <thead><tr><th>Repère</th><th>Désignation</th><th class="c-num">Long. (mm)</th><th class="c-num">Larg. (mm)</th><th class="c-num">Ép. (mm)</th><th class="c-num">Qté</th><th>Matériau</th><th class="c-num">Marge</th><th>Observations</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  ${recapHtml}

  <div class="totals-strip">
    <div><span>Total pièces</span><b>${t.pieces}</b></div>
    <div><span>Longueur cumulée</span><b>${t.linear.toFixed(2)} m</b></div>
    <div><span>Surface cumulée</span><b>${t.surface.toFixed(2)} m²</b></div>
    <div><span>Volume (sans marge)</span><b>${t.volume.toFixed(3)} m³</b></div>
    <div><span>Volume (avec marge)</span><b>${t.volumeWithMargin.toFixed(3)} m³</b></div>
  </div>

  <footer>
    <span>${esc(sheet.reference || '')} — ${esc(company.name || 'Mon Entreprise')}</span>
    <span>Généré le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;
  }

  function openPrintWindow(title, bodyHtml){
    const win = window.open('', '_blank');
    if(!win){ toast("Le navigateur a bloqué l'ouverture — autorisez les pop-ups pour télécharger le PDF."); return null; }
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<style>${pdfSharedStyle()}</style></head>
<body>
${bodyHtml}
  <script>
    window.onload = function(){ setTimeout(function(){ window.print(); }, 200); };
  <\/script>
</body></html>`);
    win.document.close();
    return win;
  }

  function printSheet(sheet){
    openPrintWindow(sheet.reference || sheet.title || 'Fiche de débit', buildSheetPdfBody(sheet));
  }

  // ---------- analyses de fabrication : rendu ----------
  function renderMfgSidebar(){
    renderListSidebar({
      listElId: 'mfgList', searchElId: 'mfgSearchInput', dataAttr: 'mfg',
      items: state.manufacturingSheets, selectedId: selectedMfgId,
      matchQuery: (s, q) => (s.title||'').toLowerCase().includes(q),
      emptyMessage: `<div class="empty-side">Aucune analyse pour l'instant.<br>Cliquez sur « + Nouvelle » pour créer votre première analyse de fabrication.</div>`,
      itemHtml: s => {
        const t = mfgSheetTotals(s);
        return `
        <div class="name">${esc(s.title) || '(sans titre)'} <span class="ref-badge">${esc(s.reference||'')}</span></div>
        <div class="meta">${s.client ? esc(s.client)+' · ' : ''}${fmtDate(s.date || new Date().toISOString())}</div>
        <div class="meta">${t.opsCount} opération${t.opsCount!==1?'s':''} · ${formatMinutes(t.totalMinutes)}</div>`;
      }
    });
  }

  function renderMfgMain(){
    const main = document.getElementById('mfgMainArea');
    if(!main) return;
    const sheet = getMfgSheet(selectedMfgId);
    if(!sheet){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucune analyse sélectionnée</h2>
          <p>Créez une analyse de fabrication pour détailler les opérations, machines et temps nécessaires à la réalisation d'un ouvrage.</p>
        </div>`;
      return;
    }
    const ops = sheet.operations || [];
    const t = mfgSheetTotals(sheet);
    const clientLower = (sheet.client||'').trim().toLowerCase();
    const linkedIds = sheet.linkedDebitSheetIds || [];
    const linkedSheets = linkedIds.map(id => getSheet(id)).filter(Boolean);
    const availableDebitSheets = state.debitSheets
      .filter(ds => !linkedIds.includes(ds.id))
      .slice()
      .sort((a,b) => {
        const aMatch = (clientLower && (a.client||'').toLowerCase().includes(clientLower)) ? 0 : 1;
        const bMatch = (clientLower && (b.client||'').toLowerCase().includes(clientLower)) ? 0 : 1;
        if(aMatch !== bMatch) return aMatch - bMatch;
        return (a.title||'').localeCompare(b.title||'');
      });

    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Analyse de fabrication <span class="ref-badge">${esc(sheet.reference||'')}</span></span></div>
          <div id="mfgSaveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistrée automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          ${folderLinkControl('mfg', sheet.id)}
          <button class="btn btn-sage" id="btnSaveMfg">Enregistrer</button>
          <button class="btn btn-line" id="btnDuplicateMfg">Dupliquer</button>
          <button class="btn btn-line" id="btnExportMfgCsv">Télécharger CSV</button>
          <button class="btn btn-gold" id="btnPrintMfg">Télécharger PDF</button>
          <button class="btn btn-danger" id="btnDeleteMfg">Supprimer</button>
        </div>
      </div>
      <div class="sheet-header-form">
        <div class="field full">
          <label>Titre / Ouvrage</label>
          <input type="text" id="mfgTitle" value="${esc(sheet.title||'')}" placeholder="ex. Portail double vantaux — Chantier Dupont">
        </div>
        <div class="field">
          <label>Client / Chantier</label>
          <input type="text" id="mfgClient" value="${esc(sheet.client||'')}" placeholder="ex. M. Dupont, 12 rue des Lilas">
        </div>
        <div class="field">
          <label>Date</label>
          <input type="date" id="mfgDate" value="${(sheet.date||'').slice(0,10)}">
        </div>
        <div class="field">
          <label>Réalisé par</label>
          <input type="text" id="mfgOperator" value="${esc(sheet.operator||'')}" placeholder="ex. J. Martin">
        </div>
        <div class="field">
          <label>N° d'analyse</label>
          <input type="text" id="mfgReference" value="${esc(sheet.reference||'')}">
        </div>
        <div class="field full">
          <label>Note générale</label>
          <input type="text" id="mfgNote" value="${esc(sheet.note||'')}" placeholder="ex. Bois massif chêne, assemblages à tenon-mortaise">
        </div>
        <div class="field full">
          <label>Fiches de débit liées${clientLower ? ' — suggestions basées sur le chantier' : ''}</label>
          <div class="lib-chip-list">
            ${linkedSheets.length ? linkedSheets.map(ds => `
              <span class="lib-chip">${esc(ds.reference||'')} — ${esc(ds.title||'(sans titre)')}<button type="button" data-unlink-debit="${ds.id}" title="Délier">&times;</button></span>
            `).join('') : `<span style="font-size:12px; color:var(--text-dim);">Aucune fiche liée.</span>`}
          </div>
          ${availableDebitSheets.length ? `
            <select id="linkDebitSelect" class="lib-add-select">
              <option value="">+ Lier une fiche de débit…</option>
              ${availableDebitSheets.map(ds => `<option value="${ds.id}">${(clientLower && (ds.client||'').toLowerCase().includes(clientLower)) ? '★ ' : ''}${esc(ds.reference||'')} — ${esc(ds.title||'(sans titre)')}${ds.client ? ' ('+esc(ds.client)+')' : ''}</option>`).join('')}
            </select>
          ` : `<span style="font-size:11.5px; color:var(--text-dim);">${state.debitSheets.length ? 'Toutes les fiches disponibles sont déjà liées.' : "Aucune fiche de débit créée pour l'instant."}</span>`}
        </div>
      </div>

      <div class="debit-table-wrap">
        <table class="debit-table">
          <thead>
            <tr>
              <th style="width:56px;">Repère</th>
              <th>Désignation</th>
              <th style="width:150px;">Machine / poste</th>
              <th style="width:90px;">Temps (min)</th>
              <th style="width:56px; text-align:center;">Contrôle</th>
              <th>Observations</th>
              <th class="col-actions" style="width:56px;"></th>
            </tr>
          </thead>
          <tbody id="mfgOperationsBody">
            ${ops.map(op => renderOperationRow(op)).join('') || `<tr><td colspan="7" style="color:var(--text-dim); font-size:12.5px; padding:14px 8px;">Aucune opération. Ajoutez une ligne pour commencer la gamme de fabrication.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="add-row">
        <button class="btn btn-line" id="btnAddOperation" style="padding:6px 12px; font-size:12.5px;">+ Ajouter une ligne</button>
      </div>

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Opérations</span><span class="val">${t.opsCount}</span></div>
        <div class="tot"><span class="lbl">Temps total estimé</span><span class="val">${formatMinutes(t.totalMinutes)}</span></div>
      </div>
    `;
    bindMfgEvents(sheet);
  }

  function renderOperationRow(op){
    const stepNames = (state.operationSteps||[]).map(s => s.name).sort((a,b) => a.localeCompare(b, 'fr'));
    if(op.designation && !stepNames.includes(op.designation)) stepNames.unshift(op.designation);
    const machineNames = (state.machines||[]).map(m => m.name).sort((a,b) => a.localeCompare(b, 'fr'));
    if(op.machine && !machineNames.includes(op.machine)) machineNames.unshift(op.machine);
    return `
    <tr data-op="${op.id}">
      <td class="op-num-cell">${esc(op.repere||'')}</td>
      <td>
        <select data-op-field="designation">
          <option value="">—</option>
          ${stepNames.map(n => `<option value="${esc(n)}" ${n === op.designation ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
      </td>
      <td>
        <select data-op-field="machine">
          <option value="">—</option>
          ${machineNames.map(n => `<option value="${esc(n)}" ${n === op.machine ? 'selected' : ''}>${esc(n)}</option>`).join('')}
        </select>
      </td>
      <td><input type="text" class="num" inputmode="decimal" data-op-field="temps" value="${esc(String(op.temps ?? ''))}"></td>
      <td class="col-controle"><input type="checkbox" class="controle-check" data-op-controle="${op.id}" ${op.controle ? 'checked' : ''} title="Contrôlé / validé"></td>
      <td><input type="text" data-op-field="observation" value="${esc(op.observation||'')}"></td>
      <td class="col-actions">
        <button class="btn btn-danger" data-insert-op-after="${op.id}" title="Insérer une ligne après" style="padding:2px; color:var(--sage);">+</button>
        <button class="btn btn-danger" data-delete-op="${op.id}" title="Supprimer la ligne" style="padding:2px;">&times;</button>
      </td>
    </tr>`;
  }

  function syncMfgFromDom(sheet){
    const fieldMap = { mfgTitle:'title', mfgClient:'client', mfgOperator:'operator', mfgReference:'reference', mfgNote:'note' };
    Object.keys(fieldMap).forEach(id => {
      const el = document.getElementById(id);
      if(el) sheet[fieldMap[id]] = el.value;
    });
    const dateEl = document.getElementById('mfgDate');
    if(dateEl) sheet.date = dateEl.value ? new Date(dateEl.value).toISOString() : (sheet.date || new Date().toISOString());
    document.querySelectorAll('#mfgOperationsBody [data-op]').forEach(tr => {
      const op = sheet.operations.find(o => o.id === tr.dataset.op);
      if(!op) return;
      tr.querySelectorAll('[data-op-field]').forEach(input => {
        const field = input.dataset.opField;
        if(field === 'temps'){
          const num = input.value.replace(',', '.').trim();
          op[field] = num === '' ? '' : (parseFloat(num) || 0);
        } else {
          op[field] = input.value;
        }
      });
      const controleInput = tr.querySelector('[data-op-controle]');
      if(controleInput) op.controle = controleInput.checked;
    });
  }

  function bindMfgEvents(sheet){
    const main = document.getElementById('mfgMainArea');

    const saveMfgBtn = document.getElementById('btnSaveMfg');
    if(saveMfgBtn) saveMfgBtn.addEventListener('click', () => {
      syncMfgFromDom(sheet);
      save();
      renderMfgSidebar();
      toast('Analyse enregistrée ✓');
      const status = document.getElementById('mfgSaveStatus');
      if(status){
        status.textContent = 'Enregistrée à l’instant ✓';
        status.style.color = 'var(--sage)';
        setTimeout(() => {
          const s = document.getElementById('mfgSaveStatus');
          if(s){ s.textContent = 'Enregistrée automatiquement dans ce navigateur'; s.style.color = 'var(--text-dim)'; }
        }, 2500);
      }
    });

    const fieldMap = { mfgTitle:'title', mfgClient:'client', mfgOperator:'operator', mfgReference:'reference', mfgNote:'note' };
    Object.keys(fieldMap).forEach(id => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('change', () => {
        sheet[fieldMap[id]] = el.value;
        save();
        renderMfgSidebar();
        if(id === 'mfgClient') renderMfgMain(); // rafraîchit les suggestions de fiches liées
      });
    });
    const dateEl = document.getElementById('mfgDate');
    if(dateEl) dateEl.addEventListener('change', () => {
      sheet.date = dateEl.value ? new Date(dateEl.value).toISOString() : new Date().toISOString();
      save(); renderMfgSidebar();
    });

    // liaison des fiches de débit
    const linkSelect = document.getElementById('linkDebitSelect');
    if(linkSelect) linkSelect.addEventListener('change', () => {
      if(!linkSelect.value) return;
      sheet.linkedDebitSheetIds = sheet.linkedDebitSheetIds || [];
      if(!sheet.linkedDebitSheetIds.includes(linkSelect.value)) sheet.linkedDebitSheetIds.push(linkSelect.value);
      save(); renderMfgMain(); renderMfgSidebar();
    });
    main.querySelectorAll('[data-unlink-debit]').forEach(btn => {
      btn.addEventListener('click', () => {
        sheet.linkedDebitSheetIds = (sheet.linkedDebitSheetIds||[]).filter(id => id !== btn.dataset.unlinkDebit);
        save(); renderMfgMain(); renderMfgSidebar();
      });
    });

    main.querySelectorAll('[data-op-field]').forEach(input => {
      input.addEventListener('change', () => {
        const tr = input.closest('[data-op]');
        const op = sheet.operations.find(o => o.id === tr.dataset.op);
        const field = input.dataset.opField;
        if(field === 'temps'){
          const num = input.value.replace(',', '.').trim();
          op[field] = num === '' ? '' : (parseFloat(num) || 0);
        } else {
          op[field] = input.value;
        }
        save();
        renderMfgSidebar();
        const totalsBar = document.querySelector('#mfgMainArea .totals-bar');
        if(totalsBar){
          const t = mfgSheetTotals(sheet);
          totalsBar.innerHTML = `
            <div class="tot"><span class="lbl">Opérations</span><span class="val">${t.opsCount}</span></div>
            <div class="tot"><span class="lbl">Temps total estimé</span><span class="val">${formatMinutes(t.totalMinutes)}</span></div>
          `;
        }
      });
    });

    main.querySelectorAll('[data-op-controle]').forEach(cb => {
      cb.addEventListener('change', () => {
        const op = sheet.operations.find(o => o.id === cb.dataset.opControle);
        if(!op) return;
        op.controle = cb.checked;
        save();
      });
    });

    const addOpBtn = document.getElementById('btnAddOperation');
    if(addOpBtn) addOpBtn.addEventListener('click', () => {
      syncMfgFromDom(sheet);
      sheet.operations = sheet.operations || [];
      sheet.operations.push(newOperation());
      renumberOperations(sheet);
      save(); renderMfgMain(); renderMfgSidebar();
      const designationSelect = document.querySelector('#mfgOperationsBody tr:last-child [data-op-field="designation"]');
      if(designationSelect) designationSelect.focus();
    });

    main.querySelectorAll('[data-insert-op-after]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncMfgFromDom(sheet);
        const idx = sheet.operations.findIndex(o => o.id === btn.dataset.insertOpAfter);
        if(idx === -1) return;
        const newOp = newOperation();
        sheet.operations.splice(idx + 1, 0, newOp);
        renumberOperations(sheet);
        save(); renderMfgMain(); renderMfgSidebar();
        const designationSelect = document.querySelector(`#mfgOperationsBody [data-op="${newOp.id}"] [data-op-field="designation"]`);
        if(designationSelect) designationSelect.focus();
      });
    });

    main.querySelectorAll('[data-delete-op]').forEach(btn => {
      btn.addEventListener('click', () => {
        syncMfgFromDom(sheet);
        sheet.operations = (sheet.operations||[]).filter(o => o.id !== btn.dataset.deleteOp);
        renumberOperations(sheet);
        save(); renderMfgMain(); renderMfgSidebar();
      });
    });

    const delMfgBtn = document.getElementById('btnDeleteMfg');
    if(delMfgBtn) bindConfirmDeleteButton(delMfgBtn, () => {
      trashPut('manufacturingSheets', sheet.title, sheet);
      state.manufacturingSheets = state.manufacturingSheets.filter(s => s.id !== sheet.id);
      selectedMfgId = state.manufacturingSheets[0]?.id ?? null;
      save(); render();
    });

    const dupMfgBtn = document.getElementById('btnDuplicateMfg');
    if(dupMfgBtn) dupMfgBtn.addEventListener('click', () => {
      syncMfgFromDom(sheet);
      const copy = JSON.parse(JSON.stringify(sheet));
      copy.id = uid();
      copy.title = (sheet.title || 'Analyse') + ' (copie)';
      copy.date = new Date().toISOString();
      copy.operations = (copy.operations||[]).map(op => ({ ...op, id: uid() }));
      copy.linkedDebitSheetIds = [...(copy.linkedDebitSheetIds||[])];
      copy.reference = generateMfgReference(state, copy);
      state.manufacturingSheets.unshift(copy);
      selectedMfgId = copy.id;
      save(); render();
      toast('Analyse dupliquée ✓');
    });

    const csvBtn = document.getElementById('btnExportMfgCsv');
    if(csvBtn) csvBtn.addEventListener('click', () => { syncMfgFromDom(sheet); save(); exportMfgCsv(sheet); });

    const printBtn = document.getElementById('btnPrintMfg');
    if(printBtn) printBtn.addEventListener('click', () => { syncMfgFromDom(sheet); save(); printMfgSheet(sheet); });
  }

  function exportMfgCsv(sheet){
    const linkedSheets = (sheet.linkedDebitSheetIds||[]).map(id => getSheet(id)).filter(Boolean);
    const meta = [
      `Analyse;${sheet.reference||''}`,
      `Titre;${sheet.title||''}`,
      `Client;${sheet.client||''}`,
      `Date;${fmtDate(sheet.date || new Date().toISOString())}`,
      `Réalisé par;${sheet.operator||''}`,
      `Fiches de débit liées;${linkedSheets.map(ds => ds.reference||'').join(', ')}`
    ];
    const headers = ['Repère','Désignation','Machine','Temps (min)','Contrôlé','Observations'];
    const lines = [...meta, '', headers.join(';')];
    (sheet.operations||[]).forEach(op => {
      const vals = [op.repere, op.designation, op.machine, op.temps, op.controle ? 'Oui' : 'Non', op.observation]
        .map(v => `"${String(v ?? '').replace(/"/g,'""')}"`);
      lines.push(vals.join(';'));
    });
    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (sheet.title || 'analyse-fabrication').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    a.href = url; a.download = `${safeName || 'analyse-fabrication'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV téléchargé.');
  }

  function buildMfgPdfBody(sheet){
    const t = mfgSheetTotals(sheet);
    const ops = sheet.operations || [];
    const company = state.company || {};
    const linkedSheets = (sheet.linkedDebitSheetIds||[]).map(id => getSheet(id)).filter(Boolean);

    const rowsHtml = ops.map(op => `
      <tr>
        <td class="c-repere">${esc(op.repere||'')}</td>
        <td>${esc(op.designation)}</td>
        <td>${esc(op.machine||'')}</td>
        <td class="c-num">${esc(String(op.temps ?? ''))}</td>
        <td class="c-num">${op.controle ? '✓' : '☐'}</td>
        <td>${esc(op.observation||'')}</td>
      </tr>`).join('') || `<tr><td colspan="6" style="color:#888; padding:14px;">Aucune opération renseignée.</td></tr>`;

    const contactParts = [];
    if(company.phone) contactParts.push('Tél. ' + esc(company.phone));
    if(company.email) contactParts.push(esc(company.email));
    const contactLine = contactParts.join(' · ');

    return `
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
      <p class="doc-title">ANALYSE DE FABRICATION</p>
      <div class="doc-ref">${esc(sheet.reference || '')}</div>
      <div class="doc-date">Édité le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  ${sheet.title ? `<p class="project-title">${esc(sheet.title)}</p>` : ''}

  <div class="cartouche">
    <div><span>Client / Chantier</span><strong>${esc(sheet.client) || '—'}</strong></div>
    <div><span>Date</span><strong>${fmtDate(sheet.date || new Date().toISOString())}</strong></div>
    <div><span>N° Analyse</span><strong>${esc(sheet.reference) || '—'}</strong></div>
    <div><span>Réalisé par</span><strong>${esc(sheet.operator) || '—'}</strong></div>
  </div>

  ${linkedSheets.length ? `<div class="linked-bar">Fiches de débit associées : <b>${linkedSheets.map(ds => esc(ds.reference||'')).join(', ')}</b></div>` : ''}

  ${sheet.note ? `<div class="note-bar">${esc(sheet.note)}</div>` : ''}

  <table class="pieces">
    <thead><tr><th>Repère</th><th>Désignation</th><th>Machine / poste</th><th class="c-num">Temps (min)</th><th class="c-num">Contrôle</th><th>Observations</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="totals-strip">
    <div><span>Opérations</span><b>${t.opsCount}</b></div>
    <div><span>Temps total estimé</span><b>${formatMinutes(t.totalMinutes)}</b></div>
  </div>

  <footer>
    <span>${esc(sheet.reference || '')} — ${esc(company.name || 'Mon Entreprise')}</span>
    <span>Généré le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;
  }

  function printMfgSheet(sheet){
    openPrintWindow(sheet.reference || sheet.title || 'Analyse de fabrication', buildMfgPdfBody(sheet));
  }

  // ---------- dossiers ----------
