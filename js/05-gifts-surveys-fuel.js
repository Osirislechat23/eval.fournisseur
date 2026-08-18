  const GIFT_STATUS = { idea:'Id\u00e9e', bought:'Achet\u00e9', given:'Offert' };
  function getPerson(id){ return state.people.find(p => p.id === id) || null; }

  // Jours restants avant le prochain anniversaire
  function daysToBirthday(dateStr){
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d)) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if(next < today) next.setFullYear(next.getFullYear() + 1);
    return Math.round((next - today) / 86400000);
  }
  function ageAtNext(dateStr){
    if(!dateStr) return null;
    const d = new Date(dateStr);
    if(isNaN(d) || d.getFullYear() < 1900) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if(next >= new Date(today.getFullYear(), today.getMonth(), today.getDate())) { /* cette annee */ }
    else age += 1;
    return age;
  }

  function renderPersonSidebar(){
    renderListSidebar({
      listElId: 'personList', dataAttr: 'person',
      items: state.people, selectedId: selectedPersonId,
      matchQuery: () => true,
      sortFn: (a,b) => {
        const da = daysToBirthday(a.birthday), db = daysToBirthday(b.birthday);
        if(da === null && db === null) return (a.name||'').localeCompare(b.name||'', 'fr');
        if(da === null) return 1;
        if(db === null) return -1;
        return da - db;
      },
      emptyMessage: '<div class="empty-side">Aucun proche. Ajoute quelqu\u2019un pour noter tes id\u00e9es cadeaux toute l\u2019ann\u00e9e.</div>',
      itemHtml: p => {
        const d = daysToBirthday(p.birthday);
        const pending = (p.gifts||[]).filter(g => g.status !== 'given').length;
        const soon = d !== null && d <= 30;
        return `
        <div class="name">${esc(p.name||'(sans nom)')}</div>
        <div class="meta">${esc(p.relation||'')}</div>
        ${d !== null ? `<div class="meta">\ud83c\udf82 ${d === 0 ? 'aujourd\u2019hui !' : 'dans ' + d + ' jour' + (d>1?'s':'')}</div>` : ''}
        ${soon ? `<div class="veh-badge soon">anniversaire proche</div>` : (pending ? `<div class="meta">${pending} id\u00e9e${pending>1?'s':''} en attente</div>` : '')}`;
      }
    });
  }

  function renderGiftMain(){
    const main = document.getElementById('giftMainArea');
    if(!main) return;
    const p = getPerson(selectedPersonId);
    if(!p){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucun proche s\u00e9lectionn\u00e9</h2>
          <p>Note tes id\u00e9es cadeaux au fil de l\u2019ann\u00e9e, avec la date d\u2019anniversaire de chacun et un rappel quand elle approche.</p>
        </div>`;
      return;
    }
    const gifts = p.gifts || [];
    const budget = gifts.filter(g => g.status !== 'given').reduce((s,g) => s + (parseFloat(g.price)||0), 0);
    const spent = gifts.filter(g => g.status === 'given' || g.status === 'bought').reduce((s,g) => s + (parseFloat(g.price)||0), 0);
    const d = daysToBirthday(p.birthday);
    const age = ageAtNext(p.birthday);

    main.innerHTML = `
      <div class="sheet-toolbar">
        <div><div class="section-label" style="margin-bottom:0;"><span>Proche</span></div></div>
        <div class="sheet-toolbar-actions">
          <button class="btn btn-danger" id="btnDeletePerson">Supprimer</button>
        </div>
      </div>

      <div class="sheet-header-form">
        <div class="field full"><label>Nom</label><input type="text" id="gpName" value="${esc(p.name||'')}" placeholder="ex. Camille"></div>
        <div class="field"><label>Lien</label><input type="text" id="gpRelation" value="${esc(p.relation||'')}" placeholder="ex. Ma s\u0153ur"></div>
        <div class="field"><label>Anniversaire</label><input type="date" id="gpBirthday" value="${(p.birthday||'').slice(0,10)}"></div>
        <div class="field full"><label>Ce qui lui plaît</label><input type="text" id="gpLikes" value="${esc(p.likes||'')}" placeholder="ex. jardinage, romans policiers, th\u00e9"></div>
      </div>

      <div class="totals-bar">
        ${d !== null ? `<div class="tot"><span class="lbl">Anniversaire</span><span class="val">${d === 0 ? 'Aujourd\u2019hui' : 'J\u2212' + d}</span></div>` : ''}
        ${age ? `<div class="tot"><span class="lbl">Aura</span><span class="val">${age} ans</span></div>` : ''}
        <div class="tot"><span class="lbl">Id\u00e9es en attente</span><span class="val">${gifts.filter(g => g.status === 'idea').length}</span></div>
        <div class="tot"><span class="lbl">Budget pr\u00e9vu</span><span class="val">${budgetFmt(budget)}</span></div>
        <div class="tot"><span class="lbl">D\u00e9j\u00e0 engag\u00e9</span><span class="val">${budgetFmt(spent)}</span></div>
      </div>

      <div class="dash-section-title">Ajouter une id\u00e9e</div>
      <div class="gift-add-form">
        <input type="text" id="gfNewLabel" placeholder="Id\u00e9e cadeau">
        <input type="text" id="gfNewPrice" placeholder="Prix \u20ac" inputmode="none">
        <input type="text" id="gfNewNote" placeholder="O\u00f9 le trouver, taille, couleur\u2026">
        <button class="btn btn-gold" id="btnGiftAdd">+ Ajouter</button>
      </div>

      <div class="dash-section-title">Id\u00e9es <span class="dash-count-badge">${gifts.length}</span></div>
      ${gifts.length ? gifts.map(g => `
        <div class="gift-item ${g.status}">
          <div class="gift-body">
            <div class="gift-label">${esc(g.label||'')}</div>
            ${g.note ? `<div class="gift-note">${esc(g.note)}</div>` : ''}
          </div>
          <div class="gift-price">${g.price ? budgetFmt(parseFloat(g.price)) : ''}</div>
          <select class="gift-status" data-gift-status="${g.id}">
            ${Object.entries(GIFT_STATUS).map(([k,lab]) => `<option value="${k}" ${g.status===k?'selected':''}>${lab}</option>`).join('')}
          </select>
          <button class="veh-entry-del" data-gift-del="${g.id}" title="Supprimer">&times;</button>
        </div>`).join('') : '<div class="empty-side">Aucune id\u00e9e pour l\u2019instant.</div>'}
    `;
    bindGiftEvents(p);
  }

  function bindGiftEvents(p){
    [['gpName','name'],['gpRelation','relation'],['gpLikes','likes']].forEach(pair => {
      const el = document.getElementById(pair[0]);
      if(el) el.addEventListener('input', () => { p[pair[1]] = el.value; save(); renderPersonSidebar(); });
    });
    const bd = document.getElementById('gpBirthday');
    if(bd) bd.addEventListener('change', () => { p.birthday = bd.value; save(); renderPersonSidebar(); renderGiftMain(); applyEditLock(); });

    const priceEl = document.getElementById('gfNewPrice');
    if(priceEl) ['focus','click'].forEach(ev => priceEl.addEventListener(ev, () => openNumPad(priceEl)));

    const addBtn = document.getElementById('btnGiftAdd');
    const addGift = () => {
      const label = document.getElementById('gfNewLabel').value.trim();
      if(!label) return;
      p.gifts = p.gifts || [];
      p.gifts.push({ id: uid(), label,
        price: (document.getElementById('gfNewPrice').value||'').replace(',','.'),
        note: document.getElementById('gfNewNote').value.trim(), status: 'idea' });
      save(); renderPersonSidebar(); renderGiftMain(); applyEditLock();
      toast('Id\u00e9e ajout\u00e9e \u2713');
    };
    if(addBtn) addBtn.addEventListener('click', addGift);
    ['gfNewLabel','gfNewNote'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); addGift(); } });
    });

    document.querySelectorAll('[data-gift-status]').forEach(sel => sel.addEventListener('change', () => {
      const g = (p.gifts||[]).find(x => x.id === sel.dataset.giftStatus);
      if(g){ g.status = sel.value; save(); renderPersonSidebar(); renderGiftMain(); applyEditLock(); }
    }));
    document.querySelectorAll('[data-gift-del]').forEach(btn => btn.addEventListener('click', () => {
      p.gifts = (p.gifts||[]).filter(g => g.id !== btn.dataset.giftDel);
      save(); renderPersonSidebar(); renderGiftMain(); applyEditLock();
    }));

    bindConfirmDeleteButton(document.getElementById('btnDeletePerson'), () => {
      trashPut('people', p.name, p);
      state.people = state.people.filter(x => x.id !== p.id);
      selectedPersonId = state.people[0]?.id ?? null;
      save(); render();
      toast('Proche supprim\u00e9');
    });
  }

  // ---------- releves de cotes avec croquis ----------
  // Gabarits de relev\u00e9 pr\u00eats \u00e0 annoter (dessin technique vectoriel)
  const SURVEY_TEMPLATES = [
    { key:"niche", label:"Niche / placard", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Niche / placard \u2014 \u00e9l\u00e9vation</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Relever les largeurs en haut ET en bas, les hauteurs \u00e0 gauche ET \u00e0 droite : les murs sont rarement d\u2019\u00e9querre.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><rect x=\"120\" y=\"120\" width=\"45\" height=\"420\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"715\" y=\"120\" width=\"45\" height=\"420\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"120\" y=\"120\" width=\"640\" height=\"40\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"165\" y=\"160\" width=\"550\" height=\"380\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><line x1=\"120\" y1=\"540\" x2=\"880\" y2=\"540\" stroke=\"#1B2A4A\" stroke-width=\"3\"/><text x=\"790\" y=\"535\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Sol fini</text><line x1=\"165\" y1=\"195\" x2=\"715\" y2=\"195\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"165\" y1=\"188\" x2=\"165\" y2=\"202\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"715\" y1=\"188\" x2=\"715\" y2=\"202\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"440.0\" cy=\"195\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"440.0\" y=\"199.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"440.0\" y=\"225\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur en haut</text><line x1=\"165\" y1=\"505\" x2=\"715\" y2=\"505\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"165\" y1=\"498\" x2=\"165\" y2=\"512\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"715\" y1=\"498\" x2=\"715\" y2=\"512\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"440.0\" cy=\"505\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"440.0\" y=\"509.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"440.0\" y=\"535\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur en bas</text><line x1=\"215\" y1=\"160\" x2=\"215\" y2=\"540\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"208\" y1=\"160\" x2=\"222\" y2=\"160\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"208\" y1=\"540\" x2=\"222\" y2=\"540\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"215\" cy=\"350.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"215\" y=\"354.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"193\" y=\"354.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">hauteur gauche</text><line x1=\"665\" y1=\"160\" x2=\"665\" y2=\"540\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"658\" y1=\"160\" x2=\"672\" y2=\"160\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"658\" y1=\"540\" x2=\"672\" y2=\"540\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"665\" cy=\"350.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"665\" y=\"354.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">D</text><text x=\"643\" y=\"354.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">hauteur droite</text><line x1=\"165\" y1=\"600\" x2=\"715\" y2=\"600\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"165\" y1=\"593\" x2=\"165\" y2=\"607\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"715\" y1=\"593\" x2=\"715\" y2=\"607\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"440.0\" cy=\"600\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"440.0\" y=\"604.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">E</text><text x=\"440.0\" y=\"630\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur au milieu</text><text x=\"120\" y=\"600\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">F \u2014 profondeur de la niche      G \u2014 \u00e9cart de niveau du sol      H \u2014 faux-aplomb des murs</text><text x=\"120\" y=\"625\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">V\u00e9rifier les diagonales pour contr\u00f4ler l\u2019\u00e9querrage.</text></svg>" },
    { key:"porte", label:"Porte", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Porte \u2014 tableau et passage libre</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Mesurer le passage libre entre les tableaux, et l\u2019\u00e9paisseur totale de la cloison finie.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><rect x=\"160\" y=\"120\" width=\"55\" height=\"420\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"675\" y=\"120\" width=\"55\" height=\"420\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"160\" y=\"120\" width=\"570\" height=\"45\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"215\" y=\"165\" width=\"460\" height=\"375\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><line x1=\"120\" y1=\"540\" x2=\"880\" y2=\"540\" stroke=\"#1B2A4A\" stroke-width=\"3\"/><path d=\"M215 540 L215 165\" stroke=\"#B8912A\" stroke-width=\"2.5\" stroke-dasharray=\"7 5\"/><path d=\"M215 165 A 460 460 0 0 1 675 540\" fill=\"none\" stroke=\"#D8D3C4\" stroke-width=\"1.4\" stroke-dasharray=\"5 5\"/><text x=\"430\" y=\"360\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">sens d\u2019ouverture</text><line x1=\"215\" y1=\"200\" x2=\"675\" y2=\"200\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"215\" y1=\"193\" x2=\"215\" y2=\"207\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"675\" y1=\"193\" x2=\"675\" y2=\"207\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"445.0\" cy=\"200\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"445.0\" y=\"204.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"445.0\" y=\"230\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">passage libre</text><line x1=\"265\" y1=\"165\" x2=\"265\" y2=\"540\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"258\" y1=\"165\" x2=\"272\" y2=\"165\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"258\" y1=\"540\" x2=\"272\" y2=\"540\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"265\" cy=\"352.5\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"265\" y=\"357.0\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"243\" y=\"356.5\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">hauteur de passage</text><line x1=\"160\" y1=\"610\" x2=\"730\" y2=\"610\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"160\" y1=\"603\" x2=\"160\" y2=\"617\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"730\" y1=\"603\" x2=\"730\" y2=\"617\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"445.0\" cy=\"610\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"445.0\" y=\"614.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"445.0\" y=\"640\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur hors tout du tableau</text><text x=\"760\" y=\"200\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">D \u2014 \u00e9paisseur de cloison</text><text x=\"760\" y=\"225\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">E \u2014 feuillure</text><text x=\"760\" y=\"250\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">F \u2014 jeu sous porte</text><text x=\"120\" y=\"655\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Noter le sens d\u2019ouverture (poussant droit / gauche) et le type de b\u00e2ti.</text></svg>" },
    { key:"fenetre", label:"Fen\u00eatre", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Fen\u00eatre \u2014 tableau, all\u00e8ge et appui</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Relever le tableau au plus \u00e9troit. Contr\u00f4ler l\u2019aplomb et la pente de l\u2019appui.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><rect x=\"150\" y=\"110\" width=\"55\" height=\"470\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"700\" y=\"110\" width=\"55\" height=\"470\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"150\" y=\"110\" width=\"605\" height=\"45\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"205\" y=\"155\" width=\"495\" height=\"300\" fill=\"#F4F8FA\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><line x1=\"452\" y1=\"155\" x2=\"452\" y2=\"455\" stroke=\"#1B2A4A\" stroke-width=\"1.6\"/><path d=\"M205 455 L755 470 L150 470 Z\" fill=\"none\"/><rect x=\"150\" y=\"455\" width=\"605\" height=\"18\" fill=\"#EFEBE0\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><text x=\"770\" y=\"468\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Appui</text><line x1=\"120\" y1=\"580\" x2=\"880\" y2=\"580\" stroke=\"#1B2A4A\" stroke-width=\"3\"/><text x=\"790\" y=\"575\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Sol fini</text><line x1=\"205\" y1=\"190\" x2=\"700\" y2=\"190\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"205\" y1=\"183\" x2=\"205\" y2=\"197\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"700\" y1=\"183\" x2=\"700\" y2=\"197\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"452.5\" cy=\"190\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"452.5\" y=\"194.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"452.5\" y=\"220\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur de tableau</text><line x1=\"255\" y1=\"155\" x2=\"255\" y2=\"455\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"248\" y1=\"155\" x2=\"262\" y2=\"155\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"248\" y1=\"455\" x2=\"262\" y2=\"455\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"255\" cy=\"305.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"255\" y=\"309.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"233\" y=\"309.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">hauteur de tableau</text><line x1=\"255\" y1=\"473\" x2=\"255\" y2=\"580\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"248\" y1=\"473\" x2=\"262\" y2=\"473\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"248\" y1=\"580\" x2=\"262\" y2=\"580\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"255\" cy=\"526.5\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"255\" y=\"531.0\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"233\" y=\"530.5\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">all\u00e8ge</text><line x1=\"150\" y1=\"620\" x2=\"755\" y2=\"620\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"150\" y1=\"613\" x2=\"150\" y2=\"627\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"755\" y1=\"613\" x2=\"755\" y2=\"627\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"452.5\" cy=\"620\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"452.5\" y=\"624.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">D</text><text x=\"452.5\" y=\"650\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur hors tout</text><text x=\"120\" y=\"665\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">E \u2014 profondeur du tableau      F \u2014 d\u00e9bord d\u2019appui      G \u2014 pente d\u2019appui</text></svg>" },
    { key:"escalier", label:"Escalier", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Escalier \u2014 hauteur, reculement et \u00e9chapp\u00e9e</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">La hauteur \u00e0 monter se mesure de sol fini \u00e0 sol fini. Contr\u00f4ler l\u2019\u00e9chapp\u00e9e sous plafond.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><line x1=\"130\" y1=\"560\" x2=\"880\" y2=\"560\" stroke=\"#1B2A4A\" stroke-width=\"3\"/><text x=\"120\" y=\"585\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Sol fini bas</text><line x1=\"600\" y1=\"180\" x2=\"880\" y2=\"180\" stroke=\"#1B2A4A\" stroke-width=\"3\"/><text x=\"790\" y=\"172\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Sol fini haut</text><rect x=\"600\" y=\"180\" width=\"280\" height=\"25\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><path d=\"M180 560 L180 512 L272 512 L272 464 L364 464 L364 416 L456 416 L456 368 L548 368 L548 320 L640 320 L640 272 L732 272 L732 224 L824 224 L824 180\" fill=\"none\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><line x1=\"180\" y1=\"560\" x2=\"824\" y2=\"180\" stroke=\"#B8912A\" stroke-width=\"1.6\" stroke-dasharray=\"8 5\"/><text x=\"430\" y=\"400\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">ligne de foul\u00e9e</text><line x1=\"130\" y1=\"110\" x2=\"880\" y2=\"110\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><text x=\"140\" y=\"100\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Plafond</text><line x1=\"140\" y1=\"180\" x2=\"140\" y2=\"560\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"133\" y1=\"180\" x2=\"147\" y2=\"180\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"133\" y1=\"560\" x2=\"147\" y2=\"560\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"140\" cy=\"370.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"140\" y=\"374.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"162\" y=\"374.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"start\">hauteur \u00e0 monter</text><line x1=\"180\" y1=\"620\" x2=\"824\" y2=\"620\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"180\" y1=\"613\" x2=\"180\" y2=\"627\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"824\" y1=\"613\" x2=\"824\" y2=\"627\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"502.0\" cy=\"620\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"502.0\" y=\"624.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"502.0\" y=\"650\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">reculement</text><line x1=\"560\" y1=\"110\" x2=\"560\" y2=\"320\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"553\" y1=\"110\" x2=\"567\" y2=\"110\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"553\" y1=\"320\" x2=\"567\" y2=\"320\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"560\" cy=\"215.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"560\" y=\"219.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"538\" y=\"219.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">\u00e9chapp\u00e9e</text><text x=\"120\" y=\"655\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">D \u2014 largeur d\u2019emmarchement      E \u2014 hauteur de marche      F \u2014 giron      G \u2014 nombre de marches</text></svg>" },
    { key:"plandetravail", label:"Plan de travail", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Plan de travail \u2014 vue de dessus</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Relever mur par mur. Positionner les d\u00e9coupes depuis un angle de r\u00e9f\u00e9rence.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><rect x=\"120\" y=\"130\" width=\"700\" height=\"30\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"120\" y=\"130\" width=\"30\" height=\"380\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"150\" y=\"160\" width=\"670\" height=\"230\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><rect x=\"270\" y=\"200\" width=\"150\" height=\"120\" rx=\"6\" fill=\"#EAF0F3\" stroke=\"#1B2A4A\" stroke-width=\"1.8\"/><text x=\"300\" y=\"265\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">\u00c9vier</text><rect x=\"520\" y=\"205\" width=\"130\" height=\"110\" rx=\"4\" fill=\"#F2EDE2\" stroke=\"#1B2A4A\" stroke-width=\"1.8\"/><text x=\"545\" y=\"265\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">Plaque</text><line x1=\"150\" y1=\"130\" x2=\"820\" y2=\"130\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"150\" y1=\"123\" x2=\"150\" y2=\"137\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"820\" y1=\"123\" x2=\"820\" y2=\"137\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"485.0\" cy=\"130\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"485.0\" y=\"134.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"485.0\" y=\"160\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">longueur totale</text><line x1=\"190\" y1=\"160\" x2=\"190\" y2=\"390\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"183\" y1=\"160\" x2=\"197\" y2=\"160\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"183\" y1=\"390\" x2=\"197\" y2=\"390\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"190\" cy=\"275.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"190\" y=\"279.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"168\" y=\"279.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">profondeur</text><line x1=\"150\" y1=\"440\" x2=\"270\" y2=\"440\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"150\" y1=\"433\" x2=\"150\" y2=\"447\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"270\" y1=\"433\" x2=\"270\" y2=\"447\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"210.0\" cy=\"440\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"210.0\" y=\"444.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"210.0\" y=\"470\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">axe \u00e9vier depuis le mur</text><line x1=\"150\" y1=\"480\" x2=\"520\" y2=\"480\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"150\" y1=\"473\" x2=\"150\" y2=\"487\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"520\" y1=\"473\" x2=\"520\" y2=\"487\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"335.0\" cy=\"480\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"335.0\" y=\"484.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">D</text><text x=\"335.0\" y=\"510\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">axe plaque depuis le mur</text><text x=\"120\" y=\"560\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">E \u2014 largeur d\u00e9coupe \u00e9vier        F \u2014 profondeur d\u00e9coupe \u00e9vier</text><text x=\"120\" y=\"585\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">G \u2014 largeur d\u00e9coupe plaque       H \u2014 profondeur d\u00e9coupe plaque</text><text x=\"120\" y=\"610\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">I \u2014 \u00e9paisseur du plan            J \u2014 d\u00e9bord sur fa\u00e7ade</text><text x=\"120\" y=\"645\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Contr\u00f4ler l\u2019\u00e9querrage de l\u2019angle et le faux-aplomb du mur du fond.</text></svg>" },
    { key:"caisson", label:"Caisson / meuble", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Caisson \u2014 \u00e9l\u00e9vation et coupe</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Cotes hors tout et cotes int\u00e9rieures. Pr\u00e9ciser l\u2019\u00e9paisseur des panneaux.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><text x=\"150\" y=\"105\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">\u00c9L\u00c9VATION</text><rect x=\"150\" y=\"120\" width=\"330\" height=\"400\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><line x1=\"150\" y1=\"255\" x2=\"480\" y2=\"255\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><line x1=\"150\" y1=\"390\" x2=\"480\" y2=\"390\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><line x1=\"315\" y1=\"120\" x2=\"315\" y2=\"255\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><text x=\"600\" y=\"105\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">COUPE</text><rect x=\"600\" y=\"120\" width=\"200\" height=\"400\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><line x1=\"600\" y1=\"255\" x2=\"800\" y2=\"255\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><line x1=\"600\" y1=\"390\" x2=\"800\" y2=\"390\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><rect x=\"790\" y=\"120\" width=\"10\" height=\"400\" fill=\"#D8D3C4\"/><text x=\"812\" y=\"330\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">fond</text><line x1=\"150\" y1=\"555\" x2=\"480\" y2=\"555\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"150\" y1=\"548\" x2=\"150\" y2=\"562\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"480\" y1=\"548\" x2=\"480\" y2=\"562\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"315.0\" cy=\"555\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"315.0\" y=\"559.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"315.0\" y=\"585\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">largeur hors tout</text><line x1=\"115\" y1=\"120\" x2=\"115\" y2=\"520\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"108\" y1=\"120\" x2=\"122\" y2=\"120\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"108\" y1=\"520\" x2=\"122\" y2=\"520\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"115\" cy=\"320.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"115\" y=\"324.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"93\" y=\"324.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">hauteur hors tout</text><line x1=\"600\" y1=\"555\" x2=\"800\" y2=\"555\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"600\" y1=\"548\" x2=\"600\" y2=\"562\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"800\" y1=\"548\" x2=\"800\" y2=\"562\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"700.0\" cy=\"555\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"700.0\" y=\"559.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"700.0\" y=\"585\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">profondeur</text><line x1=\"520\" y1=\"255\" x2=\"520\" y2=\"390\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"513\" y1=\"255\" x2=\"527\" y2=\"255\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"513\" y1=\"390\" x2=\"527\" y2=\"390\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"520\" cy=\"322.5\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"520\" y=\"327.0\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">D</text><text x=\"542\" y=\"326.5\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"start\">hauteur d\u2019\u00e9tag\u00e8re</text><text x=\"120\" y=\"620\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">E \u2014 \u00e9paisseur panneaux      F \u2014 retrait de socle      G \u2014 jeu de fa\u00e7ade      H \u2014 entraxe \u00e9tag\u00e8res</text></svg>" },
    { key:"piece", label:"Pi\u00e8ce (plan au sol)", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Pi\u00e8ce \u2014 plan au sol</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Relever les 4 murs ET les 2 diagonales : c\u2019est le seul moyen de v\u00e9rifier l\u2019\u00e9querrage.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><path d=\"M170 150 L820 165 L810 520 L160 505 Z\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><line x1=\"170\" y1=\"150\" x2=\"810\" y2=\"520\" stroke=\"#B8912A\" stroke-width=\"1.4\" stroke-dasharray=\"8 5\"/><line x1=\"820\" y1=\"165\" x2=\"160\" y2=\"505\" stroke=\"#B8912A\" stroke-width=\"1.4\" stroke-dasharray=\"8 5\"/><rect x=\"380\" y=\"143\" width=\"150\" height=\"14\" fill=\"#fff\" stroke=\"#1B2A4A\" stroke-width=\"1.8\"/><text x=\"400\" y=\"133\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\">porte</text><line x1=\"170\" y1=\"110\" x2=\"820\" y2=\"110\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"170\" y1=\"103\" x2=\"170\" y2=\"117\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"820\" y1=\"103\" x2=\"820\" y2=\"117\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"495.0\" cy=\"110\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"495.0\" y=\"114.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"495.0\" y=\"140\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">mur nord</text><line x1=\"160\" y1=\"570\" x2=\"810\" y2=\"570\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"160\" y1=\"563\" x2=\"160\" y2=\"577\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"810\" y1=\"563\" x2=\"810\" y2=\"577\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"485.0\" cy=\"570\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"485.0\" y=\"574.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"485.0\" y=\"600\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">mur sud</text><line x1=\"125\" y1=\"150\" x2=\"125\" y2=\"505\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"118\" y1=\"150\" x2=\"132\" y2=\"150\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"118\" y1=\"505\" x2=\"132\" y2=\"505\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"125\" cy=\"327.5\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"125\" y=\"332.0\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">C</text><text x=\"147\" y=\"331.5\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"start\">mur ouest</text><line x1=\"862\" y1=\"165\" x2=\"862\" y2=\"520\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"855\" y1=\"165\" x2=\"869\" y2=\"165\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"855\" y1=\"520\" x2=\"869\" y2=\"520\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"862\" cy=\"342.5\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"862\" y=\"347.0\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">D</text><text x=\"840\" y=\"346.5\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"end\">mur est</text><text x=\"500\" y=\"300\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">E \u2014 diagonale</text><text x=\"300\" y=\"380\" font-family=\"Helvetica,sans-serif\" font-size=\"12\" fill=\"#8A8578\">F \u2014 diagonale</text><text x=\"120\" y=\"630\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">G \u2014 largeur de passage de porte      H \u2014 hauteur sous plafond      I \u2014 \u00e9cart de niveau du sol</text><text x=\"120\" y=\"658\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Si E \u2260 F, la pi\u00e8ce n\u2019est pas d\u2019\u00e9querre : reporter l\u2019\u00e9cart sur le calepinage.</text></svg>" },
    { key:"terrasse", label:"Terrasse", svg:"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1000\" height=\"700\" viewBox=\"0 0 1000 700\"><defs><marker id=\"a\" markerWidth=\"9\" markerHeight=\"9\" refX=\"8\" refY=\"3\" orient=\"auto\"><path d=\"M0,0 L8,3 L0,6 z\" fill=\"#8A8578\"/></marker><marker id=\"b\" markerWidth=\"9\" markerHeight=\"9\" refX=\"1\" refY=\"3\" orient=\"auto\"><path d=\"M8,0 L0,3 L8,6 z\" fill=\"#8A8578\"/></marker><pattern id=\"g\" width=\"25\" height=\"25\" patternUnits=\"userSpaceOnUse\"><path d=\"M25 0 L0 0 0 25\" fill=\"none\" stroke=\"#EDE9DC\" stroke-width=\"1\"/></pattern><pattern id=\"hatch\" width=\"9\" height=\"9\" patternUnits=\"userSpaceOnUse\" patternTransform=\"rotate(45)\"><line x1=\"0\" y1=\"0\" x2=\"0\" y2=\"9\" stroke=\"#D8D3C4\" stroke-width=\"1.4\"/></pattern></defs><rect width=\"1000\" height=\"700\" fill=\"#fff\"/><rect width=\"1000\" height=\"700\" fill=\"url(#g)\"/><text x=\"30\" y=\"42\" font-family=\"Georgia,serif\" font-size=\"21\" font-weight=\"bold\" fill=\"#1B2A4A\">Terrasse \u2014 plan de calepinage</text><text x=\"30\" y=\"63\" font-family=\"Helvetica,sans-serif\" font-size=\"12.5\" fill=\"#8A8578\">Sens de pose des lames, entraxe des lambourdes et pente d\u2019\u00e9vacuation.</text><line x1=\"30\" y1=\"75\" x2=\"970\" y2=\"75\" stroke=\"#B8912A\" stroke-width=\"1.5\"/><rect x=\"120\" y=\"130\" width=\"30\" height=\"380\" fill=\"url(#hatch)\" stroke=\"#1B2A4A\" stroke-width=\"2\"/><text x=\"120\" y=\"528\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">Fa\u00e7ade</text><rect x=\"150\" y=\"130\" width=\"670\" height=\"380\" fill=\"#FBFAF5\" stroke=\"#1B2A4A\" stroke-width=\"2.5\"/><line x1=\"197\" y1=\"130\" x2=\"197\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"244\" y1=\"130\" x2=\"244\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"291\" y1=\"130\" x2=\"291\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"338\" y1=\"130\" x2=\"338\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"385\" y1=\"130\" x2=\"385\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"432\" y1=\"130\" x2=\"432\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"479\" y1=\"130\" x2=\"479\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"526\" y1=\"130\" x2=\"526\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"573\" y1=\"130\" x2=\"573\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"620\" y1=\"130\" x2=\"620\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"667\" y1=\"130\" x2=\"667\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"714\" y1=\"130\" x2=\"714\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"761\" y1=\"130\" x2=\"761\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"808\" y1=\"130\" x2=\"808\" y2=\"510\" stroke=\"#D8D3C4\" stroke-width=\"1.2\"/><line x1=\"150\" y1=\"193\" x2=\"820\" y2=\"193\" stroke=\"#1B2A4A\" stroke-width=\"1.6\" stroke-dasharray=\"4 4\"/><line x1=\"150\" y1=\"256\" x2=\"820\" y2=\"256\" stroke=\"#1B2A4A\" stroke-width=\"1.6\" stroke-dasharray=\"4 4\"/><line x1=\"150\" y1=\"319\" x2=\"820\" y2=\"319\" stroke=\"#1B2A4A\" stroke-width=\"1.6\" stroke-dasharray=\"4 4\"/><line x1=\"150\" y1=\"382\" x2=\"820\" y2=\"382\" stroke=\"#1B2A4A\" stroke-width=\"1.6\" stroke-dasharray=\"4 4\"/><line x1=\"150\" y1=\"445\" x2=\"820\" y2=\"445\" stroke=\"#1B2A4A\" stroke-width=\"1.6\" stroke-dasharray=\"4 4\"/><text x=\"600\" y=\"100\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\">lames</text><text x=\"838\" y=\"260\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\">lambourdes</text><path d=\"M180 545 L280 545\" stroke=\"#B8912A\" stroke-width=\"2\" marker-end=\"url(#a)\"/><text x=\"290\" y=\"549\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">pente 1 % vers l\u2019ext\u00e9rieur</text><line x1=\"150\" y1=\"110\" x2=\"820\" y2=\"110\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"150\" y1=\"103\" x2=\"150\" y2=\"117\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"820\" y1=\"103\" x2=\"820\" y2=\"117\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"485.0\" cy=\"110\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"485.0\" y=\"114.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">A</text><text x=\"485.0\" y=\"140\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"middle\">longueur</text><line x1=\"120\" y1=\"130\" x2=\"120\" y2=\"510\" stroke=\"#8A8578\" stroke-width=\"1.2\" marker-start=\"url(#b)\" marker-end=\"url(#a)\"/><line x1=\"113\" y1=\"130\" x2=\"127\" y2=\"130\" stroke=\"#8A8578\" stroke-width=\"1\"/><line x1=\"113\" y1=\"510\" x2=\"127\" y2=\"510\" stroke=\"#8A8578\" stroke-width=\"1\"/><circle cx=\"120\" cy=\"320.0\" r=\"12.5\" fill=\"#fff\" stroke=\"#B8912A\" stroke-width=\"1.6\"/><text x=\"120\" y=\"324.5\" font-family=\"Helvetica,sans-serif\" font-size=\"13\" font-weight=\"bold\" fill=\"#B8912A\" text-anchor=\"middle\">B</text><text x=\"142\" y=\"324.0\" font-family=\"Helvetica,sans-serif\" font-size=\"11\" fill=\"#8A8578\" text-anchor=\"start\">largeur</text><text x=\"120\" y=\"600\" font-family=\"Helvetica,sans-serif\" font-size=\"11.5\" fill=\"#8A8578\">C \u2014 entraxe lambourdes      D \u2014 largeur de lame      E \u2014 jeu entre lames      F \u2014 hauteur sur plots</text></svg>" }
  ];
  function templateDataUrl(svg){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }


  let sketchCtx = null, sketchDrawing = false, sketchTool = 'pen', sketchColor = '#1B2A4A';
  const SKETCH_W = 1000, SKETCH_H = 700;

  function getSurvey(id){ return state.surveys.find(s => s.id === id) || null; }

  function renderSurveySidebar(){
    renderListSidebar({
      listElId: 'surveyList', searchElId: 'surveySearchInput', dataAttr: 'survey',
      items: state.surveys, selectedId: selectedSurveyId,
      sortFn: (a,b) => new Date(b.date||0) - new Date(a.date||0),
      matchQuery: (s, q) => (s.title||'').toLowerCase().includes(q) || (s.location||'').toLowerCase().includes(q) || (s.client||'').toLowerCase().includes(q),
      emptyMessage: '<div class="empty-side">Aucun relev\u00e9. Cr\u00e9es-en un pour noter tes cotes et dessiner un croquis sur place.</div>',
      noMatchMessage: () => '<div class="empty-side">Aucun relev\u00e9 ne correspond.</div>',
      itemHtml: s => `
        <div class="name">${esc(s.title||'(sans titre)')}</div>
        <div class="meta">${esc([s.client, s.location].filter(Boolean).join(' \u00b7 '))}</div>
        <div class="meta">${(s.measures||[]).length} cote${(s.measures||[]).length!==1?'s':''}${s.sketch ? ' \u00b7 croquis' : ''}</div>`
    });
  }

  function renderSurveyMain(){
    const main = document.getElementById('surveyMainArea');
    if(!main) return;
    const s = getSurvey(selectedSurveyId);
    if(!s){
      main.innerHTML = `
        <div class="empty-main">
          <h2>Aucun relev\u00e9 s\u00e9lectionn\u00e9</h2>
          <p>Note tes cotes sur place et dessine un croquis au doigt. Rattache le relev\u00e9 \u00e0 un dossier pour le retrouver avec le reste du chantier.</p>
        </div>`;
      return;
    }
    const measures = s.measures || [];
    main.innerHTML = `
      <div class="sheet-toolbar">
        <div><div class="section-label" style="margin-bottom:0;"><span>Relev\u00e9 de cotes</span></div></div>
        <div class="sheet-toolbar-actions">
          ${folderLinkControl('surveys', s.id)}
          <button class="btn btn-gold" id="btnPrintSurvey">\ud83d\udcc4 PDF</button>
          <button class="btn btn-danger" id="btnDeleteSurvey">Supprimer</button>
        </div>
      </div>

      <div class="sheet-header-form">
        <div class="field full"><label>Titre</label><input type="text" id="svTitle" value="${esc(s.title||'')}" placeholder="ex. Placard chambre parentale"></div>
        <div class="field"><label>Client</label><input type="text" id="svClient" value="${esc(s.client||'')}" placeholder="ex. M. Durand"></div>
        <div class="field"><label>Lieu / pi\u00e8ce</label><input type="text" id="svLocation" value="${esc(s.location||'')}" placeholder="ex. \u00c9tage, chambre nord"></div>
        <div class="field"><label>Date</label><input type="date" id="svDate" value="${(s.date||'').slice(0,10)}"></div>
      </div>

      <div class="dash-section-title">Croquis</div>
      <div class="sketch-tools no-lock">
        <button class="btn btn-line sketch-tool active" data-sketch-tool="pen">\u270f\ufe0f Crayon</button>
        <button class="btn btn-line sketch-tool" data-sketch-tool="eraser">\u25fb Gomme</button>
        <span class="sketch-colors">
          <button class="sketch-color active" data-sketch-color="#1B2A4A" style="background:#1B2A4A;"></button>
          <button class="sketch-color" data-sketch-color="#A63D2F" style="background:#A63D2F;"></button>
          <button class="sketch-color" data-sketch-color="#5F7455" style="background:#5F7455;"></button>
          <button class="sketch-color" data-sketch-color="#B8912A" style="background:#B8912A;"></button>
        </span>
        <button class="btn btn-line" id="btnSketchTemplate">\ud83d\udcd0 Gabarit</button>
        <label class="btn btn-line" style="cursor:pointer;">\ud83d\uddbc\ufe0f Photo de fond
          <input type="file" id="svBgInput" accept="image/*" style="display:none;">
        </label>
        <button class="btn btn-line" id="btnSketchClear">\u21ba Effacer</button>
      </div>
      <div class="sketch-wrap">
        <canvas id="sketchCanvas" width="${SKETCH_W}" height="${SKETCH_H}"></canvas>
      </div>

      <div class="dash-section-title">Cotes <span class="dash-count-badge">${measures.length}</span></div>
      <table class="sv-table">
        <thead><tr><th>Rep\u00e8re</th><th>Description</th><th class="num">Valeur</th><th>Unit\u00e9</th><th class="col-actions"></th></tr></thead>
        <tbody>
          ${measures.map(m => `
            <tr>
              <td><input type="text" data-sv-field="ref" data-sv-id="${m.id}" value="${esc(m.ref||'')}" placeholder="A"></td>
              <td><input type="text" data-sv-field="label" data-sv-id="${m.id}" value="${esc(m.label||'')}" placeholder="Largeur niche"></td>
              <td class="num"><input type="text" data-sv-field="value" data-sv-id="${m.id}" value="${esc(m.value||'')}" placeholder="1240" inputmode="none"></td>
              <td><input type="text" data-sv-field="unit" data-sv-id="${m.id}" value="${esc(m.unit||'mm')}" placeholder="mm"></td>
              <td class="col-actions"><button class="sv-del" data-sv-del="${m.id}" title="Supprimer">&times;</button></td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center; color:var(--text-dim); font-size:12.5px; padding:14px;">Aucune cote enregistr\u00e9e.</td></tr>'}
        </tbody>
      </table>
      <button class="btn btn-line add-row-btn" id="btnSvAddMeasure" style="margin-top:8px;">+ Ajouter une cote</button>

      <div class="dash-section-title">Observations</div>
      <textarea id="svNotes" placeholder="Sol non de niveau, pr\u00e9voir compensation\u2026"
        style="width:100%; min-height:110px; border:1px solid var(--line); border-radius:6px; padding:12px; font-family:'IBM Plex Sans'; font-size:14px; line-height:1.6; background:var(--paper-raised); color:var(--ink); resize:vertical;">${esc(s.notes||'')}</textarea>
    `;
    bindSurveyEvents(s);
    initSketch(s);
  }

  function initSketch(s){
    const cv = document.getElementById('sketchCanvas');
    if(!cv) return;
    const ctx = cv.getContext('2d');
    sketchCtx = ctx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, SKETCH_W, SKETCH_H);
    // Papier quadrille : aide au trace a main levee
    ctx.strokeStyle = '#e8e4d8'; ctx.lineWidth = 1;
    for(let x = 0; x <= SKETCH_W; x += 25){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,SKETCH_H); ctx.stroke(); }
    for(let y = 0; y <= SKETCH_H; y += 25){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(SKETCH_W,y); ctx.stroke(); }

    const draw = () => {
      if(s.sketch){
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, SKETCH_W, SKETCH_H);
        img.src = s.sketch;
      }
    };
    if(s.bg){
      getPhotoDataUrl(s.bg).then(url => {
        const bg = new Image();
        bg.onload = () => { ctx.drawImage(bg, 0, 0, SKETCH_W, SKETCH_H); draw(); };
        bg.src = url;
      });
    } else draw();

    const pos = e => {
      const r = cv.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: (t.clientX - r.left) * (SKETCH_W / r.width), y: (t.clientY - r.top) * (SKETCH_H / r.height) };
    };
    const start = e => {
      if(document.getElementById('surveyMainArea').classList.contains('view-locked')) return;
      e.preventDefault(); sketchDrawing = true;
      const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
    };
    const move = e => {
      if(!sketchDrawing) return;
      e.preventDefault();
      const p = pos(e);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if(sketchTool === 'eraser'){ ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 26; }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = sketchColor; ctx.lineWidth = 3; }
      ctx.lineTo(p.x, p.y); ctx.stroke();
    };
    const end = () => {
      if(!sketchDrawing) return;
      sketchDrawing = false;
      ctx.globalCompositeOperation = 'source-over';
      s.sketch = cv.toDataURL('image/png');
      save();
      renderSurveySidebar();
    };
    ['mousedown','touchstart'].forEach(ev => cv.addEventListener(ev, start, { passive:false }));
    ['mousemove','touchmove'].forEach(ev => cv.addEventListener(ev, move, { passive:false }));
    ['mouseup','mouseleave','touchend','touchcancel'].forEach(ev => cv.addEventListener(ev, end));
  }

  function bindSurveyEvents(s){
    [['svTitle','title'],['svClient','client'],['svLocation','location'],['svNotes','notes']].forEach(pair => {
      const el = document.getElementById(pair[0]);
      if(el) el.addEventListener('input', () => { s[pair[1]] = el.value; save(); renderSurveySidebar(); });
    });
    const dateEl = document.getElementById('svDate');
    if(dateEl) dateEl.addEventListener('change', () => { s.date = dateEl.value; save(); renderSurveySidebar(); });

    document.querySelectorAll('.sketch-tool').forEach(btn => btn.addEventListener('click', () => {
      sketchTool = btn.dataset.sketchTool;
      document.querySelectorAll('.sketch-tool').forEach(b => b.classList.toggle('active', b === btn));
    }));
    document.querySelectorAll('.sketch-color').forEach(btn => btn.addEventListener('click', () => {
      sketchColor = btn.dataset.sketchColor; sketchTool = 'pen';
      document.querySelectorAll('.sketch-color').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.sketch-tool').forEach(b => b.classList.toggle('active', b.dataset.sketchTool === 'pen'));
    }));
    const clearBtn = document.getElementById('btnSketchClear');
    if(clearBtn) bindConfirmDeleteButton(clearBtn, () => {
      deletePhotoRef(s.bg);
      s.sketch = null; s.bg = null; save(); renderSurveyMain(); applyEditLock();
      toast('Croquis effac\u00e9');
    }, '\u21ba ?');
    const tplBtn = document.getElementById('btnSketchTemplate');
    if(tplBtn) tplBtn.addEventListener('click', () => openTemplatePicker(s));
    const bgInput = document.getElementById('svBgInput');
    if(bgInput) bgInput.addEventListener('change', () => {
      const f = bgInput.files && bgInput.files[0];
      if(!f) return;
      resizeImage(f, async url => { s.bg = await storePhoto(url, 'survey'); s.sketch = null; save(); renderSurveyMain(); applyEditLock(); toast('Photo de fond ajout\u00e9e \u2713'); });
    });

    document.querySelectorAll('[data-sv-field]').forEach(el => {
      if(el.dataset.svField === 'value') ['focus','click'].forEach(ev => el.addEventListener(ev, () => openNumPad(el)));
      el.addEventListener('input', () => {
        const m = (s.measures||[]).find(x => x.id === el.dataset.svId);
        if(m){ m[el.dataset.svField] = el.value; save(); }
      });
    });
    const addBtn = document.getElementById('btnSvAddMeasure');
    if(addBtn) addBtn.addEventListener('click', () => {
      s.measures = s.measures || [];
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      s.measures.push({ id: uid(), ref: letters[s.measures.length] || '', label:'', value:'', unit:'mm' });
      save(); renderSurveyMain(); applyEditLock(); renderSurveySidebar();
    });
    document.querySelectorAll('[data-sv-del]').forEach(btn => btn.addEventListener('click', () => {
      s.measures = (s.measures||[]).filter(m => m.id !== btn.dataset.svDel);
      save(); renderSurveyMain(); applyEditLock(); renderSurveySidebar();
    }));

    const pdfBtn = document.getElementById('btnPrintSurvey');
    if(pdfBtn) pdfBtn.addEventListener('click', () => openPrintWindow('Relev\u00e9 - ' + (s.title||''), buildSurveyPdfBody(s)));

    bindConfirmDeleteButton(document.getElementById('btnDeleteSurvey'), () => {
      trashPut('surveys', s.title, s);
      state.surveys = state.surveys.filter(x => x.id !== s.id);
      selectedSurveyId = state.surveys[0]?.id ?? null;
      save(); render();
      toast('Relev\u00e9 supprim\u00e9');
    });
  }

  function openTemplatePicker(survey){
    const grid = document.getElementById('templateGrid');
    grid.innerHTML = SURVEY_TEMPLATES.map(t => `
      <button class="tpl-card" data-tpl="${t.key}">
        <img src="${templateDataUrl(t.svg)}" alt="${esc(t.label)}">
        <span>${t.label}</span>
      </button>`).join('');
    grid.querySelectorAll('[data-tpl]').forEach(btn => btn.addEventListener('click', () => {
      const t = SURVEY_TEMPLATES.find(x => x.key === btn.dataset.tpl);
      if(!t) return;
      // Le gabarit devient le fond ; le croquis dessine par-dessus repart a zero
      survey.bg = templateDataUrl(t.svg);
      survey.sketch = null;
      if(!survey.title || survey.title === 'Nouveau relev\u00e9') survey.title = t.label;
      save();
      document.getElementById('templateModal').style.display = 'none';
      renderSurveySidebar(); renderSurveyMain(); applyEditLock();
      toast('Gabarit \u00ab ' + t.label + ' \u00bb appliqu\u00e9 \u2713');
    }));
    document.getElementById('templateModal').style.display = 'flex';
  }

  function buildSurveyPdfBody(s){
    const company = state.company || {};
    const measures = s.measures || [];
    const contact = [];
    if(company.phone) contact.push('T\u00e9l. ' + esc(company.phone));
    if(company.email) contact.push(esc(company.email));
    return `
  <div class="pdf-doc">
  <div class="letterhead">
    <div class="company-block">
      ${company.logo ? `<img src="${resolvePhotoSrc(company.logo)}" data-photo-ref="${esc(company.logo)}" alt="Logo">` : ''}
      <div>
        <p class="company-name">${esc(company.name || 'Mon Entreprise')}</p>
        <div class="company-meta">${company.address ? esc(company.address) + '<br>' : ''}${contact.join(' \u00b7 ')}</div>
      </div>
    </div>
    <div class="doc-title-block">
      <p class="doc-title">RELEV\u00c9 DE COTES</p>
      <div class="doc-ref">${esc(s.title || '')}</div>
      <div class="doc-date">${s.date ? fmtDate(s.date) : fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="cartouche">
    <div><span>Client</span><strong>${esc(s.client || '\u2014')}</strong></div>
    <div><span>Lieu</span><strong>${esc(s.location || '\u2014')}</strong></div>
    <div><span>Cotes</span><strong>${measures.length}</strong></div>
  </div>

  ${(s.sketch || s.bg) ? `<img src="${resolvePhotoSrc(s.sketch || s.bg)}" data-photo-ref="${esc(s.sketch || s.bg)}" style="width:100%; border:1px solid #ddd; border-radius:4px; margin:14px 0;">` : ''}

  ${measures.length ? `
  <table class="pdf-table">
    <thead><tr><th>Rep\u00e8re</th><th>Description</th><th class="num">Valeur</th><th>Unit\u00e9</th></tr></thead>
    <tbody>${measures.map(m => `<tr><td><b>${esc(m.ref||'')}</b></td><td>${esc(m.label||'')}</td><td class="num">${esc(m.value||'')}</td><td>${esc(m.unit||'')}</td></tr>`).join('')}</tbody>
  </table>` : ''}

  ${s.notes ? `<div class="pdf-note-block"><h4>Observations</h4><p>${esc(s.notes).replace(/\n/g,'<br>')}</p></div>` : ''}

  <div class="signatures">
    <div><span>Relev\u00e9 effectu\u00e9 par</span></div>
    <div><span>Validation client</span></div>
  </div>

  <footer>
    <span>${esc(s.title || '')} \u2014 ${esc(company.name || 'Mon Entreprise')}</span>
    <span>G\u00e9n\u00e9r\u00e9 le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;
  }

  // ---------- prix du carburant autour de soi ----------
  // Source : donnees officielles du ministere de l'Economie (Licence Ouverte),
  // actualisees toutes les 10 minutes. Aucune cle d'acces necessaire.
  const FUEL_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';
  const FUEL_TYPES = [
    { key:'gazole', label:'Gazole' }, { key:'sp95', label:'SP95' }, { key:'sp98', label:'SP98' },
    { key:'e10', label:'E10' }, { key:'e85', label:'E85' }, { key:'gplc', label:'GPLc' }
  ];
  let fuelStations = null, fuelBusy = false, fuelError = '', fuelOrigin = null;
  let fuelPermission = 'unknown';   // 'granted' | 'prompt' | 'denied' | 'unknown'
  let fuelPlaceLabel = '';          // ville choisie quand on n'utilise pas le GPS
  let fuelShowManual = false;
  let fuelShowRoute = false;        // recherche le long d'un trajet
  let fuelRoute = null;             // { from, to, points, km, approx }

  function fuelPrefs(){
    if(!state.settings.fuel) state.settings.fuel = { type:'gazole', radius:10, sort:'price' };
    if(!state.settings.fuel.sort) state.settings.fuel.sort = 'price';
    if(!state.settings.fuel.routeRadius) state.settings.fuel.routeRadius = 5;
    if(state.settings.fuel.nationwide === undefined) state.settings.fuel.nationwide = false;
    if(!state.settings.fuel.customRadius) state.settings.fuel.customRadius = 50;
    if(state.settings.fuel.customMode === undefined) state.settings.fuel.customMode = false;
    if(!state.settings.fuel.from) state.settings.fuel.from = '';
    if(!state.settings.fuel.to) state.settings.fuel.to = '';
    return state.settings.fuel;
  }

  // Historique du prix du carburant : a chaque recherche reussie, on garde un instantane
  // (min/max/moyenne du carburant suivi). Pas d'historique gouvernemental exploitable
  // simplement cote navigateur (voir discussion) : l'historique se construit avec l'usage.
  function captureFuelPriceSnapshot(){
    if(!fuelStations || !fuelStations.length) return;
    const prefs = fuelPrefs();
    const vals = fuelStations.map(s => s.prices[prefs.type]).filter(v => v !== null && v > 0);
    if(!vals.length) return;
    const min = Math.min(...vals), max = Math.max(...vals);
    const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
    const location = prefs.nationwide ? 'France entière'
      : fuelRoute ? `Trajet ${fuelRoute.from} → ${fuelRoute.to}`
      : fuelPlaceLabel ? fuelPlaceLabel
      : 'Autour de moi';
    state.fuelPriceHistory = state.fuelPriceHistory || [];
    state.fuelPriceHistory.push({
      id: uid(), date: new Date().toISOString(), type: prefs.type,
      min, max, avg, count: vals.length, location
    });
    // Garde un historique raisonnable, evite une croissance illimitee de l'etat sauvegarde
    if(state.fuelPriceHistory.length > 3000) state.fuelPriceHistory = state.fuelPriceHistory.slice(-3000);
    save();
  }

  // Distance a vol d'oiseau entre deux points (formule de haversine)
  function haversineKm(lat1, lon1, lat2, lon2){
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Le jeu de donnees a connu plusieurs formats : on accepte les variantes
  function stationCoords(r){
    const g = r.geom || r.geo_point_2d || r.geopoint || null;
    if(!g) return null;
    if(Array.isArray(g)) return { lat: g[0], lon: g[1] };
    if(typeof g.lat === 'number') return { lat: g.lat, lon: g.lon !== undefined ? g.lon : g.lng };
    if(g.coordinates) return { lat: g.coordinates[1], lon: g.coordinates[0] };
    return null;
  }
  function stationName(r){
    return (r.enseignes || r.nom || r.marque || r.brand || '').toString().trim()
        || (r.adresse || '').toString().trim() || 'Station';
  }
  function stationPrice(r, type){
    const v = r[type + '_prix'];
    const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
    return (typeof n === 'number' && !isNaN(n) && n > 0) ? n : null;
  }

  // Etat de l'autorisation, quand le navigateur sait nous le dire
  async function checkFuelPermission(){
    try {
      if(navigator.permissions && navigator.permissions.query){
        const st = await navigator.permissions.query({ name:'geolocation' });
        fuelPermission = st.state;
        st.onchange = () => { fuelPermission = st.state; };
      }
    } catch(e){ fuelPermission = 'unknown'; }
  }

  // Demande la position au navigateur : c'est CET appel qui declenche la
  // fenetre d'autorisation. Il doit partir d'un clic de l'utilisateur.
  function askGeolocation(){
    if(fuelBusy) return;
    // France entiere : la position n'est pas indispensable
    if(fuelPrefs().nationwide){
      if(fuelOrigin){ fetchFuelAround(fuelOrigin.lat, fuelOrigin.lon); return; }
      if(!navigator.geolocation || !window.isSecureContext){ fetchFuelAround(null, null); return; }
      navigator.geolocation.getCurrentPosition(
        pos => { fuelPermission = 'granted'; fetchFuelAround(pos.coords.latitude, pos.coords.longitude); },
        ()  => { fetchFuelAround(null, null); },   // sans position, on affiche quand meme les prix
        { enableHighAccuracy:false, timeout:8000, maximumAge:300000 }
      );
      fuelBusy = true; fuelError = ''; fuelStations = null;
      renderFuelMain();
      return;
    }
    if(!navigator.geolocation){
      fuelError = "Ton navigateur ne peut pas donner ta position. Indique plut\u00f4t ta ville.";
      fuelShowManual = true;
      renderFuelMain(); return;
    }
    // La localisation n'est autorisee que sur un site s\u00e9curis\u00e9 (https)
    if(!window.isSecureContext){
      fuelError = "La localisation n\u2019est possible que sur une adresse s\u00e9curis\u00e9e (https). Indique ta ville ci-dessous.";
      fuelShowManual = true;
      renderFuelMain(); return;
    }

    // IMPORTANT : on appelle le navigateur tout de suite, sans rien redessiner avant,
    // sinon la demande d'autorisation peut ne pas s'afficher.
    navigator.geolocation.getCurrentPosition(
      pos => {
        fuelPermission = 'granted';
        fuelPlaceLabel = '';
        fetchFuelAround(pos.coords.latitude, pos.coords.longitude);
      },
      err => {
        fuelBusy = false;
        fuelPermission = (err && err.code === 1) ? 'denied' : fuelPermission;
        fuelShowManual = true;
        fuelError = (err && err.code === 1)
          ? "Tu as refus\u00e9 la localisation. Tu peux l'autoriser dans les r\u00e9glages du navigateur, ou simplement indiquer ta ville ci-dessous."
          : "Position indisponible pour l'instant. Indique ta ville ci-dessous.";
        renderFuelMain();
      },
      { enableHighAccuracy:false, timeout:15000, maximumAge:120000 }
    );

    // On affiche l'attente juste apres avoir lance la demande
    fuelBusy = true; fuelError = ''; fuelStations = null;
    renderFuelMain();
  }

  // Recherche par nom de ville, sans GPS (adresse.data.gouv.fr, gratuit)
  async function searchFuelByPlace(query){
    if(fuelBusy || !query.trim()) return;
    fuelBusy = true; fuelError = ''; fuelStations = null;
    renderFuelMain();
    try {
      const url = 'https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(query.trim());
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if(!res.ok) throw new Error('geocode');
      const data = await res.json();
      const feat = (data.features || [])[0];
      if(!feat) throw new Error('introuvable');
      const [lon, lat] = feat.geometry.coordinates;
      fuelPlaceLabel = (feat.properties && (feat.properties.label || feat.properties.city)) || query.trim();
      await fetchFuelAround(lat, lon);
    } catch(e){
      fuelBusy = false;
      fuelError = "Impossible de trouver ce lieu. Essaie avec une ville et un code postal (ex. \u00ab Annecy 74000 \u00bb).";
      renderFuelMain();
    }
  }

  // --- Recherche le long d'un trajet ---

  async function geocodeOne(q){
    const url = 'https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(q.trim());
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if(!res.ok) throw new Error('geocode');
    const data = await res.json();
    const f = (data.features || [])[0];
    if(!f) throw new Error('introuvable');
    return { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
             label: (f.properties && (f.properties.label || f.properties.city)) || q.trim() };
  }

  // Trace routier reel ; si le service ne repond pas, on retombe sur la ligne droite
  async function routeBetween(a, b){
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=full&geometries=geojson`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 14000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if(!res.ok) throw new Error('route');
      const d = await res.json();
      const r = (d.routes || [])[0];
      if(!r || !r.geometry || !r.geometry.coordinates) throw new Error('route');
      return {
        points: r.geometry.coordinates.map(p => ({ lon:p[0], lat:p[1] })),
        km: (r.distance || 0) / 1000,
        approx: false
      };
    } catch(e){
      // Ligne droite echantillonnee : approximatif mais toujours exploitable
      const n = 60, pts = [];
      for(let i = 0; i <= n; i++){
        pts.push({ lat: a.lat + (b.lat-a.lat) * i/n, lon: a.lon + (b.lon-a.lon) * i/n });
      }
      return { points: pts, km: haversineKm(a.lat,a.lon,b.lat,b.lon), approx: true };
    }
  }

  // On allege le trace : un point tous les ~2 km suffit pour mesurer un ecart
  function thinRoute(points, stepKm){
    if(points.length <= 2) return points;
    const out = [points[0]];
    let acc = 0;
    for(let i = 1; i < points.length; i++){
      acc += haversineKm(points[i-1].lat, points[i-1].lon, points[i].lat, points[i].lon);
      if(acc >= stepKm){ out.push(points[i]); acc = 0; }
    }
    out.push(points[points.length-1]);
    return out;
  }

  function distanceToRoute(lat, lon, pts){
    let best = Infinity, idx = 0;
    for(let i = 0; i < pts.length; i++){
      const d = haversineKm(lat, lon, pts[i].lat, pts[i].lon);
      if(d < best){ best = d; idx = i; }
    }
    return { dist: best, idx };
  }

  async function searchFuelOnRoute(fromQ, toQ){
    if(fuelBusy || !fromQ.trim() || !toQ.trim()) return;
    fuelBusy = true; fuelError = ''; fuelStations = null; fuelRoute = null; fuelPlaceLabel = '';
    renderFuelMain();
    const prefs = fuelPrefs();
    try {
      const [a, b] = await Promise.all([geocodeOne(fromQ), geocodeOne(toQ)]);
      const route = await routeBetween(a, b);
      const pts = thinRoute(route.points, 2);

      // Un seul appel : rectangle englobant le trajet, elargi du rayon choisi
      const lats = pts.map(p => p.lat), lons = pts.map(p => p.lon);
      const margeLat = prefs.routeRadius / 111;
      const margeLon = prefs.routeRadius / (111 * Math.cos(((Math.min(...lats)+Math.max(...lats))/2) * Math.PI/180) || 1);
      const bbox = [Math.min(...lons)-margeLon, Math.min(...lats)-margeLat,
                    Math.max(...lons)+margeLon, Math.max(...lats)+margeLat];

      const rows = [];
      for(let page = 0; page < 4; page++){
        const url = FUEL_API
          + '?where=' + encodeURIComponent(`in_bbox(geom, ${bbox[1]}, ${bbox[0]}, ${bbox[3]}, ${bbox[2]})`)
          + '&limit=100&offset=' + (page * 100);
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 15000);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        if(!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const batch = data.results || data.records || [];
        rows.push(...batch);
        if(batch.length < 100) break;
      }

      const stations = [];
      rows.forEach(r => {
        const rec = r.fields || r;
        const co = stationCoords(rec);
        if(!co) return;
        const { dist, idx } = distanceToRoute(co.lat, co.lon, pts);
        if(dist > prefs.routeRadius) return;   // trop loin de la route
        stations.push({
          name: stationName(rec),
          address: [rec.adresse, rec.cp, rec.ville].filter(Boolean).join(' '),
          coords: co,
          dist,                                  // ecart par rapport a la route
          progress: idx / Math.max(1, pts.length - 1),
          prices: FUEL_TYPES.reduce((acc,f) => { acc[f.key] = stationPrice(rec, f.key); return acc; }, {}),
          maj: rec[prefs.type + '_maj'] || null
        });
      });

      fuelRoute = { from: a.label, to: b.label, km: route.km, approx: route.approx, count: stations.length };
      fuelStations = stations;
      if(!stations.length) fuelError = "Aucune station trouv\u00e9e le long de ce trajet. Essaie un \u00e9cart plus large.";
      else captureFuelPriceSnapshot();
    } catch(e){
      fuelError = "Impossible de calculer ce trajet. V\u00e9rifie les deux adresses et ta connexion.";
    }
    fuelBusy = false;
    renderFuelMain();
  }

  async function fetchFuelAround(lat, lon){
    fuelBusy = true;
    fuelRoute = null;
    fuelOrigin = (lat === null || lon === null) ? null : { lat, lon };
    const prefs = fuelPrefs();
    // France entiere : on demande directement les prix les plus bas du pays.
    // Sinon : toutes les stations dans le rayon choisi.
    const priceField = prefs.type + '_prix';
    const url = prefs.nationwide
      ? FUEL_API + '?where=' + encodeURIComponent(`${priceField} > 0`)
                 + '&order_by=' + encodeURIComponent(`${priceField} ASC`) + '&limit=100'
      : FUEL_API + '?where=' + encodeURIComponent(`distance(geom, geom'POINT(${lon} ${lat})', ${prefs.radius}km)`)
                 + '&limit=100';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if(!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const rows = data.results || data.records || [];
      fuelStations = rows.map(r => {
        const rec = r.fields || r;
        const co = stationCoords(rec);
        return {
          name: stationName(rec),
          address: [rec.adresse, rec.cp, rec.ville].filter(Boolean).join(' '),
          coords: co,
          dist: (co && lat !== null && lon !== null) ? haversineKm(lat, lon, co.lat, co.lon) : null,
          prices: FUEL_TYPES.reduce((acc,f) => { acc[f.key] = stationPrice(rec, f.key); return acc; }, {}),
          maj: rec[prefs.type + '_maj'] || rec.gazole_maj || null
        };
      });
      captureFuelPriceSnapshot();
    } catch(e){
      fuelError = "Impossible de r\u00e9cup\u00e9rer les prix pour l'instant. V\u00e9rifie ta connexion et r\u00e9essaie.";
    }
    fuelBusy = false;
    renderFuelMain();
  }

  function renderFuelMain(){
    const main = document.getElementById('fuelMainArea');
    if(!main) return;
    main.innerHTML = renderFuelSection();
    bindFuelEvents();
    if(fuelPermission === 'unknown') checkFuelPermission().then(() => {
      if(fuelPermission === 'prompt' && currentView === 'fuel'){ renderFuelMain(); }
    });
  }

  // Comparatif de tous les carburants sur la zone cherchee
  function renderFuelChart(){
    if(!fuelStations || !fuelStations.length) return '';
    const stats = FUEL_TYPES.map(f => {
      const vals = fuelStations.map(s => s.prices[f.key]).filter(v => v !== null && v > 0);
      if(!vals.length) return { ...f, count:0 };
      const min = Math.min(...vals), max = Math.max(...vals);
      const moy = vals.reduce((a,b) => a+b, 0) / vals.length;
      return { ...f, count: vals.length, min, max, moy };
    }).filter(s => s.count > 0);
    if(!stats.length) return '';

    // Echelle commune a tous les carburants, pour que les barres soient comparables
    const lo = Math.min(...stats.map(s => s.min));
    const hi = Math.max(...stats.map(s => s.max));
    const span = Math.max(0.001, hi - lo);
    const pct = v => ((v - lo) / span) * 100;
    const prefs = fuelPrefs();

    return `
      <div class="dash-section-title">Comparatif par carburant</div>
      <div class="fuel-chart">
        ${stats.map(s => `
          <div class="fuel-chart-row ${s.key===prefs.type?'current':''}" data-fuel-pick="${s.key}" title="Afficher les stations pour ce carburant">
            <div class="fuel-chart-label">${s.label}<span class="fuel-chart-count">${s.count}</span></div>
            <div class="fuel-chart-track">
              <div class="fuel-chart-range" style="left:${pct(s.min).toFixed(1)}%; width:${Math.max(1.5, pct(s.max)-pct(s.min)).toFixed(1)}%;"></div>
              <div class="fuel-chart-avg" style="left:${pct(s.moy).toFixed(1)}%;" title="Prix moyen"></div>
              <div class="fuel-chart-min" style="left:${pct(s.min).toFixed(1)}%;"></div>
            </div>
            <div class="fuel-chart-values">
              <span class="fuel-chart-best">${s.min.toFixed(3)}</span>
              <span class="fuel-chart-sep">\u2192</span>
              <span>${s.max.toFixed(3)} \u20ac</span>
            </div>
          </div>`).join('')}
        <div class="fuel-chart-legend">
          <span><i class="lg-min"></i> le moins cher</span>
          <span><i class="lg-avg"></i> moyenne</span>
          <span><i class="lg-range"></i> \u00e9cart constat\u00e9</span>
        </div>
      </div>`;
  }

  // ---------- historique du prix du carburant (courbe construite au fil des recherches) ----------
  // Reutilise les fonctions generiques FUEL_CHART_RANGES / FUEL_GRANULARITIES / fuelPeriodInfo /
  // renderFuelPriceChartSvg definies pour le carnet vehicule (fichier 06) : meme moteur de courbe,
  // seule la source des points differe (instantanes de recherche au lieu de pleins de vehicule).
  let fuelHistoryRange = 'all';
  let fuelHistoryGranularity = 'week';

  function fuelHistorySinceDate(){
    const r = FUEL_CHART_RANGES.find(x => x.key === fuelHistoryRange) || FUEL_CHART_RANGES[FUEL_CHART_RANGES.length-1];
    if(!r.months) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - r.months);
    return d;
  }

  function fuelHistoryPoints(type, sinceDate){
    return (state.fuelPriceHistory || [])
      .filter(h => h.type === type)
      .filter(h => !sinceDate || new Date(h.date) >= sinceDate)
      .sort((a,b) => new Date(a.date) - new Date(b.date));
  }

  // Agrege les instantanes par periode : plus bas/haut/moyen sur chaque periode
  function fuelHistoryPeriods(points, granularity){
    const buckets = new Map();
    points.forEach(h => {
      const info = fuelPeriodInfo(h.date, granularity);
      if(!buckets.has(info.key)) buckets.set(info.key, { ...info, mins:[], maxs:[], avgs:[] });
      const b = buckets.get(info.key);
      b.mins.push(h.min); b.maxs.push(h.max); b.avgs.push(h.avg);
    });
    return Array.from(buckets.values())
      .map(b => ({
        label: b.label, sortDate: b.sortDate,
        min: Math.min(...b.mins), max: Math.max(...b.maxs),
        avg: b.avgs.reduce((s,v)=>s+v,0) / b.avgs.length,
        count: b.mins.length
      }))
      .sort((a,b) => a.sortDate - b.sortDate);
  }

  function renderFuelHistorySection(){
    const prefs = fuelPrefs();
    const fuelLabel = (FUEL_TYPES.find(f => f.key === prefs.type) || {}).label || prefs.type;
    const points = fuelHistoryPoints(prefs.type, fuelHistorySinceDate());
    const rangeSelect = `<select id="fuelHistRange" class="fuel-range-select">${FUEL_CHART_RANGES.map(r => `<option value="${r.key}" ${r.key===fuelHistoryRange?'selected':''}>${r.label}</option>`).join('')}</select>`;
    const granSelect = `<select id="fuelHistGranularity" class="fuel-range-select">${FUEL_GRANULARITIES.map(g => `<option value="${g.key}" ${g.key===fuelHistoryGranularity?'selected':''}>${g.label}</option>`).join('')}</select>`;
    const controls = `<span class="fuel-chart-controls">${granSelect}${rangeSelect}</span>`;
    if(points.length < 2){
      return `
        <div class="dash-section-title fuel-chart-title-row">\ud83d\udcc8 Historique du prix (${esc(fuelLabel)}) ${controls}</div>
        <div class="empty-side">L'historique se construit au fil de tes recherches : reviens de temps en temps pour voir la courbe appara\u00eetre (au moins 2 recherches n\u00e9cessaires).</div>`;
    }
    const periods = fuelHistoryPeriods(points, fuelHistoryGranularity);
    const overallMin = Math.min(...periods.map(p => p.min));
    const overallMax = Math.max(...periods.map(p => p.max));
    const overallAvg = points.reduce((s,p) => s+p.avg, 0) / points.length;
    const trend = periods[periods.length-1].avg - periods[0].avg;
    const trendArrow = trend > 0.005 ? '\u2191' : (trend < -0.005 ? '\u2193' : '\u2192');
    const trendClass = trend > 0.005 ? 'trend-up' : (trend < -0.005 ? 'trend-down' : '');
    return `
      <div class="dash-section-title fuel-chart-title-row">\ud83d\udcc8 Historique du prix (${esc(fuelLabel)}) ${controls}</div>
      <div class="fuel-price-chart">
        ${renderFuelPriceChartSvg(periods)}
        <div class="fuel-chart-legend">
          <span><i class="lg-line-max"></i> le plus haut</span>
          <span><i class="lg-line-avg"></i> moyen</span>
          <span><i class="lg-line-min"></i> le plus bas</span>
        </div>
        <div class="fuel-price-stats">
          <span>Le plus bas : <strong>${overallMin.toFixed(3)} \u20ac/L</strong></span>
          <span>Moyenne : <strong>${overallAvg.toFixed(3)} \u20ac/L</strong></span>
          <span>Le plus haut : <strong>${overallMax.toFixed(3)} \u20ac/L</strong></span>
          <span class="${trendClass}">${trendArrow} ${trend >= 0 ? '+' : ''}${trend.toFixed(3)} \u20ac/L (moyenne) entre la premi\u00e8re et la derni\u00e8re p\u00e9riode</span>
        </div>
      </div>`;
  }

  function renderFuelSection(){
    const prefs = fuelPrefs();
    const dispo = (fuelStations || []).filter(s => s.prices[prefs.type] !== null);
    // La moins chere est calculee sur l'ensemble, quel que soit le tri affiche
    const cheapest = dispo.slice().sort((a,b) => a.prices[prefs.type] - b.prices[prefs.type])[0];
    const dearest  = dispo.slice().sort((a,b) => b.prices[prefs.type] - a.prices[prefs.type])[0];
    const list = dispo.slice().sort((a,b) => {
      if(prefs.sort === 'price') return a.prices[prefs.type] - b.prices[prefs.type];
      // En mode trajet, "distance" signifie l'ordre de passage sur la route
      if(fuelRoute) return (a.progress ?? 0) - (b.progress ?? 0);
      return (a.dist ?? 1e9) - (b.dist ?? 1e9);
    }).slice(0, 20);

    return `
      <div class="shopping-head">
        <h2>\u26fd Carburant</h2>
        <p>Prix officiels d\u00e9clar\u00e9s par les stations, actualis\u00e9s toutes les 10 minutes.</p>
      </div>
      <div class="fuel-controls no-lock">
        <select id="fuelType">${FUEL_TYPES.map(f => `<option value="${f.key}" ${prefs.type===f.key?'selected':''}>${f.label}</option>`).join('')}</select>
        <select id="fuelRadius">
          ${[5,10,20,30,50,100].map(r => `<option value="${r}" ${(!prefs.nationwide && !prefs.customMode && prefs.radius===r)?'selected':''}>${r} km</option>`).join('')}
          <option value="custom" ${(!prefs.nationwide && prefs.customMode)?'selected':''}>Distance au choix\u2026</option>
          <option value="france" ${prefs.nationwide?'selected':''}>\ud83c\uddeb\ud83c\uddf7 France enti\u00e8re</option>
        </select>
        ${(!prefs.nationwide && prefs.customMode) ? `
          <span class="fuel-custom-km">
            <input type="number" id="fuelCustomRadius" min="1" max="900" value="${prefs.radius}" inputmode="numeric"> km
          </span>` : ''}
        <button class="btn btn-gold" id="btnFuelSearch" ${fuelBusy?'disabled':''}>${fuelBusy ? 'Recherche\u2026' : (prefs.nationwide ? '\ud83d\udd0d Chercher' : '\ud83d\udccd Autour de moi')}</button>
        <button class="btn btn-line no-lock" id="btnFuelManualToggle">\ud83c\udfd8\ufe0f Par ville</button>
        <button class="btn btn-line no-lock" id="btnFuelRouteToggle">\ud83d\udee3\ufe0f Sur un trajet</button>
      </div>

      ${fuelShowRoute ? `
        <div class="fuel-route no-lock">
          <div class="fuel-route-fields">
            <input type="text" id="fuelFrom" placeholder="D\u00e9part (ville ou adresse)" value="${esc(prefs.from||'')}">
            <span class="fuel-route-arrow">\u2192</span>
            <input type="text" id="fuelTo" placeholder="Arriv\u00e9e" value="${esc(prefs.to||'')}">
          </div>
          <div class="fuel-route-actions">
            <label class="fuel-route-radius">\u00c9cart max
              <select id="fuelRouteRadius">${[2,5,10,15].map(r => `<option value="${r}" ${prefs.routeRadius===r?'selected':''}>${r} km</option>`).join('')}</select>
            </label>
            <button class="btn btn-gold" id="btnFuelRouteGo" ${fuelBusy?'disabled':''}>Chercher sur le trajet</button>
          </div>
        </div>` : ''}

      ${dispo.length ? `
      <div class="fuel-sort no-lock">
        <span class="fuel-sort-label">Trier par</span>
        <button class="fuel-sort-btn ${prefs.sort==='price'?'active':''}" data-fuel-sort="price">\ud83d\udcb0 Prix</button>
        <button class="fuel-sort-btn ${prefs.sort==='distance'?'active':''}" data-fuel-sort="distance">${fuelRoute ? '\ud83d\udee3\ufe0f Ordre du trajet' : '\ud83d\udccd Distance'}</button>
      </div>` : ''}

      ${prefs.nationwide ? `<div class="fuel-france-note">\ud83c\uddeb\ud83c\uddf7 Les 100 stations les moins ch\u00e8res de France pour ce carburant. La distance s'affiche si ta position est connue.</div>` : ''}

      ${fuelPermission === 'prompt' && !fuelStations && !fuelBusy ? `
        <div class="fuel-permission">
          <div class="fuel-permission-icon">\ud83d\udccd</div>
          <div class="fuel-permission-body">
            <div class="fuel-permission-title">Autoriser la localisation ?</div>
            <div class="fuel-permission-text">Ta position sert uniquement \u00e0 trouver les stations proches. Elle reste sur ton t\u00e9l\u00e9phone et n'est envoy\u00e9e nulle part.</div>
          </div>
          <button class="btn btn-gold" id="btnFuelAllow">Autoriser</button>
        </div>` : ''}

      ${(fuelShowManual || fuelPlaceLabel) ? `
        <div class="fuel-manual no-lock">
          <input type="text" id="fuelPlaceInput" placeholder="Ville ou code postal (ex. Annecy 74000)" value="${esc(fuelPlaceLabel)}">
          <button class="btn btn-gold" id="btnFuelPlace" ${fuelBusy?'disabled':''}>Chercher ici</button>
        </div>` : ''}

      ${fuelBusy ? `<div class="fuel-loading"><div class="receipt-spinner"></div><div class="modal-sub" style="margin-top:8px;">Recherche des stations\u2026</div></div>` : ''}
      ${fuelError ? `<div class="receipt-check-bar warn">\u26a0 ${esc(fuelError)}</div>` : ''}
      ${(fuelPlaceLabel && fuelStations && !fuelBusy) ? `<div class="fuel-place-note">Autour de : <strong>${esc(fuelPlaceLabel)}</strong></div>` : ''}
      ${(fuelRoute && fuelStations && !fuelBusy) ? `
        <div class="fuel-route-note">
          <strong>${esc(fuelRoute.from)}</strong> \u2192 <strong>${esc(fuelRoute.to)}</strong>
          \u00b7 ${Math.round(fuelRoute.km)} km \u00b7 ${fuelRoute.count} station${fuelRoute.count>1?'s':''} \u00e0 moins de ${prefs.routeRadius} km de la route
          ${fuelRoute.approx ? `<div class="fuel-route-warn">\u26a0 Itin\u00e9raire routier indisponible : calcul \u00e0 vol d'oiseau, les r\u00e9sultats sont approximatifs.</div>` : ''}
        </div>` : ''}

      ${(!fuelBusy && fuelStations && !list.length && !fuelError)
        ? `<div class="empty-side">Aucune station ne propose ce carburant dans ce rayon. Essaie un rayon plus large.</div>` : ''}

      ${renderFuelChart()}

      ${renderFuelHistorySection()}

      ${list.length ? `
        <div class="dash-section-title">Stations <span class="dash-count-badge">${list.length}</span></div>
        <div class="fuel-list">
          ${list.map((s,i) => `
            <div class="fuel-station ${s===cheapest?'best':''}">
              <div class="fuel-rank">${s===cheapest ? '\ud83c\udfc6' : (i+1)}</div>
              <div class="fuel-body">
                <div class="fuel-name">${esc(s.name)}</div>
                <div class="fuel-meta">${esc(s.address)}${s.dist!==null ? (fuelRoute ? ' \u00b7 \u00e0 ' + s.dist.toFixed(1) + ' km de la route' : ' \u00b7 ' + s.dist.toFixed(1) + ' km') : ''}</div>
                ${(s === cheapest && dearest && dearest !== cheapest) ? `<div class="fuel-save">La moins ch\u00e8re \u2014 ${((dearest.prices[prefs.type] - s.prices[prefs.type]) * 50).toFixed(2)} \u20ac d'\u00e9conomie sur 50 L</div>` : ''}
              </div>
              <div class="fuel-price">${s.prices[prefs.type].toFixed(3)} \u20ac</div>
              <div class="fuel-actions">
                ${s.coords ? `<a class="fuel-go" href="https://waze.com/ul?ll=${s.coords.lat},${s.coords.lon}&navigate=yes" target="_blank" rel="noopener" title="Ouvrir dans Waze">Waze</a>
                <a class="fuel-go" href="https://www.google.com/maps/dir/?api=1&destination=${s.coords.lat},${s.coords.lon}" target="_blank" rel="noopener" title="Ouvrir dans Google Maps">Maps</a>` : ''}
                <button class="fuel-go fuel-fill" data-fuel-fill="${esc(s.name)}" data-fuel-price="${s.prices[prefs.type]}" title="Enregistrer un plein \u00e0 ce prix">+ Plein</button>
              </div>
            </div>`).join('')}
        </div>
        <div class="fuel-source">Prix officiels d\u00e9clar\u00e9s par les stations (minist\u00e8re de l\u2019\u00c9conomie), actualis\u00e9s toutes les 10 minutes. \u00c0 v\u00e9rifier sur place.</div>
      ` : ''}
    `;
  }

  function bindFuelEvents(){
    const v = state.vehicles && state.vehicles.length ? (getVehicle(selectedVehicleId) || state.vehicles[0]) : null;
    const t = document.getElementById('fuelType');
    if(t) t.addEventListener('change', () => { fuelPrefs().type = t.value; save(); renderFuelMain(); });

    const histRange = document.getElementById('fuelHistRange');
    if(histRange) histRange.addEventListener('change', () => { fuelHistoryRange = histRange.value; renderFuelMain(); });
    const histGran = document.getElementById('fuelHistGranularity');
    if(histGran) histGran.addEventListener('change', () => { fuelHistoryGranularity = histGran.value; renderFuelMain(); });
    const r = document.getElementById('fuelRadius');
    if(r) r.addEventListener('change', () => {
      const p = fuelPrefs();
      if(r.value === 'france'){ p.nationwide = true; p.customMode = false; }
      else if(r.value === 'custom'){ p.nationwide = false; p.customMode = true; p.radius = p.customRadius || 50; }
      else { p.nationwide = false; p.customMode = false; p.radius = parseInt(r.value,10); }
      save(); renderFuelMain();
    });
    const cr = document.getElementById('fuelCustomRadius');
    if(cr){
      cr.addEventListener('input', () => {
        const v = Math.max(1, Math.min(900, parseInt(cr.value,10) || 1));
        fuelPrefs().radius = v; fuelPrefs().customRadius = v; save();
      });
      cr.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); askGeolocation(); } });
    }
    const btn = document.getElementById('btnFuelSearch');
    if(btn) btn.addEventListener('click', askGeolocation);
    const allow = document.getElementById('btnFuelAllow');
    if(allow) allow.addEventListener('click', askGeolocation);

    document.querySelectorAll('[data-fuel-pick]').forEach(row => row.addEventListener('click', () => {
      fuelPrefs().type = row.dataset.fuelPick;
      save(); renderFuelMain();
    }));

    document.querySelectorAll('[data-fuel-sort]').forEach(btn => btn.addEventListener('click', () => {
      fuelPrefs().sort = btn.dataset.fuelSort;
      save(); renderFuelMain();
    }));

    const routeToggle = document.getElementById('btnFuelRouteToggle');
    if(routeToggle) routeToggle.addEventListener('click', () => {
      fuelShowRoute = !fuelShowRoute;
      if(fuelShowRoute) fuelShowManual = false;
      renderFuelMain();
      setTimeout(() => document.getElementById('fuelFrom')?.focus(), 80);
    });
    const rr = document.getElementById('fuelRouteRadius');
    if(rr) rr.addEventListener('change', () => { fuelPrefs().routeRadius = parseInt(rr.value,10); save(); });
    const fromEl = document.getElementById('fuelFrom'), toEl = document.getElementById('fuelTo');
    const goRoute = () => {
      if(!fromEl || !toEl) return;
      fuelPrefs().from = fromEl.value; fuelPrefs().to = toEl.value; save();
      searchFuelOnRoute(fromEl.value, toEl.value);
    };
    const routeGo = document.getElementById('btnFuelRouteGo');
    if(routeGo) routeGo.addEventListener('click', goRoute);
    [fromEl, toEl].forEach(el => { if(el) el.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); goRoute(); } }); });

    const manualToggle = document.getElementById('btnFuelManualToggle');
    if(manualToggle) manualToggle.addEventListener('click', () => {
      fuelShowManual = !fuelShowManual;
      if(fuelShowManual) fuelShowRoute = false;
      renderFuelMain();
      setTimeout(() => document.getElementById('fuelPlaceInput')?.focus(), 80);
    });
    const placeBtn = document.getElementById('btnFuelPlace');
    const placeInput = document.getElementById('fuelPlaceInput');
    if(placeBtn && placeInput){
      const go = () => searchFuelByPlace(placeInput.value);
      placeBtn.addEventListener('click', go);
      placeInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); go(); } });
    }

    // Enregistrer un plein directement dans le carnet du vehicule
    document.querySelectorAll('[data-fuel-fill]').forEach(b => b.addEventListener('click', () => {
      if(!v){ toast('Cr\u00e9e d\u2019abord un v\u00e9hicule dans l\u2019onglet V\u00e9hicules.'); return; }
      const price = parseFloat(b.dataset.fuelPrice);
      v.entries = v.entries || [];
      v.entries.push({ id: uid(), type:'carburant', date: new Date().toISOString(),
        km: v.currentKm || '', cost: '', note: b.dataset.fuelFill + ' \u2014 ' + price.toFixed(3) + ' \u20ac/L' });
      save(); renderVehicleSidebar(); renderVehicleMain(); renderFuelMain();
      toast('Plein enregistr\u00e9 sur \u00ab ' + (v.name||'ton v\u00e9hicule') + ' \u00bb \u2014 compl\u00e8te le montant dans les V\u00e9hicules');
    }));
  }

  // ---------- carnet d'entretien vehicule ----------
