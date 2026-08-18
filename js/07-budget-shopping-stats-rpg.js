  const BUDGET_DEFAULT_EXPENSE_CATEGORIES = ['Alimentation','Transport','Logement','Loisirs','Santé','Matériel','Vêtements','Autre'];
  const BUDGET_DEFAULT_INCOME_CATEGORIES = ['Salaire','Prime','Aide / Allocation','Remboursement','Vente','Cadeau reçu','Retrait Livret','Autre'];
  const BUDGET_DEFAULT_INVESTMENT_CATEGORIES = ['Épargne','Bourse / Actions','Livret','Immobilier','Cryptomonnaie','Autre'];
  // Compat : anciennes references
  const BUDGET_DEFAULT_CATEGORIES = BUDGET_DEFAULT_EXPENSE_CATEGORIES;
  let selectedBudgetMonth = { year: new Date().getFullYear(), month: new Date().getMonth() };
  let budgetExpandedYears = new Set([new Date().getFullYear()]);
  let budgetCategoryFilter = '';

  function budgetEntriesForMonth(year, month){
    return state.budgetEntries.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }
  // Une entree concerne le Livret si sa categorie contient "livret"
  function isLivretEntry(e){ return /livret/i.test(e.category || ''); }

  function budgetMonthTotals(year, month){
    let income = 0, expense = 0, investment = 0, livretIn = 0, livretOut = 0;
    budgetEntriesForMonth(year, month).forEach(e => {
      if(e.type === 'income'){
        income += e.amount;
        if(isLivretEntry(e)) livretOut += e.amount;      // retrait du livret -> revient au compte
      } else if(e.type === 'investment'){
        if(isLivretEntry(e)) livretIn += e.amount;       // versement sur le livret
        else investment += e.amount;                      // autres placements
      } else expense += e.amount;
    });
    return {
      income, expense, investment,
      livretIn, livretOut, livret: livretIn - livretOut,
      balance: income - expense - investment - livretIn
    };
  }

  // Situation cumulee depuis le debut (tous mois confondus)
  function budgetOverallBalances(){
    let income = 0, expense = 0, investment = 0, livretIn = 0, livretOut = 0;
    state.budgetEntries.forEach(e => {
      if(e.type === 'income'){
        income += e.amount;
        if(isLivretEntry(e)) livretOut += e.amount;
      } else if(e.type === 'investment'){
        if(isLivretEntry(e)) livretIn += e.amount;
        else investment += e.amount;
      } else expense += e.amount;
    });
    const livret = livretIn - livretOut;
    const compte = income - expense - investment - livretIn;
    return { compte, livret, investment, total: compte + livret + investment };
  }
  function budgetFmt(n){
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac';
  }
  function budgetCatIcon(cat){
    const cc = (cat||'').toLowerCase();
    if(cc.includes('aliment')||cc.includes('course')) return '\ud83c\udf5e';
    if(cc.includes('transport')||cc.includes('essence')||cc.includes('voiture')||cc.includes('carburant')) return '\u26fd';
    if(cc.includes('logement')||cc.includes('loyer')||cc.includes('maison')) return '\ud83c\udfe0';
    if(cc.includes('loisir')) return '\ud83c\udfae';
    if(cc.includes('sant')) return '\ud83d\udc8a';
    if(cc.includes('mat')||cc.includes('outil')) return '\ud83d\udd27';
    if(cc.includes('resto')||cc.includes('restaurant')) return '\ud83c\udf7d\ufe0f';
    if(cc.includes('livret')) return '\ud83d\udcb5';
    if(cc.includes('abonnement')||cc.includes('internet')||cc.includes('tel')) return '\ud83d\udcf6';
    return '\ud83d\udce6';
  }
  function budgetDefaultsFor(type){
    if(type === 'income') return BUDGET_DEFAULT_INCOME_CATEGORIES;
    if(type === 'investment') return BUDGET_DEFAULT_INVESTMENT_CATEGORIES;
    return BUDGET_DEFAULT_EXPENSE_CATEGORIES;
  }
  // Categories personnalisees stockees dans les parametres, par type
  function budgetCustomCats(type){
    const bc = (state.settings && state.settings.budgetCategories) || {};
    const arr = bc[type];
    return Array.isArray(arr) ? arr : budgetDefaultsFor(type).slice();
  }
  function setBudgetCustomCats(type, arr){
    if(!state.settings.budgetCategories) state.settings.budgetCategories = {};
    state.settings.budgetCategories[type] = arr;
  }
  // Liste pour un type donne : personnalisees + celles reellement utilisees dans les entrees de ce type
  function budgetCategoriesForType(type){
    const cats = new Set(budgetCustomCats(type));
    state.budgetEntries.forEach(e => { if((e.type || 'expense') === type && e.category) cats.add(e.category); });
    return Array.from(cats);
  }
  // Compat : toutes categories confondues (utilise par le ticket)
  function budgetKnownCategories(){
    const cats = new Set([...budgetCustomCats('expense'), ...budgetCustomCats('income'), ...budgetCustomCats('investment')]);
    state.budgetEntries.forEach(e => { if(e.category) cats.add(e.category); });
    return Array.from(cats).sort();
  }

  function buildBudgetPdfBody(year, month){
    const company = state.company || {};
    const entries = budgetEntriesForMonth(year, month).slice().sort((a,b) => new Date(a.date) - new Date(b.date));
    const tot = budgetMonthTotals(year, month);
    const monthLabel = `${HOURS_MONTH_NAMES[month]} ${year}`;
    const typeLabel = t => t === 'income' ? 'Revenu' : (t === 'investment' ? 'Investissement' : 'D\u00e9pense');
    const sign = t => t === 'income' ? '+' : '\u2212';

    // Recap par categorie (depenses uniquement)
    const byCat = {};
    entries.filter(e => e.type !== 'income' && e.type !== 'investment').forEach(e => {
      const k = e.category || 'Autre';
      byCat[k] = (byCat[k]||0) + e.amount;
    });
    const catRecap = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
    const maxCat = Math.max(1, ...catRecap.map(([,v]) => v));

    const rowsHtml = entries.map(e => `
      <tr>
        <td>${new Date(e.date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })}</td>
        <td>${esc(e.label || '')}</td>
        <td>${esc(e.category || 'Autre')}</td>
        <td>${typeLabel(e.type)}</td>
        <td class="num ${e.type}">${sign(e.type)} ${budgetFmt(e.amount)}</td>
      </tr>`).join('');

    const catRecapHtml = catRecap.length ? `
      <div class="recap">
        <h4>D\u00e9penses par cat\u00e9gorie</h4>
        <table class="recap-table">
          <thead><tr><th>Cat\u00e9gorie</th><th>Montant</th></tr></thead>
          <tbody>
            ${catRecap.map(([cat, val]) => `<tr><td>${esc(cat)}</td><td>${budgetFmt(val)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : '';

    const contactParts = [];
    if(company.phone) contactParts.push('T\u00e9l. ' + esc(company.phone));
    if(company.email) contactParts.push(esc(company.email));
    const contactLine = contactParts.join(' \u00b7 ');

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
        </div>
      </div>
    </div>
    <div class="doc-title-block">
      <p class="doc-title">BUDGET</p>
      <div class="doc-ref">${esc(monthLabel)}</div>
      <div class="doc-date">\u00c9dit\u00e9 le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="totals-strip">
    <div><span>Revenus</span><b>${budgetFmt(tot.income)}</b></div>
    <div><span>D\u00e9penses</span><b>${budgetFmt(tot.expense)}</b></div>
    ${tot.investment > 0 ? `<div><span>Investissements</span><b>${budgetFmt(tot.investment)}</b></div>` : ''}
    ${(tot.livretIn > 0 || tot.livretOut > 0) ? `<div><span>Livret</span><b>${tot.livret >= 0 ? '+' : ''}${budgetFmt(tot.livret)}</b></div>` : ''}
    <div><span>Solde</span><b>${tot.balance >= 0 ? '+' : ''}${budgetFmt(tot.balance)}</b></div>
  </div>

  ${(() => {
    const ov = budgetOverallBalances();
    return `
  <table class="pdf-table" style="max-width:340px;">
    <thead><tr><th colspan="2">Situation actuelle</th></tr></thead>
    <tbody>
      <tr><td>Compte courant</td><td class="num">${budgetFmt(ov.compte)}</td></tr>
      <tr><td>Livret</td><td class="num">${budgetFmt(ov.livret)}</td></tr>
      ${ov.investment > 0 ? `<tr><td>Autres investissements</td><td class="num">${budgetFmt(ov.investment)}</td></tr>` : ''}
      <tr><td><b>Total</b></td><td class="num"><b>${budgetFmt(ov.total)}</b></td></tr>
    </tbody>
  </table>`;
  })()}

  <table class="pdf-table">
    <thead><tr><th>Date</th><th>Libell\u00e9</th><th>Cat\u00e9gorie</th><th>Type</th><th class="num">Montant</th></tr></thead>
    <tbody>${rowsHtml || '<tr><td colspan="5">Aucune entr\u00e9e ce mois-ci.</td></tr>'}</tbody>
  </table>

  <div class="recap-columns">
    ${catRecapHtml}
  </div>

  <footer>
    <span>${esc(monthLabel)} \u2014 ${esc(company.name || 'Mon Entreprise')}</span>
    <span>G\u00e9n\u00e9r\u00e9 le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;
  }

  function renderBudgetSidebar(){
    const list = document.getElementById('budgetMonthList');
    const summaryWrap = document.getElementById('budgetSummary');
    if(!list) return;
    const tot = budgetMonthTotals(selectedBudgetMonth.year, selectedBudgetMonth.month);
    if(summaryWrap){
      summaryWrap.innerHTML = `
        <div class="hours-summary-card"><span class="lbl">D\u00e9penses du mois</span><span class="val" style="color:var(--brick);">${budgetFmt(tot.expense)}</span></div>
        <div class="hours-summary-card"><span class="lbl">Solde du mois</span><span class="val" style="color:${tot.balance>=0?'var(--sage)':'var(--brick)'};">${budgetFmt(tot.balance)}</span></div>
      `;
    }
    if(!state.budgetEntries.length){
      list.innerHTML = `<div class="empty-side">Aucune entr\u00e9e pour l'instant.<br>Ajoute ta premi\u00e8re d\u00e9pense \u00e0 droite.</div>`;
      return;
    }
    const years = {};
    state.budgetEntries.forEach(e => {
      const d = new Date(e.date);
      const y = d.getFullYear(), m = d.getMonth();
      if(!years[y]) years[y] = new Set();
      years[y].add(m);
    });
    list.innerHTML = Object.keys(years).sort((a,b) => b-a).map(year => {
      const yr = parseInt(year, 10);
      const expanded = budgetExpandedYears.has(yr);
      let yIncome = 0, yExpense = 0;
      state.budgetEntries.forEach(e => {
        const d = new Date(e.date);
        if(d.getFullYear() === yr){ if(e.type === 'income') yIncome += e.amount; else yExpense += e.amount; }
      });
      const yBal = yIncome - yExpense;
      const months = Array.from(years[year]).sort((a,b) => b-a);
      return `
        <div class="hours-year-header" data-budget-year-toggle="${year}">
          <span class="hours-year-caret">${expanded ? '\u25be' : '\u25b8'}</span>
          <span class="hours-year-label">${year}</span>
          <span class="hours-year-total" style="color:${yBal>=0?'var(--sage)':'var(--brick)'};">${yBal>=0?'+':''}${budgetFmt(yBal)}</span>
        </div>
        ${expanded ? months.map(m => {
          const t = budgetMonthTotals(parseInt(year,10), m);
          const isActive = parseInt(year,10) === selectedBudgetMonth.year && m === selectedBudgetMonth.month;
          return `
          <div class="sheet-item ${isActive?'active':''}" data-budget-month="${year}-${m}" tabindex="0">
            <div class="name">${HOURS_MONTH_NAMES[m]}</div>
            <div class="meta">D\u00e9penses : ${budgetFmt(t.expense)}</div>
            <div class="meta"><strong style="color:${t.balance>=0?'var(--sage)':'var(--brick)'};">${t.balance>=0?'+':''}${budgetFmt(t.balance)}</strong></div>
          </div>`;
        }).join('') : ''}`;
    }).join('');
  }

  function renderBudgetMain(){
    const main = document.getElementById('budgetMainArea');
    if(!main) return;
    const { year, month } = selectedBudgetMonth;
    const entries = budgetEntriesForMonth(year, month).sort((a,b) => new Date(b.date) - new Date(a.date));
    const tot = budgetMonthTotals(year, month);
    const cats = budgetKnownCategories();
    const monthCats = Array.from(new Set(budgetEntriesForMonth(year, month).map(e => e.category || 'Autre'))).sort((a,b) => a.localeCompare(b, 'fr'));
    if(budgetCategoryFilter && !monthCats.includes(budgetCategoryFilter)) budgetCategoryFilter = '';
    const shownEntries = budgetCategoryFilter ? entries.filter(e => (e.category || 'Autre') === budgetCategoryFilter) : entries;

    const byCat = {};
    entries.filter(e => e.type !== 'income' && e.type !== 'investment').forEach(e => {
      const c = e.category || 'Autre';
      byCat[c] = (byCat[c]||0) + e.amount;
    });
    const catRecap = Object.entries(byCat).sort((a,b) => b[1]-a[1]);
    const maxCat = Math.max(1, ...catRecap.map(([,v]) => v));

    const prevD = new Date(year, month - 1, 1);
    const prevTot = budgetMonthTotals(prevD.getFullYear(), prevD.getMonth());
    let compareHtml = '';
    if(prevTot.expense > 0){
      const diff = tot.expense - prevTot.expense;
      const pct = Math.round((diff / prevTot.expense) * 100);
      const arrow = diff > 0 ? '<span class="up">\u2197 +' + pct + '%</span>' : (diff < 0 ? '<span class="down">\u2198 ' + pct + '%</span>' : '<span>\u2192 stable</span>');
      compareHtml = `<div class="budget-compare">D\u00e9penses ${arrow} par rapport \u00e0 ${HOURS_MONTH_NAMES[prevD.getMonth()].toLowerCase()} (${budgetFmt(prevTot.expense)})</div>`;
    }
    const todayIso = new Date().toISOString().slice(0,10);
    const defaultDate = (year === new Date().getFullYear() && month === new Date().getMonth())
      ? todayIso
      : new Date(year, month, 15).toISOString().slice(0,10);

    main.innerHTML = `
      <div class="hours-week-nav">
        <button class="btn btn-line" id="btnBudgetPrevMonth">\u25c0</button>
        <div class="hours-week-title">
          <div>${HOURS_MONTH_NAMES[month]} ${year}</div>
        </div>
        <button class="btn btn-line" id="btnBudgetNextMonth">\u25b6</button>
      </div>

      <div class="budget-add-form">
        <input type="text" id="budgetLabel" placeholder="Libell\u00e9 (ex. Courses du samedi)">
        <input type="text" id="budgetAmount" placeholder="Montant \u20ac" inputmode="none" autocomplete="off">
        <input type="text" id="budgetCategory" list="budgetCatList_expense" placeholder="Cat\u00e9gorie">
        <datalist id="budgetCatList_expense">${budgetCategoriesForType('expense').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <datalist id="budgetCatList_income">${budgetCategoriesForType('income').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <datalist id="budgetCatList_investment">${budgetCategoriesForType('investment').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <input type="date" id="budgetDate" value="${defaultDate}">
        <div class="budget-type-row">
          <button type="button" class="hours-status-btn active" data-budget-type="expense">\ud83d\udcb8 D\u00e9pense</button>
          <button type="button" class="hours-status-btn" data-budget-type="income">\ud83d\udcb0 Revenu</button>
          <button type="button" class="hours-status-btn" data-budget-type="investment">\ud83d\udcc8 Investissement</button>
        </div>
        <button class="btn btn-gold" id="btnBudgetAdd">+ Ajouter</button>
        <button class="btn btn-line" id="btnScanReceiptCam" style="grid-column:1 / -1;">📷 Photographier un ticket</button>
        <button class="btn btn-line" id="btnScanReceiptGallery" style="grid-column:1 / -1; margin-top:-4px;">🖼️ Choisir une photo existante</button>
        <input type="file" id="receiptFileInputCam" accept="image/*" capture="environment" style="display:none;">
        <input type="file" id="receiptFileInputGallery" accept="image/*" style="display:none;">
      </div>

      <div class="totals-bar">
        <div class="total-item"><span class="lbl">Revenus</span><span class="val" style="color:var(--sage);">${budgetFmt(tot.income)}</span></div>
        <div class="total-item"><span class="lbl">D\u00e9penses</span><span class="val" style="color:var(--brick);">${budgetFmt(tot.expense)}</span></div>
        ${tot.investment > 0 ? `<div class="total-item"><span class="lbl">Investis.</span><span class="val" style="color:var(--gold);">${budgetFmt(tot.investment)}</span></div>` : ''}
        ${(tot.livretIn > 0 || tot.livretOut > 0) ? `<div class="total-item"><span class="lbl">Livret</span><span class="val" style="color:var(--sage);">${tot.livret >= 0 ? '+' : ''}${budgetFmt(tot.livret)}</span></div>` : ''}
        <div class="total-item"><span class="lbl">Solde</span><span class="val" style="color:${tot.balance>=0?'var(--sage)':'var(--brick)'};">${tot.balance>=0?'+':''}${budgetFmt(tot.balance)}</span></div>
      </div>

      ${(() => {
        const ov = budgetOverallBalances();
        if(!state.budgetEntries.length) return '';
        return `
        <div class="dash-section-title" style="margin-top:16px;">Situation actuelle</div>
        <table class="situation-table">
          <tbody>
            <tr>
              <td class="sit-name">\ud83c\udfe6 Compte courant</td>
              <td class="sit-val" style="color:${ov.compte>=0?'var(--sage)':'var(--brick)'};">${budgetFmt(ov.compte)}</td>
            </tr>
            <tr>
              <td class="sit-name">\ud83d\udcb5 Livret</td>
              <td class="sit-val" style="color:var(--sage);">${budgetFmt(ov.livret)}</td>
            </tr>
            ${ov.investment > 0 ? `<tr>
              <td class="sit-name">\ud83d\udcc8 Autres investissements</td>
              <td class="sit-val" style="color:var(--gold);">${budgetFmt(ov.investment)}</td>
            </tr>` : ''}
            <tr class="sit-total">
              <td class="sit-name">Total</td>
              <td class="sit-val">${budgetFmt(ov.total)}</td>
            </tr>
          </tbody>
        </table>`;
      })()}

      ${compareHtml}

      ${catRecap.length ? `
        <div class="budget-cat-recap">
          <div class="dash-section-title">D\u00e9penses par cat\u00e9gorie</div>
          ${catRecap.map(([cat, val]) => `
            <div class="budget-cat-row budget-cat-clickable ${budgetCategoryFilter===cat?'active':''}" data-cat-filter="${esc(cat)}" title="Filtrer les entr\u00e9es sur cette cat\u00e9gorie">
              <span class="budget-cat-name">${budgetCatIcon(cat)} ${esc(cat)}</span>
              <div class="budget-cat-track"><div class="budget-cat-fill" style="width:${(val/maxCat)*100}%;"></div></div>
              <span class="budget-cat-val">${budgetFmt(val)}</span>
            </div>
          `).join('')}
        </div>` : ''}

      <div class="dash-section-title" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span>Entr\u00e9es du mois</span> <span class="dash-count-badge">${shownEntries.length}</span>
        ${monthCats.length > 1 ? `<select id="budgetFilterCat" class="sort-select" style="width:auto; margin:0; flex:1; min-width:150px;">
          <option value="">Toutes les cat\u00e9gories</option>
          ${monthCats.map(mc => `<option value="${esc(mc)}" ${mc===budgetCategoryFilter?'selected':''}>${budgetCatIcon(mc)} ${esc(mc)}</option>`).join('')}
        </select>` : ''}
      </div>
      ${shownEntries.length ? shownEntries.map(e => `
        <div class="budget-entry">
          <div class="budget-entry-icon">${e.type==='income'?'\ud83d\udcb0':(e.type==='investment'?'\ud83d\udcc8':budgetCatIcon(e.category))}</div>
          <div class="budget-entry-body">
            <div class="budget-entry-label">${esc(e.label||'(sans libell\u00e9)')}</div>
            <div class="budget-entry-meta">${new Date(e.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} \u00b7 ${esc(e.category||'Autre')}</div>
          </div>
          <div class="budget-entry-amount ${e.type==='income'?'income':(e.type==='investment'?'investment':'expense')}">${e.type==='income'?'+':'-'}${budgetFmt(e.amount)}</div>
          <button class="btn btn-danger budget-entry-del" data-delete-budget="${e.id}" style="padding:2px 6px;">&times;</button>
        </div>
      `).join('') : `<div class="empty-side">Aucune entr\u00e9e ce mois-ci.</div>`}
      ${entries.length ? `<button class="btn btn-line" id="btnBudgetPdf" style="margin-top:12px; font-size:12.5px;">\ud83d\udcc4 T\u00e9l\u00e9charger le budget du mois (PDF)</button>` : ''}
    `;

    let budgetType = 'expense';
    const catField = document.getElementById('budgetCategory');
    main.querySelectorAll('[data-budget-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        budgetType = btn.dataset.budgetType;
        main.querySelectorAll('[data-budget-type]').forEach(b => b.classList.toggle('active', b === btn));
        if(catField) catField.setAttribute('list', 'budgetCatList_' + budgetType);
      });
    });
    const addEntry = () => {
      const label = document.getElementById('budgetLabel').value.trim();
      const amount = parseFloat((document.getElementById('budgetAmount').value || '').replace(',', '.'));
      if(!label && !(amount > 0)){ toast('Renseigne un libell\u00e9 et un montant.'); return; }
      if(!(amount > 0)){ toast('Renseigne un montant valide.'); return; }
      const dateVal = document.getElementById('budgetDate').value || defaultDate;
      state.budgetEntries.push({
        id: uid(),
        label,
        amount,
        category: document.getElementById('budgetCategory').value.trim() || 'Autre',
        date: new Date(dateVal + 'T12:00:00').toISOString(),
        type: budgetType
      });
      save();
      const d = new Date(dateVal + 'T12:00:00');
      selectedBudgetMonth = { year: d.getFullYear(), month: d.getMonth() };
      budgetCategoryFilter = '';
      budgetExpandedYears.add(d.getFullYear());
      render();
      toast('Entr\u00e9e ajout\u00e9e \u2713');
    };
    document.getElementById('btnBudgetAdd').addEventListener('click', addEntry);
    ['budgetLabel','budgetAmount','budgetCategory'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', e => { if(e.key === 'Enter') addEntry(); });
    });
    const amountField = document.getElementById('budgetAmount');
    ['focus','click','touchend'].forEach(evt => amountField.addEventListener(evt, e => {
      if(evt === 'touchend') e.preventDefault();
      amountField.focus();
      openNumPad(amountField);
    }));
    main.querySelectorAll('[data-delete-budget]').forEach(btn => {
      bindConfirmDeleteButton(btn, () => {
        const trEntry = state.budgetEntries.find(x => x.id === btn.dataset.deleteBudget);
        if(trEntry) trashPut('budgetEntries', trEntry.label, trEntry);
        state.budgetEntries = state.budgetEntries.filter(x => x.id !== btn.dataset.deleteBudget);
        save();
        render();
      }, '?');
    });
    const filterSel = document.getElementById('budgetFilterCat');
    if(filterSel) filterSel.addEventListener('change', () => {
      budgetCategoryFilter = filterSel.value;
      renderBudgetMain();
    });
    main.querySelectorAll('[data-cat-filter]').forEach(row => {
      row.addEventListener('click', () => {
        budgetCategoryFilter = budgetCategoryFilter === row.dataset.catFilter ? '' : row.dataset.catFilter;
        renderBudgetMain();
      });
    });
    const pdfBtn = document.getElementById('btnBudgetPdf');
    if(pdfBtn) pdfBtn.addEventListener('click', () => {
      openPrintWindow(`Budget - ${HOURS_MONTH_NAMES[month]} ${year}`, buildBudgetPdfBody(year, month));
    });
    document.getElementById('btnBudgetPrevMonth').addEventListener('click', () => {
      const d = new Date(selectedBudgetMonth.year, selectedBudgetMonth.month - 1, 1);
      selectedBudgetMonth = { year: d.getFullYear(), month: d.getMonth() };
      budgetCategoryFilter = '';
      budgetExpandedYears.add(d.getFullYear());
      renderBudgetSidebar();
      renderBudgetMain();
    });
    document.getElementById('btnBudgetNextMonth').addEventListener('click', () => {
      const d = new Date(selectedBudgetMonth.year, selectedBudgetMonth.month + 1, 1);
      selectedBudgetMonth = { year: d.getFullYear(), month: d.getMonth() };
      budgetCategoryFilter = '';
      budgetExpandedYears.add(d.getFullYear());
      renderBudgetSidebar();
      renderBudgetMain();
    });
  }

  // ---------- liste de courses (espace calcul) ----------
  function renderShoppingMain(){
    const main = document.getElementById('shoppingMainArea');
    if(!main) return;
    const items = state.shoppingItems;
    const remaining = items.filter(i => !i.checked).length;
    const checkedCount = items.length - remaining;
    main.innerHTML = `
      <div class="shopping-head">
        <h2>\ud83d\uded2 Liste de courses</h2>
        <p>${items.length ? `${remaining} article${remaining>1?'s':''} restant${remaining>1?'s':''}` : 'Liste vide'}</p>
      </div>
      <div class="home-quick-add">
        <input type="text" id="shoppingNewItem" placeholder="Ajouter un article\u2026 (Entr\u00e9e pour valider)">
        <button class="btn btn-gold" id="btnShoppingAdd">+ Ajouter</button>
      </div>
      <div class="shopping-list">
        ${items.map(item => `
          <div class="shopping-item ${item.checked?'checked':''}" data-shopping-toggle="${item.id}">
            <span class="shopping-check">${item.checked?'\u2713':''}</span>
            <span class="shopping-name">${esc(item.name)}</span>
            <button class="btn btn-danger shopping-del" data-delete-shopping="${item.id}">&times;</button>
          </div>
        `).join('')}
      </div>
      ${checkedCount > 0 ? `<button class="btn btn-line" id="btnShoppingClearChecked" style="margin-top:14px;">Retirer les ${checkedCount} article${checkedCount>1?'s':''} coch\u00e9${checkedCount>1?'s':''}</button>` : ''}
    `;

    const addItem = () => {
      const input = document.getElementById('shoppingNewItem');
      const name = input.value.trim();
      if(!name) return;
      state.shoppingItems.push({ id: uid(), name, checked: false });
      save();
      render();
      const newInput = document.getElementById('shoppingNewItem');
      if(newInput) newInput.focus();
    };
    document.getElementById('btnShoppingAdd').addEventListener('click', addItem);
    document.getElementById('shoppingNewItem').addEventListener('keydown', e => { if(e.key === 'Enter') addItem(); });
    main.querySelectorAll('[data-shopping-toggle]').forEach(el => {
      el.addEventListener('click', e => {
        if(e.target.closest('[data-delete-shopping]')) return;
        const item = state.shoppingItems.find(i => i.id === el.dataset.shoppingToggle);
        if(!item) return;
        item.checked = !item.checked;
        save();
        render();
      });
    });
    main.querySelectorAll('[data-delete-shopping]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        state.shoppingItems = state.shoppingItems.filter(i => i.id !== btn.dataset.deleteShopping);
        save();
        render();
      });
    });
    const clearBtn = document.getElementById('btnShoppingClearChecked');
    if(clearBtn) clearBtn.addEventListener('click', () => {
      state.shoppingItems = state.shoppingItems.filter(i => !i.checked);
      save();
      render();
    });
    main.querySelectorAll('.shopping-item').forEach(el => {
      let startX = 0, curX = 0, swiping = false;
      el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; curX = 0; swiping = true; el.style.transition = 'none'; }, { passive:true });
      el.addEventListener('touchmove', e => {
        if(!swiping) return;
        curX = e.touches[0].clientX - startX;
        if(curX < 0) el.style.transform = `translateX(${Math.max(curX, -130)}px)`;
      }, { passive:true });
      el.addEventListener('touchend', () => {
        el.style.transition = '';
        if(curX < -85){
          state.shoppingItems = state.shoppingItems.filter(i => i.id !== el.dataset.shoppingToggle);
          save();
          render();
        } else {
          el.style.transform = '';
        }
        swiping = false; curX = 0;
      });
    });
  }

  // ---------- statistiques (espace calcul) ----------
  function statsLastMonths(n){
    const months = [];
    const now = new Date();
    for(let i = n-1; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return months;
  }
  function statsHoursForMonth(year, month){
    let min = 0;
    state.hoursWeeks.forEach(w => {
      (w.days||[]).forEach((day, dayIdx) => {
        const d = new Date(w.weekStart);
        d.setDate(d.getDate() + dayIdx);
        if(d.getFullYear() === year && d.getMonth() === month) min += hoursDayMinutes(day);
      });
    });
    return min;
  }
  function renderStatsMain(){
    const main = document.getElementById('statsMainArea');
    if(!main) return;
    const months = statsLastMonths(12);

    const hoursData = months.map(m => ({ ...m, minutes: statsHoursForMonth(m.year, m.month) }));
    const maxHours = Math.max(1, ...hoursData.map(d => d.minutes));
    const hasHours = hoursData.some(d => d.minutes > 0);

    const budgetData = months.map(m => ({ ...m, ...budgetMonthTotals(m.year, m.month) }));
    const maxBudget = Math.max(1, ...budgetData.map(d => Math.max(d.expense, d.income)));
    const hasBudget = budgetData.some(d => d.expense > 0 || d.income > 0);

    const cutoff = new Date(months[0].year, months[0].month, 1);
    const byChantier = {};
    state.hoursWeeks.forEach(w => {
      (w.days||[]).forEach((day, dayIdx) => {
        if(day.status && day.status !== 'normal') return;
        const d = new Date(w.weekStart);
        d.setDate(d.getDate() + dayIdx);
        if(d < cutoff) return;
        (day.chantiers||[]).forEach(c => {
          const minu = chantierBlockMinutes(c);
          if(minu <= 0) return;
          const name = (c.name||'').trim() || '(sans nom)';
          byChantier[name] = (byChantier[name]||0) + minu;
        });
      });
    });
    const chantierRecap = Object.entries(byChantier).sort((a,b) => b[1]-a[1]).slice(0, 8);
    const maxChantier = Math.max(1, ...chantierRecap.map(([,v]) => v));

    const monthShort = m => HOURS_MONTH_NAMES[m.month].slice(0,3);

    main.innerHTML = `
      <div class="shopping-head">
        <h2>\ud83d\udcca Statistiques</h2>
        <p>Sur les 12 derniers mois</p>
      </div>

      <div class="stats-cards">
        <div class="dash-card" style="cursor:default;"><div class="dash-card-icon">\u23f1\ufe0f</div><div class="dash-card-count">${hoursFormatDuration(hoursData.reduce((s,d)=>s+d.minutes,0)/60)}</div><div class="dash-card-label">Heures travaill\u00e9es</div></div>
        <div class="dash-card" style="cursor:default;"><div class="dash-card-icon">\ud83d\udcb8</div><div class="dash-card-count" style="font-size:20px;">${budgetFmt(budgetData.reduce((s,d)=>s+d.expense,0))}</div><div class="dash-card-label">D\u00e9penses totales</div></div>
        <div class="dash-card" style="cursor:default;"><div class="dash-card-icon">\ud83c\udfed</div><div class="dash-card-count">${state.suppliers.length}</div><div class="dash-card-label">Fournisseurs</div></div>
        <div class="dash-card" style="cursor:default;"><div class="dash-card-icon">\ud83d\udcc1</div><div class="dash-card-count">${state.folders.length}</div><div class="dash-card-label">Dossiers</div></div>
      </div>

      <div class="dash-section-title">Heures travaill\u00e9es par mois</div>
      ${hasHours ? `
        <div class="stats-bar-chart">
          ${hoursData.map(d => `
            <div class="stats-bar-col" title="${HOURS_MONTH_NAMES[d.month]} ${d.year} : ${hoursFormatDuration(d.minutes/60)}">
              <div class="stats-bar-val">${d.minutes>0 ? Math.round(d.minutes/60)+'h' : ''}</div>
              <div class="stats-bar-track"><div class="stats-bar-fill" style="height:${Math.max(2,(d.minutes/maxHours)*100)}%;"></div></div>
              <div class="stats-bar-lbl">${monthShort(d)}</div>
            </div>
          `).join('')}
        </div>` : `<div class="empty-side">Aucune heure enregistr\u00e9e \u2014 remplis l'onglet Heures pour voir ce graphique.</div>`}

      <div class="dash-section-title">Budget par mois</div>
      ${hasBudget ? `
        <div class="stats-legend"><span class="stats-legend-item"><span class="cal-dot" style="background:var(--sage);"></span>Revenus</span><span class="stats-legend-item"><span class="cal-dot" style="background:var(--brick);"></span>D\u00e9penses</span></div>
        <div class="stats-bar-chart">
          ${budgetData.map(d => `
            <div class="stats-bar-col" title="${HOURS_MONTH_NAMES[d.month]} ${d.year} : +${budgetFmt(d.income)} / -${budgetFmt(d.expense)}">
              <div class="stats-bar-track stats-bar-double">
                <div class="stats-bar-fill" style="height:${Math.max(2,(d.income/maxBudget)*100)}%; background:var(--sage);"></div>
                <div class="stats-bar-fill" style="height:${Math.max(2,(d.expense/maxBudget)*100)}%; background:var(--brick);"></div>
              </div>
              <div class="stats-bar-lbl">${monthShort(d)}</div>
            </div>
          `).join('')}
        </div>` : `<div class="empty-side">Aucune entr\u00e9e de budget \u2014 remplis l'onglet Budget pour voir ce graphique.</div>`}

      <div class="dash-section-title">Heures par chantier</div>
      ${chantierRecap.length ? chantierRecap.map(([name, minu], i) => `
        <div class="budget-cat-row">
          <span class="budget-cat-name">${esc(name)}</span>
          <div class="budget-cat-track"><div class="budget-cat-fill" style="width:${(minu/maxChantier)*100}%; background:${HOURS_CHANTIER_COLORS[i % HOURS_CHANTIER_COLORS.length]};"></div></div>
          <span class="budget-cat-val">${hoursFormatDuration(minu/60)}</span>
        </div>
      `).join('') : `<div class="empty-side">Aucun chantier renseign\u00e9 sur la p\u00e9riode.</div>`}
    `;
  }

  // ---------- easter egg : jeu caché (mini RPG) ----------
  const RPG_GRID = 8;
  const RPG_CELL = 34;
  const RPG_SAVE_KEY = 'rf-rpg-character';
  const RPG_MONSTERS = [
    { name:'Rat',            emoji:'🐀', hp:8,  atk:2, xp:4,  gold:2 },
    { name:'Chauve-souris',  emoji:'🦇', hp:10, atk:3, xp:5,  gold:3 },
    { name:'Gobelin',        emoji:'👹', hp:14, atk:4, xp:8,  gold:5 },
    { name:'Loup',           emoji:'🐺', hp:18, atk:5, xp:11, gold:7 },
    { name:'Squelette',      emoji:'💀', hp:22, atk:6, xp:14, gold:9 },
    { name:'Dragon',         emoji:'🐉', hp:40, atk:9, xp:30, gold:25 }
  ];
  const RPG_WALL_DECOR = ['🕸️','🔥','⛓️','🗝️'];
  const RPG_FLOOR_DECOR = ['🦴','🍄','💧','🌿'];
  const RPG_SHOP_ITEMS = [
    { id:'sword1', name:'Épée en fer', desc:'+2 Attaque', cost:20, effect: c => { c.atk += 2; } },
    { id:'sword2', name:'Épée en acier', desc:'+4 Attaque', cost:50, effect: c => { c.atk += 4; } },
    { id:'shield1', name:'Bouclier renforcé', desc:'+2 Défense', cost:25, effect: c => { c.def += 2; } },
    { id:'armor1', name:'Armure de plates', desc:'+4 Défense', cost:55, effect: c => { c.def += 4; } },
    { id:'potion', name:'Grimoire de vitalité', desc:'+10 PV max, soin complet', cost:15, effect: c => { c.maxHp += 10; c.hp = c.maxHp; } }
  ];
  const RPG_DIFFICULTIES = {
    easy:   { id:'easy',   name:'Facile',    hpMult:1.5,  atkMult:1.3,  enemyAtkMult:0.7 },
    normal: { id:'normal', name:'Normal',    hpMult:1,    atkMult:1,    enemyAtkMult:1 },
    hard:   { id:'hard',   name:'Difficile', hpMult:0.7,  atkMult:0.75, enemyAtkMult:1.6 }
  };
  const RPG_STARTING_BOOSTS = [
    { id:'hp',    name:'❤️ Vitalité',   desc:'+8 PV max',              effect: c => { c.maxHp += 8; c.hp = c.maxHp; } },
    { id:'atk',   name:'⚔️ Force',      desc:'+2 Attaque',             effect: c => { c.atk += 2; } },
    { id:'def',   name:'🛡️ Robustesse', desc:'+2 Défense',             effect: c => { c.def += 2; } },
    { id:'gold',  name:'🪙 Fortune',    desc:'+20 Or de départ',       effect: c => { c.gold += 20; } },
    { id:'sage',  name:'📖 Sagesse',    desc:'Commence au niveau 2',   effect: c => { c.level = 2; c.maxHp += 6; c.atk += 2; c.def += 1; c.hp = c.maxHp; c.xpNext = Math.round(c.xpNext*1.4); } }
  ];

  let rpgChar = null;
  let rpgMap = null;
  let rpgBattle = null;
  let rpgBoostChoices = [];
  let rpgMode = 'difficulty';

  function rpgNewChar(difficultyId){
    const d = RPG_DIFFICULTIES[difficultyId] || RPG_DIFFICULTIES.normal;
    const baseHp = Math.round(20 * d.hpMult);
    return {
      level:1, xp:0, xpNext:20, hp:baseHp, maxHp:baseHp, atk:Math.round(4 * d.atkMult), def:1,
      gold:0, floor:1, difficulty:d.id, enemyAtkMult:d.enemyAtkMult
    };
  }
  // La partie ne persiste plus d'une ouverture à l'autre : elle repart toujours de zéro
  // (écran de choix de difficulté). Ces fonctions restent en place, neutres, pour ne pas
  // avoir à retoucher tous leurs points d'appel.
  function rpgLoadChar(){ return null; }
  function rpgSaveChar(){ /* volontairement vide */ }

  function rpgRandomFreeTile(grid){
    for(let tries=0; tries<40; tries++){
      const x = 1 + Math.floor(Math.random()*(RPG_GRID-2));
      const y = 1 + Math.floor(Math.random()*(RPG_GRID-2));
      if(grid[y][x].type === 'floor' && !(x===1 && y===1)) return {x,y};
    }
    return null;
  }
  function rpgCountNonWall(grid){
    let n = 0;
    for(let y=0;y<RPG_GRID;y++) for(let x=0;x<RPG_GRID;x++) if(grid[y][x].type !== 'wall') n++;
    return n;
  }
  function rpgFloodFillCount(grid, start){
    const visited = new Set([start.x+','+start.y]);
    const queue = [start];
    while(queue.length){
      const cur = queue.shift();
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => {
        const nx = cur.x+dx, ny = cur.y+dy;
        const key = nx+','+ny;
        if(nx<0||nx>=RPG_GRID||ny<0||ny>=RPG_GRID||visited.has(key)) return;
        if(grid[ny][nx].type === 'wall') return;
        visited.add(key);
        queue.push({x:nx,y:ny});
      });
    }
    return visited.size;
  }
  function rpgGenerateFloor(floorNum){
    const grid = [];
    for(let y=0;y<RPG_GRID;y++){
      const row = [];
      for(let x=0;x<RPG_GRID;x++) row.push({ type:'floor' });
      grid.push(row);
    }
    for(let x=0;x<RPG_GRID;x++){ grid[0][x] = {type:'wall'}; grid[RPG_GRID-1][x] = {type:'wall'}; }
    for(let y=0;y<RPG_GRID;y++){ grid[y][0] = {type:'wall'}; grid[y][RPG_GRID-1] = {type:'wall'}; }

    // Pose des murs internes en validant à chaque fois que tout reste accessible
    // depuis le départ (empêche toute zone — et donc toute sortie — d'être bloquée).
    const wallCount = 4 + Math.floor(Math.random()*4);
    let placed = 0, safety = 0;
    while(placed < wallCount && safety < 200){
      safety++;
      const x = 1 + Math.floor(Math.random()*(RPG_GRID-2));
      const y = 1 + Math.floor(Math.random()*(RPG_GRID-2));
      if((x===1 && y===1) || grid[y][x].type === 'wall') continue;
      grid[y][x] = {type:'wall'};
      const totalFloor = rpgCountNonWall(grid);
      const reachable = rpgFloodFillCount(grid, {x:1,y:1});
      if(reachable !== totalFloor){
        grid[y][x] = {type:'floor'}; // ce mur isolerait une zone : on annule
      } else {
        placed++;
      }
    }

    const maxMonsterIdx = Math.min(RPG_MONSTERS.length-1, Math.floor(floorNum/2) + (Math.random()<0.12 ? RPG_MONSTERS.length : 0));
    const enemyCount = 2 + Math.min(4, Math.floor(floorNum/2));
    for(let i=0;i<enemyCount;i++){
      const pos = rpgRandomFreeTile(grid);
      if(!pos) continue;
      const idx = Math.floor(Math.random()*(maxMonsterIdx+1));
      const base = RPG_MONSTERS[idx];
      const enemyAtkMult = (rpgChar && rpgChar.enemyAtkMult) || 1;
      grid[pos.y][pos.x] = { type:'enemy', monster:{ ...base, hp: base.hp + floorNum*2, atk: Math.max(1, Math.round((base.atk + Math.floor(floorNum/2)) * enemyAtkMult)) } };
    }
    const chestPos = rpgRandomFreeTile(grid);
    if(chestPos) grid[chestPos.y][chestPos.x] = { type:'chest', gold: 5 + Math.floor(Math.random()*10) + floorNum*2 };
    if(floorNum % 5 === 0){
      const shopPos = rpgRandomFreeTile(grid);
      if(shopPos) grid[shopPos.y][shopPos.x] = { type:'shop' };
    }
    const stairsPos = rpgRandomFreeTile(grid);
    if(stairsPos) grid[stairsPos.y][stairsPos.x] = { type:'stairs' };

    // Décor purement visuel, posé en dernier sur les murs/sols restés simples
    for(let y=1;y<RPG_GRID-1;y++){
      for(let x=1;x<RPG_GRID-1;x++){
        const cell = grid[y][x];
        if(cell.type === 'wall' && Math.random() < 0.18){
          cell.decor = RPG_WALL_DECOR[Math.floor(Math.random()*RPG_WALL_DECOR.length)];
        } else if(cell.type === 'floor' && Math.random() < 0.10){
          cell.decor = RPG_FLOOR_DECOR[Math.floor(Math.random()*RPG_FLOOR_DECOR.length)];
        }
      }
    }

    return { grid, player:{x:1,y:1} };
  }

  function openGameModal(){
    document.getElementById('gameModal').style.display = 'flex';
    rpgChar = null;
    rpgMap = null;
    rpgMode = 'difficulty';
    rpgBattle = null;
    rpgRenderAll();
    document.addEventListener('keydown', handleGameKeydown);
  }
  function closeGameModal(){
    document.getElementById('gameModal').style.display = 'none';
    document.removeEventListener('keydown', handleGameKeydown);
    // Pas de sauvegarde : la partie repart de zéro à la prochaine ouverture.
  }
  function rpgPickRandomBoosts(n){
    const pool = RPG_STARTING_BOOSTS.slice();
    const picked = [];
    for(let i=0; i<n && pool.length; i++){
      const idx = Math.floor(Math.random()*pool.length);
      picked.push(pool.splice(idx,1)[0]);
    }
    return picked;
  }
  function rpgStartNewGame(difficultyId){
    rpgChar = rpgNewChar(difficultyId);
    rpgBattle = null;
    rpgBoostChoices = rpgPickRandomBoosts(3);
    rpgMode = 'boost';
    rpgRenderAll();
  }
  function rpgChooseBoost(boostId){
    const boost = rpgBoostChoices.find(b => b.id === boostId);
    if(boost) boost.effect(rpgChar);
    rpgMap = rpgGenerateFloor(1);
    rpgMode = 'map';
    rpgRenderAll();
  }
  function rpgDrawBoostChoices(){
    const wrap = document.getElementById('rpgBoostList');
    if(!wrap) return;
    wrap.innerHTML = rpgBoostChoices.map(b => `
      <button class="rpg-difficulty-btn" data-boost="${b.id}">
        <div class="rpg-difficulty-name">${esc(b.name)}</div>
        <div class="rpg-difficulty-desc">${esc(b.desc)}</div>
      </button>
    `).join('');
    wrap.querySelectorAll('[data-boost]').forEach(btn => {
      btn.addEventListener('click', () => rpgChooseBoost(btn.dataset.boost));
    });
  }

  function rpgMove(dir){
    if(rpgMode !== 'map' || !rpgMap) return;
    const delta = { up:{x:0,y:-1}, down:{x:0,y:1}, left:{x:-1,y:0}, right:{x:1,y:0} }[dir];
    if(!delta) return;
    const nx = rpgMap.player.x + delta.x;
    const ny = rpgMap.player.y + delta.y;
    if(nx<0 || nx>=RPG_GRID || ny<0 || ny>=RPG_GRID) return;
    const cell = rpgMap.grid[ny][nx];
    if(cell.type === 'wall') return;

    if(cell.type === 'enemy'){ rpgStartBattle(cell.monster, nx, ny); return; }

    if(cell.type === 'chest'){
      rpgChar.gold += cell.gold;
      toast(`+${cell.gold} 🪙 trouvés dans un coffre !`);
      rpgMap.grid[ny][nx] = { type:'floor' };
      rpgMap.player = {x:nx,y:ny};
      rpgSaveChar();
      rpgRenderAll();
      return;
    }
    if(cell.type === 'shop'){
      rpgMap.player = {x:nx,y:ny};
      rpgMode = 'shop';
      rpgRenderAll();
      return;
    }
    if(cell.type === 'stairs'){
      rpgChar.floor += 1;
      if(state.arcade && rpgChar.difficulty){
        const rb = state.arcade.rpgBest;
        if(rpgChar.floor > (rb[rpgChar.difficulty] || 0)){ rb[rpgChar.difficulty] = rpgChar.floor; save(); }
      }
      rpgChar.hp = rpgChar.maxHp;
      rpgMap = rpgGenerateFloor(rpgChar.floor);
      toast(`Étage ${rpgChar.floor} !`);
      rpgSaveChar();
      rpgRenderAll();
      return;
    }
    rpgMap.player = {x:nx,y:ny};
    rpgRenderAll();
  }

  function rpgStartBattle(monster, x, y){
    rpgMode = 'battle';
    rpgBattle = { monster: { ...monster, maxHp: monster.hp }, x, y, defending:false, log:[`Un ${monster.name} sauvage apparaît !`] };
    rpgRenderAll();
  }
  function rpgEndBattle(){
    rpgMode = 'map';
    rpgBattle = null;
    rpgRenderAll();
  }
  function rpgCheckLevelUp(){
    while(rpgChar.xp >= rpgChar.xpNext){
      rpgChar.xp -= rpgChar.xpNext;
      rpgChar.level += 1;
      rpgChar.xpNext = Math.round(rpgChar.xpNext * 1.4);
      rpgChar.maxHp += 6;
      rpgChar.atk += 2;
      rpgChar.def += 1;
      rpgChar.hp = rpgChar.maxHp;
      toast(`Niveau ${rpgChar.level} atteint !`);
    }
  }
  function rpgDefeat(){
    rpgChar.gold = Math.floor(rpgChar.gold * 0.5);
    rpgChar.hp = rpgChar.maxHp;
    rpgChar.floor = 1;
    rpgMap = rpgGenerateFloor(1);
    rpgMode = 'map';
    rpgBattle = null;
    rpgSaveChar();
    toast('Tu te réveilles au village, plus pauvre mais vivant.');
    rpgRenderAll();
  }
  function rpgBattleAction(action){
    if(rpgMode !== 'battle' || !rpgBattle) return;
    const b = rpgBattle;
    if(action === 'flee'){
      if(Math.random() < 0.5){
        b.log.push('Tu prends la fuite !');
        rpgRenderAll();
        setTimeout(rpgEndBattle, 500);
        return;
      }
      b.log.push('Impossible de fuir !');
    } else if(action === 'attack'){
      const dmg = Math.max(1, rpgChar.atk + Math.floor(Math.random()*3) - 1);
      b.monster.hp -= dmg;
      b.log.push(`Tu infliges ${dmg} dégâts.`);
      if(b.monster.hp <= 0){
        b.log.push(`${b.monster.name} vaincu !`);
        rpgChar.xp += b.monster.xp;
        rpgChar.gold += b.monster.gold;
        rpgCheckLevelUp();
        rpgMap.grid[b.y][b.x] = { type:'floor' };
        rpgSaveChar();
        rpgRenderAll();
        setTimeout(rpgEndBattle, 900);
        return;
      }
    } else if(action === 'defend'){
      b.defending = true;
      b.log.push('Tu te mets en garde.');
    }
    const rawDmg = b.monster.atk + Math.floor(Math.random()*2);
    let dmg = Math.max(1, rawDmg - rpgChar.def);
    if(b.defending) dmg = Math.round(dmg * 0.25); // bloque 75% des dégâts, arrondi à l'unité
    rpgChar.hp -= dmg;
    b.log.push(b.defending
      ? (dmg === 0
          ? `${b.monster.name} attaque, mais tu bloques entièrement le coup !`
          : `${b.monster.name} inflige seulement ${dmg} dégâts (75% bloqués) !`)
      : `${b.monster.name} inflige ${dmg} dégâts.`);
    b.defending = false;
    if(rpgChar.hp <= 0){
      rpgChar.hp = 0;
      b.log.push('Tu es vaincu...');
      rpgSaveChar();
      rpgRenderAll();
      setTimeout(rpgDefeat, 1200);
      return;
    }
    rpgSaveChar();
    rpgRenderAll();
  }

  function gameCssVar(name, fallback){
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return v && v.trim() ? v.trim() : fallback;
  }
  function rpgDrawMap(){
    const canvas = document.getElementById('gameCanvas');
    if(!canvas || !rpgMap) return;
    const ctx = canvas.getContext('2d');
    ctx.font = (RPG_CELL-10) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for(let y=0; y<RPG_GRID; y++){
      for(let x=0; x<RPG_GRID; x++){
        const cell = rpgMap.grid[y][x];
        const px = x*RPG_CELL, py = y*RPG_CELL;

        if(cell.type === 'wall'){
          // mur façon pierre : bloc plein + lignes de mortier
          ctx.fillStyle = gameCssVar('--line', '#D9D3C1');
          ctx.fillRect(px, py, RPG_CELL, RPG_CELL);
          ctx.strokeStyle = gameCssVar('--paper', '#F2EFE6');
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px, py+RPG_CELL*0.5); ctx.lineTo(px+RPG_CELL, py+RPG_CELL*0.5);
          ctx.moveTo(px+RPG_CELL*0.5, py); ctx.lineTo(px+RPG_CELL*0.5, py+RPG_CELL*0.42);
          ctx.moveTo(px+RPG_CELL*0.25, py+RPG_CELL*0.5); ctx.lineTo(px+RPG_CELL*0.25, py+RPG_CELL);
          ctx.moveTo(px+RPG_CELL*0.75, py+RPG_CELL*0.5); ctx.lineTo(px+RPG_CELL*0.75, py+RPG_CELL);
          ctx.stroke();
          if(cell.decor){
            ctx.font = (RPG_CELL-18) + 'px sans-serif';
            ctx.fillText(cell.decor, px+RPG_CELL/2, py+RPG_CELL/2);
            ctx.font = (RPG_CELL-10) + 'px sans-serif';
          }
          continue;
        }

        // sol en damier pour casser la monotonie
        const isDark = (x+y) % 2 === 0;
        ctx.fillStyle = isDark ? gameCssVar('--paper', '#F2EFE6') : gameCssVar('--paper-raised', '#FBFAF5');
        ctx.fillRect(px, py, RPG_CELL, RPG_CELL);
        ctx.strokeStyle = gameCssVar('--line', '#D9D3C1');
        ctx.lineWidth = 1;
        ctx.strokeRect(px+0.5, py+0.5, RPG_CELL-1, RPG_CELL-1);

        const cx = px + RPG_CELL/2, cy = py + RPG_CELL/2;
        if(cell.type === 'enemy') ctx.fillText(cell.monster.emoji, cx, cy);
        else if(cell.type === 'chest') ctx.fillText('🎁', cx, cy);
        else if(cell.type === 'shop') ctx.fillText('🛒', cx, cy);
        else if(cell.type === 'stairs') ctx.fillText('🔽', cx, cy);
        else if(cell.decor){
          ctx.globalAlpha = 0.55;
          ctx.font = (RPG_CELL-18) + 'px sans-serif';
          ctx.fillText(cell.decor, cx, cy);
          ctx.font = (RPG_CELL-10) + 'px sans-serif';
          ctx.globalAlpha = 1;
        }
      }
    }

    // teinte plus sombre/inquiétante à mesure que l'on descend dans le donjon
    const depthTint = Math.min(0.4, (rpgChar.floor-1) * 0.05);
    if(depthTint > 0){
      ctx.fillStyle = `rgba(30,12,10,${depthTint})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Joueur : halo + contour marqué + couleur vive, pour rester bien visible
    // quelle que soit la case ou la teinte de profondeur en dessous.
    const px = rpgMap.player.x*RPG_CELL + RPG_CELL/2, py = rpgMap.player.y*RPG_CELL + RPG_CELL/2;
    ctx.beginPath();
    ctx.arc(px, py, RPG_CELL*0.44, 0, Math.PI*2);
    ctx.fillStyle = gameCssVar('--gold', '#B8912A');
    ctx.globalAlpha = 0.32;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = gameCssVar('--gold', '#B8912A');
    ctx.stroke();

    ctx.font = (RPG_CELL-2) + 'px sans-serif';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a1208';
    ctx.strokeText('♞', px, py);
    ctx.fillStyle = '#FFE082';
    ctx.fillText('♞', px, py);
    ctx.font = (RPG_CELL-10) + 'px sans-serif';
  }
  function rpgDrawBattle(){
    const b = rpgBattle;
    if(!b) return;
    document.getElementById('rpgEnemyEmoji').textContent = b.monster.emoji;
    document.getElementById('rpgEnemyName').textContent = b.monster.name;
    const pct = Math.max(0, (b.monster.hp / b.monster.maxHp) * 100);
    document.getElementById('rpgEnemyHpFill').style.width = pct + '%';
    document.getElementById('rpgBattleLog').innerHTML = b.log.slice(-4).map(l => `<div>${esc(l)}</div>`).join('');
  }
  function rpgDrawShop(){
    document.getElementById('rpgShopGold').textContent = rpgChar.gold;
    const wrap = document.getElementById('rpgShopItems');
    wrap.innerHTML = RPG_SHOP_ITEMS.map(item => `
      <div class="rpg-shop-item">
        <div class="rpg-shop-item-info">
          <div class="rpg-shop-item-name">${esc(item.name)}</div>
          <div class="rpg-shop-item-desc">${esc(item.desc)}</div>
        </div>
        <button class="btn btn-gold" data-buy-item="${item.id}" ${rpgChar.gold < item.cost ? 'disabled' : ''}>${item.cost} 🪙</button>
      </div>
    `).join('');
  }
  function rpgRenderAll(){
    document.getElementById('rpgDifficultyView').style.display = rpgMode === 'difficulty' ? 'block' : 'none';
    document.getElementById('rpgBoostView').style.display = rpgMode === 'boost' ? 'block' : 'none';
    document.getElementById('rpgStatBar').style.display = (rpgMode === 'difficulty' || rpgMode === 'boost') ? 'none' : 'flex';
    document.getElementById('rpgMapView').style.display = rpgMode === 'map' ? 'block' : 'none';
    document.getElementById('rpgBattleView').style.display = rpgMode === 'battle' ? 'block' : 'none';
    document.getElementById('rpgShopView').style.display = rpgMode === 'shop' ? 'block' : 'none';
    if(rpgMode === 'boost') rpgDrawBoostChoices();
    if(rpgMode === 'difficulty' || rpgMode === 'boost' || !rpgChar) return;
    document.getElementById('rpgHp').textContent = rpgChar.hp;
    document.getElementById('rpgMaxHp').textContent = rpgChar.maxHp;
    document.getElementById('rpgLevel').textContent = rpgChar.level;
    document.getElementById('rpgGold').textContent = rpgChar.gold;
    document.getElementById('rpgFloor').textContent = rpgChar.floor;
    if(rpgMode === 'map') rpgDrawMap();
    else if(rpgMode === 'battle') rpgDrawBattle();
    else if(rpgMode === 'shop') rpgDrawShop();
  }

  function handleGameKeydown(e){
    const map = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
    const dir = map[e.key];
    if(!dir) return;
    e.preventDefault();
    rpgMove(dir);
  }
  document.querySelectorAll('.game-btn').forEach(btn => {
    btn.addEventListener('click', () => rpgMove(btn.dataset.dir));
  });
  document.getElementById('btnRpgAttack').addEventListener('click', () => rpgBattleAction('attack'));
  document.getElementById('btnRpgDefend').addEventListener('click', () => rpgBattleAction('defend'));
  document.getElementById('btnRpgFlee').addEventListener('click', () => rpgBattleAction('flee'));
  document.getElementById('rpgShopItems').addEventListener('click', e => {
    const btn = e.target.closest('[data-buy-item]');
    if(!btn) return;
    const item = RPG_SHOP_ITEMS.find(i => i.id === btn.dataset.buyItem);
    if(!item || rpgChar.gold < item.cost) return;
    rpgChar.gold -= item.cost;
    item.effect(rpgChar);
    rpgSaveChar();
    toast(`${item.name} acheté ✓`);
    rpgRenderAll();
  });
  document.getElementById('btnRpgShopLeave').addEventListener('click', () => {
    rpgMode = 'map';
    rpgRenderAll();
  });
  bindConfirmDeleteButton(document.getElementById('btnGameRestart'), () => {
    rpgChar = null;
    rpgMap = null;
    rpgBattle = null;
    rpgMode = 'difficulty';
    rpgRenderAll();
  }, 'Sûr ? Partie en cours perdue');
  document.querySelectorAll('.rpg-difficulty-btn').forEach(btn => {
    btn.addEventListener('click', () => rpgStartNewGame(btn.dataset.difficulty));
  });
  document.getElementById('btnGameModalClose').addEventListener('click', closeGameModal);
  document.getElementById('btnGameModalClose2').addEventListener('click', closeGameModal);
  document.getElementById('gameModal').addEventListener('click', e => {
    if(e.target.id === 'gameModal') closeGameModal();
  });

  // ---------- accueil (tableau de bord) ----------
