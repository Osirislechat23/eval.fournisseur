  function getRecipe(id){ return state.recipes.find(r => r.id === id); }
  function newIngredient(){ return { id: uid(), text: '' }; }
  function recipeDisplayTitle(r){ return (r.title && r.title.trim()) ? r.title.trim() : 'Sans titre'; }

  function renderRecipesSidebar(){
    const sorted = state.recipes.slice().sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));
    renderListSidebar({
      listElId: 'recipeList', searchElId: 'recipeSearchInput', dataAttr: 'recipe',
      items: sorted, selectedId: selectedRecipeId,
      matchQuery: (r, q) => recipeDisplayTitle(r).toLowerCase().includes(q) || (r.ingredients||[]).some(ing => (ing.text||'').toLowerCase().includes(q)),
      emptyMessage: `<div class="empty-side">Aucune recette pour l'instant.<br>Cliquez sur « + Nouvelle » pour noter un plat, ses ingrédients et quelques photos.</div>`,
      itemHtml: r => {
        const nb = (r.ingredients||[]).length;
        const nbPhotos = (r.photos||[]).length;
        return `
        <div class="name">${esc(recipeDisplayTitle(r))}</div>
        <div class="meta">${nb} ingrédient${nb!==1?'s':''}${nbPhotos ? ' · '+nbPhotos+' photo'+(nbPhotos!==1?'s':'') : ''}</div>
        <div class="meta">${relativeDate(r.updatedAt||r.createdAt)}</div>`;
      }
    });
  }

  function renderRecipeMain(){
    const main = document.getElementById('recipeMainArea');
    if(!main) return;
    const r = getRecipe(selectedRecipeId);
    if(!r){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucune recette sélectionnée</h2>
          <p>Note le nom d'un plat, ses ingrédients, quelques photos et tes commentaires — pas d'étapes de préparation, juste l'essentiel.</p>
        </div>`;
      return;
    }
    const photos = r.photos || [];
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div>
          <div class="section-label" style="margin-bottom:0;"><span>Recette</span></div>
          <div id="recipeSaveStatus" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Enregistrée automatiquement dans ce navigateur</div>
        </div>
        <div class="sheet-toolbar-actions">
          <button class="btn btn-danger" id="btnDeleteRecipe">Supprimer</button>
        </div>
      </div>
      <input type="text" id="recipeTitle" value="${esc(r.title||'')}" placeholder="Nom du plat"
        style="width:100%; border:none; background:transparent; font-family:'Fraunces',serif; font-weight:600; font-size:20px; color:var(--ink); padding:6px 0; margin-bottom:16px; border-bottom:1px solid var(--line);">

      <div class="section-label"><span>Ingrédients</span></div>
      <div id="recipeIngredientsList">${renderIngredientsList(r)}</div>
      <button class="btn btn-line" id="btnAddIngredient" style="padding:6px 12px; font-size:12.5px; margin-bottom:18px;">+ Ajouter un ingrédient</button>

      <div class="section-label"><span>Photos</span></div>
      <div class="photo-section-block" style="margin-bottom:18px;">
        ${photos.length ? `
          <div class="photo-gallery-grid">
            ${photos.map((src,i) => `
              <div class="photo-gallery-thumb">
                <img src="${resolvePhotoSrc(src)}" data-photo-ref="${esc(src)}" data-view-recipe-photo="${i}" alt="Photo ${i+1}">
                <button class="photo-remove-btn" data-remove-recipe-photo="${i}" title="Retirer cette photo">&times;</button>
              </div>
            `).join('')}
          </div>
        ` : `<div class="photo-gallery-empty">Aucune photo pour l'instant.</div>`}
        <label class="btn btn-line" style="display:inline-block; cursor:pointer; padding:6px 12px; font-size:12.5px;">
          Ajouter des photos
          <input type="file" accept="image/*" multiple id="recipePhotoUpload" style="display:none;">
        </label>
      </div>

      <div class="section-label"><span>Commentaires</span></div>
      <textarea id="recipeComments" placeholder="Astuces, variantes, d'où vient la recette, avec quoi la servir…"
        style="width:100%; min-height:30vh; border:1px solid var(--line); border-radius:6px; padding:14px; font-family:'IBM Plex Sans'; font-size:14.5px; line-height:1.6; background:var(--paper-raised); color:var(--ink); resize:vertical;">${esc(r.comments||'')}</textarea>
    `;
    bindRecipeEvents(r);
  }

  function renderIngredientsList(r){
    const ingredients = r.ingredients || [];
    if(!ingredients.length){
      return `<div class="empty-side" style="padding:6px 0 10px;">Aucun ingrédient pour l'instant.</div>`;
    }
    return ingredients.map(ing => `
      <div class="lib-add-row" data-ingredient="${ing.id}" style="margin-bottom:6px;">
        <input type="text" data-ingredient-text="${ing.id}" value="${esc(ing.text||'')}" placeholder="ex. 200g de farine">
        <button class="btn btn-danger" data-delete-ingredient="${ing.id}" title="Retirer" style="padding:4px 10px;">&times;</button>
      </div>
    `).join('');
  }

  function bindRecipeEvents(r){
    const main = document.getElementById('recipeMainArea');
    const titleInput = document.getElementById('recipeTitle');
    const commentsInput = document.getElementById('recipeComments');
    let fieldTimer = null;
    const ingredientTimers = {};

    // Avant tout re-rendu (ajout/suppression d'ingrédient ou de photo), on committe immédiatement
    // ce qui est actuellement tapé dans les champs, pour ne jamais perdre de texte en cours de frappe.
    function flushPendingEdits(){
      if(titleInput) r.title = titleInput.value;
      if(commentsInput) r.comments = commentsInput.value;
      main.querySelectorAll('[data-ingredient-text]').forEach(input => {
        const ing = (r.ingredients||[]).find(x => x.id === input.dataset.ingredientText);
        if(ing) ing.text = input.value;
      });
    }

    function scheduleSave(){
      const status = document.getElementById('recipeSaveStatus');
      if(status){ status.textContent = 'Modification en cours…'; status.style.color = 'var(--gold)'; }
      clearTimeout(fieldTimer);
      fieldTimer = setTimeout(() => {
        r.title = titleInput.value;
        r.comments = commentsInput.value;
        r.updatedAt = new Date().toISOString();
        save();
        renderRecipesSidebar();
        const s = document.getElementById('recipeSaveStatus');
        if(s){ s.textContent = 'Enregistrée automatiquement dans ce navigateur'; s.style.color = 'var(--text-dim)'; }
      }, 600);
    }
    if(titleInput) titleInput.addEventListener('input', scheduleSave);
    if(commentsInput) commentsInput.addEventListener('input', scheduleSave);

    main.querySelectorAll('[data-ingredient-text]').forEach(input => {
      const ingId = input.dataset.ingredientText;
      input.addEventListener('input', () => {
        const ing = (r.ingredients||[]).find(x => x.id === ingId);
        if(!ing) return;
        clearTimeout(ingredientTimers[ingId]);
        ingredientTimers[ingId] = setTimeout(() => {
          ing.text = input.value;
          r.updatedAt = new Date().toISOString();
          save();
          renderRecipesSidebar();
        }, 600);
      });
    });

    const addIngBtn = document.getElementById('btnAddIngredient');
    if(addIngBtn) addIngBtn.addEventListener('click', () => {
      flushPendingEdits();
      r.ingredients = r.ingredients || [];
      r.ingredients.push(newIngredient());
      r.updatedAt = new Date().toISOString();
      save(); renderRecipeMain(); renderRecipesSidebar();
      const inputs = document.querySelectorAll('#recipeIngredientsList input');
      if(inputs.length) inputs[inputs.length-1].focus();
    });

    main.querySelectorAll('[data-delete-ingredient]').forEach(btn => {
      btn.addEventListener('click', () => {
        flushPendingEdits();
        r.ingredients = (r.ingredients||[]).filter(x => x.id !== btn.dataset.deleteIngredient);
        r.updatedAt = new Date().toISOString();
        save(); renderRecipeMain(); renderRecipesSidebar();
      });
    });

    const photoUpload = document.getElementById('recipePhotoUpload');
    if(photoUpload) photoUpload.addEventListener('change', e => {
      flushPendingEdits();
      const files = Array.from(e.target.files || []);
      if(!files.length) return;
      let remaining = files.length;
      files.forEach(file => {
        resizeImage(file, async dataUrl => {
          const ref = await storePhoto(dataUrl, 'recipe');
          r.photos = r.photos || [];
          r.photos.push(ref);
          remaining--;
          if(remaining === 0){
            r.updatedAt = new Date().toISOString();
            save(); renderRecipeMain(); renderRecipesSidebar();
          }
        });
      });
    });

    main.querySelectorAll('[data-remove-recipe-photo]').forEach(btn => {
      btn.addEventListener('click', () => {
        flushPendingEdits();
        const idx = parseInt(btn.dataset.removeRecipePhoto, 10);
        const [removed] = r.photos.splice(idx, 1);
        deletePhotoRef(removed);
        r.updatedAt = new Date().toISOString();
        save(); renderRecipeMain(); renderRecipesSidebar();
      });
    });

    main.querySelectorAll('[data-view-recipe-photo]').forEach(img => {
      img.addEventListener('click', async () => {
        const idx = parseInt(img.dataset.viewRecipePhoto, 10);
        const srcs = await Promise.all((r.photos || []).map(getPhotoDataUrl));
        openLightbox(srcs, idx);
      });
    });

    const delBtn = document.getElementById('btnDeleteRecipe');
    if(delBtn) bindConfirmDeleteButton(delBtn, () => {
      trashPut('recipes', r.title, r);
      state.recipes = state.recipes.filter(x => x.id !== r.id);
      selectedRecipeId = state.recipes[0]?.id ?? null;
      save(); render();
    });
  }

  // ---------- heures de travail (espace calcul) ----------
  function hoursSelectHtml(field, selected, type){
    let html = `<select class="hours-time-select" data-${field}>`;
    html += `<option value="">--</option>`;
    if(type === 'hour'){
      for(let h=0; h<24; h++){
        html += `<option value="${h}" ${String(selected)===String(h)?'selected':''}>${String(h).padStart(2,'0')}h</option>`;
      }
    } else {
      [0,15,30,45].forEach(m => {
        html += `<option value="${m}" ${String(selected)===String(m)?'selected':''}>${String(m).padStart(2,'0')}</option>`;
      });
    }
    html += `</select>`;
    return html;
  }
  function hoursKnownChantierNames(){
    const names = new Set();
    state.hoursWeeks.forEach(w => (w.days||[]).forEach(d => (d.chantiers||[]).forEach(c => {
      if(c.name && c.name.trim()) names.add(c.name.trim());
    })));
    return Array.from(names).sort((a,b) => a.localeCompare(b, 'fr'));
  }
  function renderChantierRow(dayIdx, chantier){
    return `
      <div class="hours-chantier-row" data-chantier-id="${chantier.id}">
        <input type="text" class="hours-chantier-name" list="hoursChantierNames" placeholder="Nom du chantier"
               data-chantier-field="name" value="${esc(chantier.name||'')}">
        <div class="hours-chantier-times">
          ${hoursSelectHtml('chantier-field="startHour"', chantier.startHour, 'hour')}
          <span class="hours-time-sep">:</span>
          ${hoursSelectHtml('chantier-field="startMinute"', chantier.startMinute, 'minute')}
          <span class="hours-time-sep">→</span>
          ${hoursSelectHtml('chantier-field="endHour"', chantier.endHour, 'hour')}
          <span class="hours-time-sep">:</span>
          ${hoursSelectHtml('chantier-field="endMinute"', chantier.endMinute, 'minute')}
          <button type="button" class="hours-remove-pause-btn" data-delete-chantier="${chantier.id}" title="Retirer ce chantier">&times;</button>
        </div>
      </div>`;
  }
  const HOURS_DAY_STATUS_LABELS = { normal:'Travail', ferie:'Férié', conge:'🏖️ Congé' };
  function renderDayRow(week, dayIdx){
    const day = week.days[dayIdx];
    const status = day.status || 'normal';
    const dayDate = new Date(week.weekStart);
    dayDate.setDate(dayDate.getDate() + dayIdx);
    const minutes = hoursDayMinutes(day);
    return `
      <div class="hours-day-row" data-day-index="${dayIdx}">
        <div class="hours-day-head">
          <div><span class="hours-day-name">${HOURS_DAY_NAMES[dayIdx]}</span><span class="hours-day-date">${dayDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span></div>
          <div class="hours-day-total ${minutes===0?'zero':''}">${status !== 'normal' ? HOURS_DAY_STATUS_LABELS[status] : (minutes>0 ? hoursFormatDuration(minutes/60) : '—')}</div>
        </div>
        <div class="hours-day-status-row">
          ${Object.keys(HOURS_DAY_STATUS_LABELS).map(key => `
            <button type="button" class="hours-status-btn ${status===key?'active':''}" data-day-status="${dayIdx}" data-status-value="${key}">${HOURS_DAY_STATUS_LABELS[key]}</button>
          `).join('')}
        </div>
        ${status === 'normal' ? `
          <div class="hours-chantiers-wrap">
            ${(day.chantiers||[]).map(c => renderChantierRow(dayIdx, c)).join('')}
            <button type="button" class="hours-add-pause-btn" data-add-chantier="${dayIdx}">+ Ajouter un chantier</button>
          </div>
        ` : `<div class="hours-day-off">${HOURS_DAY_STATUS_LABELS[status]} — aucune heure à saisir ce jour-là.</div>`}
      </div>`;
  }
  function renderHoursSidebar(){
    const list = document.getElementById('hoursList');
    const summaryWrap = document.getElementById('hoursSummary');
    if(!list) return;
    if(summaryWrap){
      const sum = hoursSummary();
      summaryWrap.innerHTML = `
        <div class="hours-summary-card"><span class="lbl">Semaine affichée</span><span class="val">${hoursFormatDuration(sum.weekHours)}</span></div>
        <div class="hours-summary-card"><span class="lbl">Mois affiché</span><span class="val">${hoursFormatDuration(sum.monthHours)}</span></div>
      `;
    }
    if(!state.hoursWeeks.length){
      list.innerHTML = `<div class="empty-side">Aucune semaine enregistrée pour l'instant.<br>Renseigne tes horaires dans la semaine affichée à droite.</div>`;
      return;
    }
    // Regroupe par année puis par mois (mois déterminé par le lundi de chaque semaine).
    // Chaque année est une section repliable, pour vraiment "ranger" les semaines au fil du temps.
    const years = {};
    state.hoursWeeks.forEach(w => {
      const d = new Date(w.weekStart);
      const year = d.getFullYear(), month = d.getMonth();
      if(!years[year]) years[year] = {};
      if(!years[year][month]) years[year][month] = [];
      years[year][month].push(w);
    });
    const yearKeys = Object.keys(years).sort((a,b) => b-a);
    if(hoursExpandedYears === null){
      hoursExpandedYears = new Set([String(new Date(selectedWeekStart).getFullYear())]);
    }
    if(hoursExpandedMonths === null){
      const d0 = new Date(selectedWeekStart);
      hoursExpandedMonths = new Set([`${d0.getFullYear()}-${d0.getMonth()}`]);
    }
    list.innerHTML = yearKeys.map(year => {
      const expanded = hoursExpandedYears.has(year);
      const yearTotalMin = Object.values(years[year]).flat().reduce((s,w) => s + hoursWeekTotalMinutes(w), 0);
      const monthKeys = Object.keys(years[year]).sort((a,b) => b-a);
      const monthsHtml = !expanded ? '' : monthKeys.map(month => {
        const monthKey = `${year}-${month}`;
        const monthExpanded = hoursExpandedMonths.has(monthKey);
        const weeks = years[year][month].slice().sort((a,b) => new Date(b.weekStart) - new Date(a.weekStart));
        const monthTotalMin = weeks.reduce((s,w) => s + hoursWeekTotalMinutes(w), 0);
        const weeksHtml = !monthExpanded ? '' : weeks.map(w => {
          const start = new Date(w.weekStart);
          const end = new Date(start); end.setDate(end.getDate()+6);
          const totalMin = hoursWeekTotalMinutes(w);
          return `
          <div class="sheet-item ${w.weekStart===selectedWeekStart?'active':''}" data-week="${w.weekStart}" tabindex="0">
            <div class="name">Semaine du ${start.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} <span class="ref-badge">${esc(w.reference||'')}</span></div>
            <div class="meta">au ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>
            <div class="meta"><strong>${hoursFormatDuration(totalMin/60)}</strong></div>
          </div>`;
        }).join('');
        return `
          <div class="hours-month-header" data-month-toggle="${monthKey}" tabindex="0" role="button" aria-expanded="${monthExpanded}">
            <span class="hours-month-caret">${monthExpanded ? '▾' : '▸'}</span>
            <span class="hours-month-label">${HOURS_MONTH_NAMES[month]}</span>
            <span class="hours-month-total">${hoursFormatDuration(monthTotalMin/60)}</span>
          </div>
          ${weeksHtml}`;
      }).join('');
      return `
        <div class="hours-year-header" data-year-toggle="${year}" tabindex="0" role="button" aria-expanded="${expanded}">
          <span class="hours-year-caret">${expanded ? '▾' : '▸'}</span>
          <span class="hours-year-label">${year}</span>
          <span class="hours-year-total">${hoursFormatDuration(yearTotalMin/60)}</span>
        </div>
        ${monthsHtml}`;
    }).join('');
  }
  function renderHoursMain(){
    const main = document.getElementById('hoursMainArea');
    if(!main) return;
    const week = getOrCreateWeek(selectedWeekStart);
    const start = new Date(week.weekStart);
    const end = new Date(start); end.setDate(end.getDate()+6);
    const totalMinutes = hoursWeekTotalMinutes(week);

    main.innerHTML = `
      <datalist id="hoursChantierNames">
        ${hoursKnownChantierNames().map(n => `<option value="${esc(n)}"></option>`).join('')}
      </datalist>
      ${renderPunchCard()}
      <div class="hours-week-nav">
        <button class="btn btn-line" id="btnHoursPrevWeek">◀ Précédente</button>
        <div class="hours-week-title">
          Semaine du ${start.toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})} au ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
          <div class="ref-badge" style="display:block; margin-top:4px;">${esc(week.reference||'')}</div>
        </div>
        <button class="btn btn-line" id="btnHoursNextWeek">Suivante ▶</button>
      </div>

      ${week.days.map((d,i) => renderDayRow(week, i)).join('')}

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Total de la semaine</span><span class="val">${hoursFormatDuration(totalMinutes/60)}</span></div>
        <div class="tot"><span class="lbl">En décimal</span><span class="val">${(totalMinutes/60).toFixed(2)} h</span></div>
      </div>

      <div class="hours-folder-row">
        ${folderLinkControl('hours', week.weekStart)}
      </div>

      <div style="text-align:center; margin-top:16px;">
        <button class="btn btn-gold" id="btnDownloadHoursMonth">📄 Télécharger ${HOURS_MONTH_NAMES[start.getMonth()]} ${start.getFullYear()} (PDF)</button>
      </div>
    `;
    bindHoursEvents(week);
    const downloadBtn = document.getElementById('btnDownloadHoursMonth');
    if(downloadBtn) downloadBtn.addEventListener('click', () => downloadHoursMonth(start.getFullYear(), start.getMonth()));
  }
  function refreshHoursWeekView(week){
    // Rafraîchit uniquement les totaux (jour + semaine) sans reconstruire les menus déroulants,
    // pour ne pas perdre le focus pendant la saisie.
    week.days.forEach((day,i) => {
      const row = document.querySelector(`.hours-day-row[data-day-index="${i}"] .hours-day-total`);
      if(!row) return;
      const minutes = hoursDayMinutes(day);
      row.textContent = minutes>0 ? hoursFormatDuration(minutes/60) : '—';
      row.classList.toggle('zero', minutes===0);
    });
    const totalMinutes = hoursWeekTotalMinutes(week);
    const totalsBar = document.querySelector('#hoursMainArea .totals-bar');
    if(totalsBar){
      totalsBar.innerHTML = `
        <div class="tot"><span class="lbl">Total de la semaine</span><span class="val">${hoursFormatDuration(totalMinutes/60)}</span></div>
        <div class="tot"><span class="lbl">En décimal</span><span class="val">${(totalMinutes/60).toFixed(2)} h</span></div>
      `;
    }
  }
  function persistWeekIfNeeded(week){
    if(!state.hoursWeeks.includes(week)) state.hoursWeeks.push(week);
    save();
  }
  function bindHoursEvents(week){
    const main = document.getElementById('hoursMainArea');

    main.onchange = e => {
      const dayRow = e.target.closest('[data-day-index]');
      if(!dayRow) return;
      const dayIdx = parseInt(dayRow.dataset.dayIndex, 10);
      const day = week.days[dayIdx];
      if(e.target.hasAttribute('data-chantier-field')){
        const chantierRow = e.target.closest('[data-chantier-id]');
        const chantier = (day.chantiers||[]).find(c => c.id === chantierRow.dataset.chantierId);
        if(chantier){
          const field = e.target.getAttribute('data-chantier-field');
          chantier[field] = e.target.value;
          persistWeekIfNeeded(week);
          refreshHoursWeekView(week);
          renderHoursSidebar();
        }
      }
    };

    main.onclick = e => {
      const statusBtn = e.target.closest('[data-day-status]');
      if(statusBtn){
        const dayIdx = parseInt(statusBtn.dataset.dayStatus, 10);
        week.days[dayIdx].status = statusBtn.dataset.statusValue;
        persistWeekIfNeeded(week);
        renderHoursMain();
        renderHoursSidebar();
        return;
      }
      const addBtn = e.target.closest('[data-add-chantier]');
      if(addBtn){
        const dayIdx = parseInt(addBtn.dataset.addChantier, 10);
        week.days[dayIdx].chantiers = week.days[dayIdx].chantiers || [];
        week.days[dayIdx].chantiers.push(newChantierBlock());
        persistWeekIfNeeded(week);
        renderHoursMain();
        return;
      }
      const delBtn = e.target.closest('[data-delete-chantier]');
      if(delBtn){
        const dayRow = e.target.closest('[data-day-index]');
        const dayIdx = parseInt(dayRow.dataset.dayIndex, 10);
        week.days[dayIdx].chantiers = (week.days[dayIdx].chantiers||[]).filter(c => c.id !== delBtn.dataset.deleteChantier);
        persistWeekIfNeeded(week);
        renderHoursMain();
        return;
      }
    };

    bindPunchCard();
    document.getElementById('btnHoursPrevWeek').addEventListener('click', () => {
      const prev = new Date(selectedWeekStart);
      prev.setDate(prev.getDate() - 7);
      selectedWeekStart = mondayOf(prev).toISOString();
      hoursExpandDate(selectedWeekStart);
      render();
    });
    document.getElementById('btnHoursNextWeek').addEventListener('click', () => {
      const next = new Date(selectedWeekStart);
      next.setDate(next.getDate() + 7);
      selectedWeekStart = mondayOf(next).toISOString();
      hoursExpandDate(selectedWeekStart);
      render();
    });
  }

  // ---------- pointeuse ----------
  function punchElapsedMin(){
    const p = state.punch;
    let min = (p.segments||[]).reduce((s2,sg) => s2 + Math.max(0, (new Date(sg.end) - new Date(sg.start)) / 60000), 0);
    if(p.status === 'in' && p.currentStartISO) min += Math.max(0, (Date.now() - new Date(p.currentStartISO)) / 60000);
    return Math.round(min);
  }
  function renderPunchCard(){
    const p = state.punch;
    if(p.status === 'out'){
      return `<div class="punch-card">
        <div class="punch-head">\u23f1\ufe0f Pointeuse</div>
        <div class="punch-row">
          <input type="text" id="punchChantier" list="hoursChantierNames" placeholder="Chantier (optionnel)" value="${esc(p.chantierName||'')}" autocomplete="off">
          <button class="btn punch-btn punch-start" id="btnPunchIn">\u25b6 J'arrive</button>
        </div>
      </div>`;
    }
    const dur = hoursFormatDuration(punchElapsedMin() / 60);
    return `<div class="punch-card punch-active">
      <div class="punch-head">\u23f1\ufe0f Pointeuse${p.chantierName ? ' \u00b7 ' + esc(p.chantierName) : ''}</div>
      <div class="punch-status">${p.status === 'pause' ? '\u23f8 En pause' : '\ud83d\udfe2 En cours'} \u2014 <strong id="punchLiveDuration">${dur}</strong></div>
      <div class="punch-actions">
        ${p.status === 'in'
          ? `<button class="btn btn-line punch-btn" id="btnPunchPause">\u23f8 Pause</button>`
          : `<button class="btn punch-btn punch-start" id="btnPunchResume">\u25b6 Je reprends</button>`}
        <button class="btn punch-btn punch-stop" id="btnPunchOut">\u23f9 Je pars</button>
      </div>
    </div>`;
  }
  function bindPunchCard(){
    const inp = document.getElementById('punchChantier');
    if(inp) inp.addEventListener('input', () => { state.punch.chantierName = inp.value; save(); });
    const bIn = document.getElementById('btnPunchIn');
    if(bIn) bIn.addEventListener('click', () => {
      state.punch.status = 'in';
      state.punch.currentStartISO = new Date().toISOString();
      state.punch.segments = [];
      save(); renderHoursMain();
      toast('Pointage d\u00e9marr\u00e9 \u25b6');
    });
    const bPause = document.getElementById('btnPunchPause');
    if(bPause) bPause.addEventListener('click', () => {
      state.punch.segments.push({ start: state.punch.currentStartISO, end: new Date().toISOString() });
      state.punch.status = 'pause';
      state.punch.currentStartISO = null;
      save(); renderHoursMain();
    });
    const bRes = document.getElementById('btnPunchResume');
    if(bRes) bRes.addEventListener('click', () => {
      state.punch.status = 'in';
      state.punch.currentStartISO = new Date().toISOString();
      save(); renderHoursMain();
    });
    const bOut = document.getElementById('btnPunchOut');
    if(bOut) bOut.addEventListener('click', () => {
      if(state.punch.status === 'in' && state.punch.currentStartISO){
        state.punch.segments.push({ start: state.punch.currentStartISO, end: new Date().toISOString() });
      }
      const segs = (state.punch.segments||[]).filter(sg => new Date(sg.end) - new Date(sg.start) >= 60000);
      if(segs.length){
        const totalMin = segs.reduce((s2,sg) => s2 + Math.round((new Date(sg.end) - new Date(sg.start)) / 60000), 0);
        const monday = mondayOf(new Date()).toISOString();
        const week = getOrCreateWeek(monday);
        if(!state.hoursWeeks.includes(week)) state.hoursWeeks.push(week);
        const dayIdx = (new Date().getDay() + 6) % 7;
        const day = week.days[dayIdx];
        if(day.status && day.status !== 'normal') day.status = 'normal';
        // Arrondit une heure au quart d'heure le plus proche (0, 15, 30, 45)
        const roundQuarter = (dt) => {
          const total = dt.getHours() * 60 + dt.getMinutes();
          const rounded = Math.round(total / 15) * 15;
          return { h: Math.floor(rounded / 60) % 24, m: rounded % 60 };
        };
        segs.forEach(sg => {
          const rs = roundQuarter(new Date(sg.start));
          const re = roundQuarter(new Date(sg.end));
          day.chantiers.push({ id: uid(), name: state.punch.chantierName || 'Pointeuse', startHour: rs.h, startMinute: rs.m, endHour: re.h, endMinute: re.m });
        });
        selectedWeekStart = monday;
        hoursExpandDate(monday);
        toast(hoursFormatDuration(totalMin / 60) + ' ajout\u00e9es \u00e0 aujourd\u2019hui \u2713');
      } else {
        toast('Pointage annul\u00e9 (moins d\u2019une minute).');
      }
      state.punch = { status:'out', chantierName: state.punch.chantierName, currentStartISO:null, segments:[] };
      save(); render();
    });
  }

  // ---------- salle d'arcade ----------
  let arcadeCurrent = null;
  function arcadeRecordsHtml(){
    const a = state.arcade;
    return `
      <div class="dash-section-title" style="margin-top:16px;">🏆 Records</div>
      <div class="arcade-rec-grid">
        <div class="arcade-rec"><span>⚔️ RPG 🟢</span><strong>${a.rpgBest.easy ? 'Étage ' + a.rpgBest.easy : '—'}</strong></div>
        <div class="arcade-rec"><span>⚔️ RPG 🟡</span><strong>${a.rpgBest.normal ? 'Étage ' + a.rpgBest.normal : '—'}</strong></div>
        <div class="arcade-rec"><span>⚔️ RPG 🔴</span><strong>${a.rpgBest.hard ? 'Étage ' + a.rpgBest.hard : '—'}</strong></div>
        <div class="arcade-rec"><span>⭕ Victoires</span><strong>${a.tttWins}</strong></div>
        <div class="arcade-rec"><span>💣 Gagnés</span><strong>${a.minesWins}</strong></div>
        <div class="arcade-rec"><span>🔢 Meilleur score</span><strong>${a.best2048 || '—'}</strong></div>
        <div class="arcade-rec"><span>🧠 Record paires</span><strong>${a.memoryBest ? a.memoryBest + ' coups' : '—'}</strong></div>
      </div>`;
  }
  function openArcadeModal(){
    document.getElementById('arcadeModal').style.display = 'flex';
    arcadeShowMenu();
  }
  function arcadeShowMenu(){
    arcadeCurrent = null;
    document.getElementById('arcadeMenu').style.display = 'block';
    document.getElementById('arcadeGameWrap').style.display = 'none';
    document.getElementById('arcadeRecords').innerHTML = arcadeRecordsHtml();
  }
  function arcadeStart(game){
    arcadeCurrent = game;
    document.getElementById('arcadeMenu').style.display = 'none';
    document.getElementById('arcadeGameWrap').style.display = 'block';
    if(game === 'ttt') tttStart();
    else if(game === 'mines') minesStart();
    else if(game === 'g2048') g2048Start();
    else if(game === 'memory') memStart();
  }

  // Morpion
  let tttBoard, tttOver;
  function tttStart(){ tttBoard = Array(9).fill(''); tttOver = false; tttRender('À toi de jouer (X) !'); }
  function tttWinner(b){
    const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [x,y,z] of L) if(b[x] && b[x]===b[y] && b[x]===b[z]) return b[x];
    return b.every(v => v) ? 'nul' : null;
  }
  function tttRender(msg){
    document.getElementById('arcadeGameArea').innerHTML = `
      <div class="arcade-msg">${msg}</div>
      <div class="ttt-grid">${tttBoard.map((v,i) => `<button class="ttt-cell" data-ttt="${i}" ${v||tttOver?'disabled':''}>${v}</button>`).join('')}</div>
      <button class="btn btn-line" id="tttRestart" style="margin-top:10px;">↻ Rejouer</button>`;
    document.querySelectorAll('[data-ttt]').forEach(b => b.addEventListener('click', () => tttPlay(parseInt(b.dataset.ttt,10))));
    document.getElementById('tttRestart').addEventListener('click', tttStart);
  }
  function tttPlay(i){
    if(tttOver || tttBoard[i]) return;
    tttBoard[i] = 'X';
    let w = tttWinner(tttBoard);
    if(w) return tttEnd(w);
    const free = tttBoard.map((v,j) => v ? null : j).filter(j => j !== null);
    let move = null;
    for(const sym of ['O','X']){
      for(const j of free){
        const copy = tttBoard.slice(); copy[j] = sym;
        if(tttWinner(copy) === sym){ move = j; break; }
      }
      if(move !== null) break;
    }
    if(move === null) move = free.includes(4) ? 4 : free[Math.floor(Math.random()*free.length)];
    tttBoard[move] = 'O';
    w = tttWinner(tttBoard);
    if(w) return tttEnd(w);
    tttRender('À toi de jouer (X) !');
  }
  function tttEnd(w){
    tttOver = true;
    if(w === 'X'){ state.arcade.tttWins += 1; save(); }
    tttRender(w === 'nul' ? 'Match nul 🤝' : (w === 'X' ? 'Gagné ! 🎉' : 'Le téléphone gagne 🤖'));
  }

  // Demineur
  let mnGrid, mnOver, mnFlag, mnMsg;
  function mnNeighbors(i){
    const N = 8, r = Math.floor(i/N), c2 = i%N, out = [];
    for(let dr=-1; dr<=1; dr++) for(let dc=-1; dc<=1; dc++){
      if(!dr && !dc) continue;
      const nr = r+dr, nc = c2+dc;
      if(nr>=0 && nr<N && nc>=0 && nc<N) out.push(nr*N+nc);
    }
    return out;
  }
  function minesStart(){
    mnGrid = Array.from({length:64}, () => ({ mine:false, open:false, flag:false, n:0 }));
    let placed = 0;
    while(placed < 10){ const i = Math.floor(Math.random()*64); if(!mnGrid[i].mine){ mnGrid[i].mine = true; placed++; } }
    mnGrid.forEach((cell,i) => { cell.n = mnNeighbors(i).filter(j => mnGrid[j].mine).length; });
    mnOver = false; mnFlag = false;
    minesRender('10 mines. Bonne chance !');
  }
  function minesRender(msg){
    if(msg !== undefined) mnMsg = msg;
    document.getElementById('arcadeGameArea').innerHTML = `
      <div class="arcade-msg">${mnMsg}</div>
      <div class="mn-grid">${mnGrid.map((cell,i) => {
        let t = '';
        if(cell.flag) t = '🚩';
        else if(cell.open) t = cell.mine ? '💣' : (cell.n || '');
        return `<button class="mn-cell ${cell.open?'open':''} ${cell.open&&cell.mine?'boom':''}" data-mn="${i}">${t}</button>`;
      }).join('')}</div>
      <div style="display:flex; gap:8px; margin-top:10px; justify-content:center;">
        <button class="btn btn-line ${mnFlag?'mn-flag-on':''}" id="mnFlagBtn">🚩 Drapeau ${mnFlag?'ON':'OFF'}</button>
        <button class="btn btn-line" id="mnRestart">↻ Rejouer</button>
      </div>`;
    document.querySelectorAll('[data-mn]').forEach(b => b.addEventListener('click', () => mnTap(parseInt(b.dataset.mn,10))));
    document.getElementById('mnFlagBtn').addEventListener('click', () => { mnFlag = !mnFlag; minesRender(); });
    document.getElementById('mnRestart').addEventListener('click', minesStart);
  }
  function mnTap(i){
    if(mnOver) return;
    const cell = mnGrid[i];
    if(mnFlag){ if(!cell.open){ cell.flag = !cell.flag; minesRender(); } return; }
    if(cell.flag || cell.open) return;
    if(cell.mine){
      mnOver = true;
      mnGrid.forEach(c2 => { if(c2.mine) c2.open = true; });
      minesRender('BOUM 💥 Perdu !');
      return;
    }
    const stack = [i];
    while(stack.length){
      const j = stack.pop();
      const c2 = mnGrid[j];
      if(c2.open || c2.flag) continue;
      c2.open = true;
      if(c2.n === 0) mnNeighbors(j).forEach(k => { if(!mnGrid[k].open) stack.push(k); });
    }
    if(mnGrid.every(c2 => c2.open || c2.mine)){
      mnOver = true;
      state.arcade.minesWins += 1; save();
      minesRender('Gagné ! 🎉');
    } else minesRender();
  }

  // 2048
  let g2Grid, g2Score, g2Over;
  function g2048Start(){
    g2Grid = Array(16).fill(0);
    g2Score = 0; g2Over = false;
    g2Add(); g2Add();
    g2Render('Glisse (ou flèches) pour fusionner !');
  }
  function g2Add(){
    const free = g2Grid.map((v,i) => v ? null : i).filter(i => i !== null);
    if(free.length) g2Grid[free[Math.floor(Math.random()*free.length)]] = Math.random() < 0.9 ? 2 : 4;
  }
  function g2Render(msg){
    document.getElementById('arcadeGameArea').innerHTML = `
      <div class="arcade-msg">${msg || 'Score : ' + g2Score + (state.arcade.best2048 ? ' · Record : ' + state.arcade.best2048 : '')}</div>
      <div class="g2-grid" id="g2Grid">${g2Grid.map(v => `<div class="g2-cell g2-${v}">${v||''}</div>`).join('')}</div>
      <button class="btn btn-line" id="g2Restart" style="margin-top:10px;">↻ Rejouer</button>`;
    document.getElementById('g2Restart').addEventListener('click', g2048Start);
    const grid = document.getElementById('g2Grid');
    let sx = 0, sy = 0;
    grid.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
    grid.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if(Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      g2Move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive:true });
  }
  function g2Move(dir){
    if(g2Over) return;
    const before = g2Grid.join(',');
    const idx = (r,c2) => r*4+c2;
    const pos = (line,k) => dir==='left' ? [line,k] : dir==='right' ? [line,3-k] : dir==='up' ? [k,line] : [3-k,line];
    for(let line=0; line<4; line++){
      const arr = [];
      for(let k=0; k<4; k++){
        const [r,c2] = pos(line,k);
        if(g2Grid[idx(r,c2)]) arr.push(g2Grid[idx(r,c2)]);
      }
      const merged = [];
      for(let k=0; k<arr.length; k++){
        if(arr[k] === arr[k+1]){ merged.push(arr[k]*2); g2Score += arr[k]*2; k++; }
        else merged.push(arr[k]);
      }
      while(merged.length < 4) merged.push(0);
      for(let k=0; k<4; k++){
        const [r,c2] = pos(line,k);
        g2Grid[idx(r,c2)] = merged[k];
      }
    }
    if(g2Grid.join(',') !== before){
      g2Add();
      if(g2Score > state.arcade.best2048){ state.arcade.best2048 = g2Score; save(); }
      const canMove = g2Grid.includes(0) || g2Grid.some((v,i) => {
        const r = Math.floor(i/4), c2 = i%4;
        return (c2 < 3 && g2Grid[i+1] === v) || (r < 3 && g2Grid[i+4] === v);
      });
      if(!canMove){ g2Over = true; g2Render('Fin de partie ! Score : ' + g2Score); return; }
    }
    g2Render();
  }

  // Memoire
  let memCards, memFlipped, memMoves, memLock;
  function memStart(){
    const icons = ['🔨','🪚','🔧','📏','🪵','🔩'];
    memCards = icons.concat(icons).map(ic => ({ ic, open:false, done:false }));
    for(let i = memCards.length-1; i > 0; i--){ const j = Math.floor(Math.random()*(i+1)); [memCards[i], memCards[j]] = [memCards[j], memCards[i]]; }
    memFlipped = []; memMoves = 0; memLock = false;
    memRender('Retrouve les paires !');
  }
  function memRender(msg){
    document.getElementById('arcadeGameArea').innerHTML = `
      <div class="arcade-msg">${msg || 'Coups : ' + memMoves}</div>
      <div class="mem-grid">${memCards.map((card,i) => `<button class="mem-cell ${card.open||card.done?'open':''} ${card.done?'done':''}" data-mem="${i}">${card.open||card.done ? card.ic : '?'}</button>`).join('')}</div>
      <button class="btn btn-line" id="memRestart" style="margin-top:10px;">↻ Rejouer</button>`;
    document.querySelectorAll('[data-mem]').forEach(b => b.addEventListener('click', () => memTap(parseInt(b.dataset.mem,10))));
    document.getElementById('memRestart').addEventListener('click', memStart);
  }
  function memTap(i){
    if(memLock) return;
    const card = memCards[i];
    if(card.open || card.done) return;
    card.open = true;
    memFlipped.push(i);
    if(memFlipped.length === 2){
      memMoves += 1;
      const [a2, b2] = memFlipped;
      if(memCards[a2].ic === memCards[b2].ic){
        memCards[a2].done = memCards[b2].done = true;
        memFlipped = [];
        if(memCards.every(c2 => c2.done)){
          if(!state.arcade.memoryBest || memMoves < state.arcade.memoryBest){ state.arcade.memoryBest = memMoves; save(); }
          memRender('Bravo ! ' + memMoves + ' coups 🎉');
          return;
        }
      } else {
        memLock = true;
        memRender();
        setTimeout(() => {
          memCards[a2].open = memCards[b2].open = false;
          memFlipped = []; memLock = false;
          memRender();
        }, 750);
        return;
      }
    }
    memRender();
  }

  // ---------- repas de la semaine ----------
  const MEAL_SLOTS = [ { key:'midi', label:'Midi' }, { key:'soir', label:'Soir' } ];
  let mealsWeekStart = mondayOf(new Date()).toISOString();

  function mealsWeek(iso){
    if(!state.meals[iso]) state.meals[iso] = {};
    return state.meals[iso];
  }
  // Une case contient soit une recette (recipeId), soit du texte libre
  function mealCell(iso, dayIdx, slot){
    const w = mealsWeek(iso);
    const k = dayIdx + '-' + slot;
    if(!w[k]) w[k] = { recipeId: null, text: '' };
    return w[k];
  }

  function renderMealsMain(){
    const main = document.getElementById('mealsMainArea');
    if(!main) return;
    const start = new Date(mealsWeekStart);
    const days = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(d.getDate()+i); return d; });
    const end = days[6];
    const recipes = state.recipes.slice().sort((a,b) => (a.title||'').localeCompare(b.title||'', 'fr'));
    const w = mealsWeek(mealsWeekStart);
    const planned = Object.values(w).filter(c => c.recipeId || (c.text||'').trim()).length;
    const usedRecipes = new Set(Object.values(w).map(c => c.recipeId).filter(Boolean));
    const todayIdx = (() => {
      const t = mondayOf(new Date()).toISOString();
      return t === mealsWeekStart ? (new Date().getDay() + 6) % 7 : -1;
    })();

    main.innerHTML = `
      <div class="hours-week-nav">
        <button class="btn btn-line" id="btnMealsPrev">◀ Précédente</button>
        <div class="hours-week-title">
          Semaine du ${days[0].toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})} au ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
        </div>
        <button class="btn btn-line" id="btnMealsNext">Suivante ▶</button>
      </div>

      <div class="totals-bar">
        <div class="tot"><span class="lbl">Repas pr\u00e9vus</span><span class="val">${planned} / 14</span></div>
        <div class="tot"><span class="lbl">Recettes utilis\u00e9es</span><span class="val">${usedRecipes.size}</span></div>
      </div>

      <div class="meal-grid">
        ${days.map((d,i) => `
          <div class="meal-day ${i===todayIdx?'today':''}">
            <div class="meal-day-head">
              <span>${HOURS_DAY_NAMES[i]}</span>
              <span class="meal-day-date">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span>
            </div>
            ${MEAL_SLOTS.map(sl => {
              const cell = mealCell(mealsWeekStart, i, sl.key);
              const rec = cell.recipeId ? state.recipes.find(r => r.id === cell.recipeId) : null;
              return `
              <div class="meal-slot">
                <div class="meal-slot-label">${sl.label}</div>
                <select class="meal-select" data-meal-recipe="${i}-${sl.key}">
                  <option value="">\u2014</option>
                  ${recipes.map(r => `<option value="${r.id}" ${cell.recipeId===r.id?'selected':''}>${esc(r.title||'(sans titre)')}</option>`).join('')}
                </select>
                <input type="text" class="meal-text" data-meal-text="${i}-${sl.key}" value="${esc(cell.text||'')}" placeholder="ou \u00e0 la main\u2026">
                ${rec ? `<button class="meal-open" data-meal-open="${rec.id}" title="Voir la recette">\u2197</button>` : ''}
              </div>`;
            }).join('')}
          </div>`).join('')}
      </div>

      <div class="dash-section-title">Liste de courses de la semaine</div>
      ${usedRecipes.size ? `
        <div class="meal-shop-info">Les ingr\u00e9dients des ${usedRecipes.size} recette${usedRecipes.size>1?'s':''} pr\u00e9vue${usedRecipes.size>1?'s':''} peuvent \u00eatre ajout\u00e9s d'un coup \u00e0 tes Courses. Les articles d\u00e9j\u00e0 pr\u00e9sents ne sont pas dupliqu\u00e9s.</div>
        <div class="meal-ing-preview">
          ${Array.from(usedRecipes).map(id => {
            const r = state.recipes.find(x => x.id === id);
            if(!r) return '';
            const ings = (r.ingredients||[]).map(ing => (ing.text||'').trim()).filter(Boolean);
            return `<div class="meal-ing-block">
              <div class="meal-ing-title">${esc(r.title||'(sans titre)')}</div>
              ${ings.length ? `<div class="meal-ing-list">${ings.map(t => `<span class="meal-ing">${esc(t)}</span>`).join('')}</div>`
                            : `<div class="meal-ing-empty">Aucun ingr\u00e9dient renseign\u00e9</div>`}
            </div>`;
          }).join('')}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
          <button class="btn btn-gold" id="btnMealsToShopping">\ud83d\uded2 Ajouter les ingr\u00e9dients aux Courses</button>
          <button class="btn btn-line" id="btnMealsClearWeek">Vider la semaine</button>
        </div>
      ` : `<div class="empty-side">Choisis des recettes ci-dessus pour g\u00e9n\u00e9rer la liste de courses.${state.recipes.length ? '' : ' Cr\u00e9e d\u2019abord des recettes dans l\u2019onglet Recettes.'}</div>`}
    `;
    bindMealsEvents();
  }

  function bindMealsEvents(){
    document.getElementById('btnMealsPrev').addEventListener('click', () => {
      const d = new Date(mealsWeekStart); d.setDate(d.getDate()-7);
      mealsWeekStart = d.toISOString(); renderMealsMain(); applyEditLock();
    });
    document.getElementById('btnMealsNext').addEventListener('click', () => {
      const d = new Date(mealsWeekStart); d.setDate(d.getDate()+7);
      mealsWeekStart = d.toISOString(); renderMealsMain(); applyEditLock();
    });

    document.querySelectorAll('[data-meal-recipe]').forEach(sel => sel.addEventListener('change', () => {
      const [i, slot] = sel.dataset.mealRecipe.split('-');
      const cell = mealCell(mealsWeekStart, parseInt(i,10), slot);
      cell.recipeId = sel.value || null;
      save(); renderMealsMain(); applyEditLock();
    }));
    document.querySelectorAll('[data-meal-text]').forEach(inp => inp.addEventListener('input', () => {
      const [i, slot] = inp.dataset.mealText.split('-');
      const cell = mealCell(mealsWeekStart, parseInt(i,10), slot);
      cell.text = inp.value;
      save();
    }));
    document.querySelectorAll('[data-meal-open]').forEach(btn => btn.addEventListener('click', () => {
      goToItem('recipes', btn.dataset.mealOpen);
    }));

    const shopBtn = document.getElementById('btnMealsToShopping');
    if(shopBtn) shopBtn.addEventListener('click', () => {
      const w = mealsWeek(mealsWeekStart);
      const ids = Array.from(new Set(Object.values(w).map(c => c.recipeId).filter(Boolean)));
      const existing = new Set(state.shoppingItems.map(it => (it.name||'').trim().toLowerCase()));
      let added = 0;
      ids.forEach(id => {
        const r = state.recipes.find(x => x.id === id);
        if(!r) return;
        (r.ingredients||[]).forEach(ing => {
          const t = (ing.text||'').trim();
          if(!t) return;
          if(existing.has(t.toLowerCase())) return;
          existing.add(t.toLowerCase());
          state.shoppingItems.push({ id: uid(), name: t, checked: false });
          added++;
        });
      });
      save(); render();
      toast(added ? added + ' article' + (added>1?'s':'') + ' ajout\u00e9' + (added>1?'s':'') + ' aux Courses \u2713'
                  : 'Tous les ingr\u00e9dients sont d\u00e9j\u00e0 dans la liste.');
    });

    const clearBtn = document.getElementById('btnMealsClearWeek');
    if(clearBtn) bindConfirmDeleteButton(clearBtn, () => {
      state.meals[mealsWeekStart] = {};
      save(); renderMealsMain(); applyEditLock();
      toast('Semaine vid\u00e9e');
    }, 'Vider ?');
  }

  // ---------- idees cadeaux ----------
