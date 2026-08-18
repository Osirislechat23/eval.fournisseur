  // Service worker : mise en cache du shell (HTML, polices, icônes) pour un vrai
  // fonctionnement hors-ligne. Le HTML est toujours re-vérifié en ligne (voir sw.js),
  // donc ceci ne bloque jamais l'utilisateur sur une version périmée.
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  const STORAGE_KEY = 'registre-fournisseurs-data-v1';

  // ============ SYNCHRONISATION CLOUD (Supabase) ============
  const SUPABASE_URL = 'https://tfoijiptbgvawghilnaz.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Z2jIN2KvRwFuUhCXlPSAXw_Ljfv51YU';
  let sb = null;
  let cloudUser = null;
  let cloudSaveTimer = null;
  const LAST_USER_KEY = 'rf-last-user';
  function rememberUser(u){
    try{ localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: u.id, email: u.email })); }catch(e){}
  }
  function lastKnownUser(){
    try{ const raw = localStorage.getItem(LAST_USER_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; }
  }
  function forgetUser(){ try{ localStorage.removeItem(LAST_USER_KEY); }catch(e){} }
  // Deconnexion volontaire : on doit redemander la connexion meme s'il reste des donnees locales
  const SIGNED_OUT_KEY = 'registre-signed-out';
  function markSignedOut(){ try{ localStorage.setItem(SIGNED_OUT_KEY, '1'); }catch(e){} }
  function clearSignedOut(){ try{ localStorage.removeItem(SIGNED_OUT_KEY); }catch(e){} }
  function wasSignedOut(){ try{ return localStorage.getItem(SIGNED_OUT_KEY) === '1'; }catch(e){ return false; } }
  // Empeche qu'un appel reseau bloque l'ouverture de l'app
  function withTimeout(promise, ms, fallback){
    return Promise.race([promise, new Promise(res => setTimeout(() => res(fallback), ms))]);
  }
  try {
    if(window.supabase && window.supabase.createClient){
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,        // garde la session dans le navigateur
          autoRefreshToken: true,      // renouvelle le jeton tout seul
          detectSessionInUrl: false,
          storageKey: 'rf-auth-session'
        }
      });
    }
  } catch(e){ sb = null; }

  function setCloudStatus(kind){ // 'saved' | 'saving' | 'offline'
    const dot = document.getElementById('cloudDot');
    const lbl = document.getElementById('cloudLabel');
    if(!dot || !lbl) return;
    dot.className = 'cloud-dot' + (kind === 'saving' ? ' saving' : (kind === 'offline' ? ' offline' : ''));
    lbl.textContent = kind === 'saving' ? 'Sauvegarde\u2026' : (kind === 'offline' ? 'Hors-ligne' : 'Synchronis\u00e9');
  }

  async function cloudPush(){
    if(!sb || !cloudUser) return;
    setCloudStatus('saving');
    try {
      const { error } = await sb.from('app_data').upsert({
        user_id: cloudUser.id,
        data: state,
        updated_at: new Date().toISOString()
      });
      setCloudStatus(error ? 'offline' : 'saved');
    } catch(e){ setCloudStatus('offline'); }
  }

  function scheduleCloudSave(){
    if(!sb || !cloudUser) return;
    clearTimeout(cloudSaveTimer);
    setCloudStatus('saving');
    cloudSaveTimer = setTimeout(cloudPush, 1200);
  }

  async function cloudPull(){
    if(!sb || !cloudUser) return null;
    try {
      const res = await withTimeout(
        sb.from('app_data').select('data').eq('user_id', cloudUser.id).maybeSingle(),
        12000, { data: null, error: 'timeout' }
      );
      if(!res || res.error || !res.data) return null;
      return res.data.data || null;
    } catch(e){ return null; }
  }
  // ==========================================================

  // ============ PHOTOS : STOCKAGE SUPABASE STORAGE + CACHE LOCAL ============
  // Les photos historiques restent des chaines base64 ("data:...") stockees telles quelles.
  // Les nouvelles photos, quand un compte cloud est actif, sont envoyees vers le bucket Storage
  // "photos" et referencees par leur chemin (ex. "abc123/p-xyz.jpg") au lieu du base64 complet :
  // ca evite de retransmettre chaque photo a chaque sauvegarde du blob JSON. Si l'upload echoue
  // (bucket pas encore cree, hors-ligne...), on retombe simplement sur l'ancien comportement
  // (base64 inline) - aucune photo n'est jamais perdue a cause de la config Supabase.
  const PHOTO_BUCKET = 'photos';
  const photoMemCache = new Map();
  const PHOTO_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#E3DFD2"/></svg>'
  );

  let photoDbPromise = null;
  function openPhotoDb(){
    if(photoDbPromise) return photoDbPromise;
    photoDbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open('rf-photo-cache', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('photos'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      } catch(e){ reject(e); }
    });
    return photoDbPromise;
  }
  async function cachePhotoLocally(path, dataUrl){
    try {
      const db = await openPhotoDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readwrite');
        tx.objectStore('photos').put(dataUrl, path);
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } catch(e){}
  }
  async function getCachedPhotoLocally(path){
    try {
      const db = await openPhotoDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('photos', 'readonly');
        const req = tx.objectStore('photos').get(path);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch(e){ return null; }
  }
  function blobToDataUrl(blob){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Envoie une photo (dataURL) vers Supabase Storage et renvoie le chemin a stocker dans state.
  // Retombe sur le dataURL d'origine si pas de compte cloud ou en cas d'echec (rien n'est perdu).
  async function storePhoto(dataUrl, prefix){
    if(!sb || !cloudUser || !dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${cloudUser.id}/${prefix||'p'}-${uid()}.jpg`;
      const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if(error) return dataUrl;
      photoMemCache.set(path, dataUrl);
      cachePhotoLocally(path, dataUrl);
      return path;
    } catch(e){ return dataUrl; }
  }

  // Resout un chemin Storage (ou un dataURL historique) en dataURL affichable, en passant
  // par le cache memoire puis IndexedDB puis, en dernier recours, un telechargement reseau.
  async function getPhotoDataUrl(ref){
    if(!ref) return '';
    if(ref.startsWith('data:')) return ref;
    if(photoMemCache.has(ref)) return photoMemCache.get(ref);
    const cached = await getCachedPhotoLocally(ref);
    if(cached){ photoMemCache.set(ref, cached); return cached; }
    if(!sb) return PHOTO_PLACEHOLDER;
    try {
      const { data, error } = await sb.storage.from(PHOTO_BUCKET).download(ref);
      if(error || !data) return PHOTO_PLACEHOLDER;
      const dataUrl = await blobToDataUrl(data);
      photoMemCache.set(ref, dataUrl);
      cachePhotoLocally(ref, dataUrl);
      return dataUrl;
    } catch(e){ return PHOTO_PLACEHOLDER; }
  }

  // Version synchrone pour l'affichage dans les templates HTML : renvoie tout de suite ce qui
  // est deja connu (base64 historique ou deja en cache), sinon un placeholder neutre, et met a
  // jour discretement tous les <img data-photo-ref="..."> correspondants des que resolu.
  function resolvePhotoSrc(ref){
    if(!ref) return '';
    if(ref.startsWith('data:')) return ref;
    if(photoMemCache.has(ref)) return photoMemCache.get(ref);
    getPhotoDataUrl(ref).then(url => {
      photoMemCache.set(ref, url);
      document.querySelectorAll('img[data-photo-ref]').forEach(img => {
        if(img.dataset.photoRef === ref) img.src = url;
      });
    });
    return PHOTO_PLACEHOLDER;
  }

  function deletePhotoRef(ref){
    if(!ref || typeof ref !== 'string' || ref.startsWith('data:') || !sb) return;
    photoMemCache.delete(ref);
    sb.storage.from(PHOTO_BUCKET).remove([ref]).catch(()=>{});
  }
  function deletePhotoRefs(list){
    (list||[]).forEach(p => deletePhotoRef(typeof p === 'string' ? p : (p && p.src)));
  }
  // Rassemble les references photo d'un element de la corbeille, pour nettoyage au moment de la purge.
  function collectTrashPhotoRefs(collection, item){
    const refs = [];
    if(!item) return refs;
    if(collection === 'suppliers'){
      (item.products||[]).forEach(p => (p.comments||[]).forEach(c => (c.photos||[]).forEach(ph => refs.push(ph))));
    } else if(collection === 'albums'){
      (item.photos||[]).forEach(p => refs.push(p && p.src));
    } else if(collection === 'recipes'){
      (item.photos||[]).forEach(ph => refs.push(ph));
    } else if(collection === 'surveys'){
      if(item.bg) refs.push(item.bg);
    }
    return refs.filter(Boolean);
  }
  // ==========================================================

  const DEFAULT_MACHINES = ['Scie à format','Scie radiale','Toupie','Dégauchisseuse','Raboteuse','Perceuse à colonne','Mortaiseuse','Tenonneuse','Défonceuse','Ponceuse à bande','Presse à coller','Centre d\'usinage CNC'];
  const DEFAULT_STEPS = ['Débit','Dégauchissage','Rabotage','Délignage','Perçage','Mortaisage','Tenonnage','Assemblage','Collage','Ponçage','Finition / Vernissage','Contrôle qualité','Emballage'];
  const DEFAULT_PIECES = ['Dormant','Traverse haute','Traverse basse','Montant','Battant','Petit bois','Vitrage','Seuil','Linteau','Jambage','Panneau de remplissage','Cadre'];
  const DEFAULT_MATERIALS = ['PVC blanc','PVC couleur','Aluminium','Bois massif chêne','Bois massif sapin','Bois massif exotique','MDF','Contreplaqué','Panneau mélaminé','Vitrage simple','Vitrage double','Acier'];
  const DEFAULT_MARGINS = ['5','10','15','20','25','30','40','50','60','70','80','90','100'];
  // Le socle : ce qui sert au quotidien. Le reste est complementaire et s'active a la demande.
  const ESSENTIAL_FEATURES = ['hours', 'budget', 'notes', 'shopping'];
  const FEATURE_DEFS = [
    { key:'suppliers', label:'Fournisseurs', space:'professional' },
    { key:'debit', label:'Fiches de débit', space:'professional' },
    { key:'mfg', label:'Analyses de fabrication', space:'professional' },
    { key:'folders', label:'Dossiers', space:'professional' },
    { key:'surveys', label:'Relevés', space:'professional' },
    { key:'gallery', label:'Galerie', space:'professional' },
    { key:'trips', label:'Trajets', space:'personal' },
    { key:'vehicles', label:'Véhicules', space:'personal' },
    { key:'fuel', label:'Carburant', space:'personal' },
    { key:'meals', label:'Repas', space:'personal' },
    { key:'gifts', label:'Cadeaux', space:'personal' },
    { key:'spacing', label:'Répartition', space:'personal' },
    { key:'notes', label:'Notes', space:'personal' },
    { key:'recipes', label:'Recettes', space:'personal' },
    { key:'hours', label:'Heures', space:'personal' },
    { key:'budget', label:'Budget', space:'personal' },
    { key:'shopping', label:'Courses', space:'personal' },
    { key:'stats', label:'Statistiques', space:'personal' }
  ];
  // Horodatage des donnees telles qu'elles etaient a l'ouverture de la page.
  // C'est lui qu'on compare au cloud : les enregistrements techniques du demarrage
  // ne doivent pas faire croire que l'appareil a des modifications plus recentes.
  let loadedUpdatedAt = null;
  let hasLocalEdits = false;

  let state = load();
  loadedUpdatedAt = state.updatedAt || null;
  if(!Array.isArray(state.debitSheets)) state.debitSheets = [];
  if(!Array.isArray(state.manufacturingSheets)) state.manufacturingSheets = [];
  if(!Array.isArray(state.folders)) state.folders = [];
  if(!Array.isArray(state.trips)) state.trips = [];
  if(!Array.isArray(state.spacings)) state.spacings = [];
  if(!Array.isArray(state.notes)) state.notes = [];
  if(!Array.isArray(state.recipes)) state.recipes = [];
  if(!Array.isArray(state.hoursWeeks)) state.hoursWeeks = [];
  if(!Array.isArray(state.budgetEntries)) state.budgetEntries = [];
  if(!Array.isArray(state.shoppingItems)) state.shoppingItems = [];
  if(!Array.isArray(state.trash)) state.trash = [];
  if(!Array.isArray(state.albums)) state.albums = [];
  if(!state.meals || typeof state.meals !== 'object') state.meals = {};
  if(!Array.isArray(state.people)) state.people = [];
  state.people.forEach(p => { if(!Array.isArray(p.gifts)) p.gifts = []; });
  if(!Array.isArray(state.surveys)) state.surveys = [];
  state.surveys.forEach(s => { if(!Array.isArray(s.measures)) s.measures = []; });
  if(!Array.isArray(state.vehicles)) state.vehicles = [];
  state.vehicles.forEach(v => { if(!Array.isArray(v.entries)) v.entries = []; });
  // Liens de dossier : chaque dossier peut regrouper heures, repartitions et notes
  state.folders.forEach(f => {
    if(!Array.isArray(f.hoursWeekIds)) f.hoursWeekIds = [];
    if(!Array.isArray(f.spacingIds)) f.spacingIds = [];
    if(!Array.isArray(f.noteIds)) f.noteIds = [];
    if(!Array.isArray(f.albumIds)) f.albumIds = [];
    if(!Array.isArray(f.surveyIds)) f.surveyIds = [];
  });
  state.trash.filter(t => Date.now() - new Date(t.deletedAt).getTime() >= 30*24*3600*1000)
    .forEach(t => collectTrashPhotoRefs(t.collection, t.item).forEach(deletePhotoRef));
  state.trash = state.trash.filter(t => Date.now() - new Date(t.deletedAt).getTime() < 30*24*3600*1000);
  if(!state.punch || typeof state.punch !== 'object' || !state.punch.status) state.punch = { status:'out', chantierName:'', currentStartISO:null, segments:[] };
  if(!state.arcade || typeof state.arcade !== 'object') state.arcade = {};
  if(!state.arcade.rpgBest) state.arcade.rpgBest = { easy:0, normal:0, hard:0 };
  if(typeof state.arcade.best2048 !== 'number') state.arcade.best2048 = 0;
  if(typeof state.arcade.tttWins !== 'number') state.arcade.tttWins = 0;
  if(typeof state.arcade.minesWins !== 'number') state.arcade.minesWins = 0;
  if(state.arcade.memoryBest === undefined) state.arcade.memoryBest = null;
  let currentSpace = state.settings.activeSpace || 'professional';
  let currentView = currentSpace === 'personal' ? 'trips' : 'suppliers';
  let selectedSupplierId = state.suppliers[0]?.id ?? null;
  let selectedSheetId = state.debitSheets[0]?.id ?? null;
  let selectedMfgId = state.manufacturingSheets[0]?.id ?? null;
  let selectedFolderId = state.folders[0]?.id ?? null;
  let selectedAlbumId = state.albums?.[0]?.id ?? null;
  let selectedVehicleId = state.vehicles?.[0]?.id ?? null;
  let selectedSurveyId = state.surveys?.[0]?.id ?? null;
  let selectedPersonId = state.people?.[0]?.id ?? null;
  let selectedTripId = state.trips[0]?.id ?? null;
  let selectedSpacingId = state.spacings[0]?.id ?? null;
  let selectedNoteId = state.notes[0]?.id ?? null;
  let selectedRecipeId = state.recipes[0]?.id ?? null;
  let selectedWeekStart = mondayOf(new Date()).toISOString();
  let hoursExpandedYears = null; // Set d'années dépliées dans la sidebar Heures ; initialisé au premier rendu
  let hoursExpandedMonths = null; // Set de clés "année-mois" dépliées ; initialisé au premier rendu
  let openProducts = new Set();
  let openNewCommentFor = null;
  let openNewProductForm = false;
  let pendingPhotos = [];
  let pendingRating = 0;
  let pendingText = '';
  let editingComment = null; // { pid, cid }
  let editRating = 0;
  let editText = '';
  let editPhotos = [];
  let hasUnsavedChanges = false;

  function load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const data = JSON.parse(raw);
        migrate(data);
        return data;
      }
    }catch(e){ console.warn('Lecture stockage impossible', e); }
    const fresh = { suppliers: [], debitSheets: [], manufacturingSheets: [], company: {} };
    migrate(fresh);
    return fresh;
  }
  // Convertit les anciennes données (photo unique, note /5) vers le nouveau format (photos multiples, note /10)
  function migrate(data){
    if(!data.company || typeof data.company !== 'object') data.company = {};
    if(!data.settings || typeof data.settings !== 'object') data.settings = {};
    if(!Array.isArray(data.folders)) data.folders = [];
    if(!Array.isArray(data.trips)) data.trips = [];
    if(!Array.isArray(data.spacings)) data.spacings = [];
    if(!Array.isArray(data.notes)) data.notes = [];
    if(!Array.isArray(data.recipes)) data.recipes = [];
    if(!Array.isArray(data.hoursEntries)) data.hoursEntries = [];
    if(!Array.isArray(data.hoursWeeks)) data.hoursWeeks = [];
    if(typeof data.settings.darkMode !== 'boolean') data.settings.darkMode = false;
    if(typeof data.settings.ficheStatusEnabled !== 'boolean') data.settings.ficheStatusEnabled = false;
    if(typeof data.settings.dimensionAlertsEnabled !== 'boolean') data.settings.dimensionAlertsEnabled = false;
    if(data.settings.activeSpace !== 'personal' && data.settings.activeSpace !== 'professional') data.settings.activeSpace = 'professional';
    if(!data.settings.enabledFeatures || typeof data.settings.enabledFeatures !== 'object') data.settings.enabledFeatures = {};
    // Reglage par defaut : seul l'essentiel est visible. Applique une fois,
    // ensuite ce sont les choix de l'utilisateur qui font foi.
    if(!data.settings.essentialDefaultApplied){
      FEATURE_DEFS.forEach(f => {
        data.settings.enabledFeatures[f.key] = ESSENTIAL_FEATURES.includes(f.key);
      });
      data.settings.essentialDefaultApplied = true;
    }
    data.settings.featuresInitialised = true;
    FEATURE_DEFS.forEach(f => {
      if(typeof data.settings.enabledFeatures[f.key] !== 'boolean'){
        // Une fonctionnalite jamais configuree : active seulement si elle est essentielle
        data.settings.enabledFeatures[f.key] = ESSENTIAL_FEATURES.includes(f.key);
      }
    });
    if(typeof data.settings.currency !== 'string' || !data.settings.currency.trim()) data.settings.currency = '€';
    if(!['small','normal','large'].includes(data.settings.fontSize)) data.settings.fontSize = 'normal';
    if(typeof data.settings.highContrast !== 'boolean') data.settings.highContrast = false;
    if(!['brouillon','en_cours','validee','terminee'].includes(data.settings.defaultFicheStatus)) data.settings.defaultFicheStatus = 'brouillon';
    if(typeof data.settings.defaultMargin !== 'string') data.settings.defaultMargin = '';
    if(!Array.isArray(data.machines)) data.machines = DEFAULT_MACHINES.map(name => ({ id: uid(), name }));
    if(!Array.isArray(data.operationSteps)) data.operationSteps = DEFAULT_STEPS.map(name => ({ id: uid(), name }));
    if(!Array.isArray(data.pieceLibrary)) data.pieceLibrary = DEFAULT_PIECES.map(name => ({ id: uid(), name }));
    if(!Array.isArray(data.materialLibrary)) data.materialLibrary = DEFAULT_MATERIALS.map(name => ({ id: uid(), name }));
    if(!Array.isArray(data.marginLibrary)) data.marginLibrary = DEFAULT_MARGINS.map(name => ({ id: uid(), name }));
    if(!data.settings.marginRangeUpgraded){
      const existingMarginNames = new Set(data.marginLibrary.map(m => m.name));
      DEFAULT_MARGINS.forEach(name => {
        if(!existingMarginNames.has(name)) data.marginLibrary.push({ id: uid(), name });
      });
      data.settings.marginRangeUpgraded = true;
    }
    if(!Array.isArray(data.manufacturingSheets)) data.manufacturingSheets = [];
    (data.suppliers||[]).forEach(s => {
      if(!s.status) s.status = 'actif';
      if(typeof s.phone !== 'string') s.phone = '';
      if(typeof s.email !== 'string') s.email = '';
      (s.products||[]).forEach(p => {
        (p.comments||[]).forEach(c => {
          if(!Array.isArray(c.photos)){
            c.photos = c.photo ? [c.photo] : [];
            delete c.photo;
          }
        });
      });
    });
    (data.debitSheets||[]).forEach(s => {
      if(typeof s.reference !== 'string' || !s.reference) s.reference = generateSheetReference(data, s);
      if(typeof s.operator !== 'string') s.operator = '';
      if(typeof s.status !== 'string') s.status = 'brouillon';
      (s.rows||[]).forEach((r,i) => {
        if(typeof r.repere !== 'string') r.repere = 'P' + (i+1);
        if(typeof r.marge === 'undefined') r.marge = '';
      });
    });
    (data.manufacturingSheets||[]).forEach(s => {
      if(typeof s.reference !== 'string' || !s.reference) s.reference = generateMfgReference(data, s);
      if(typeof s.operator !== 'string') s.operator = '';
      if(!Array.isArray(s.linkedDebitSheetIds)) s.linkedDebitSheetIds = [];

      let flatOps = [];
      if(Array.isArray(s.steps)){
        // Ancienne structure étapes/sous-étapes → aplatie en lignes simples
        s.steps.forEach(st => {
          flatOps.push({
            id: st.id || uid(), repere: '', designation: st.name || '',
            machine: st.machine || '', temps: st.temps ?? '', observation: st.observation || ''
          });
          (st.subSteps||[]).forEach(ss => {
            flatOps.push({
              id: ss.id || uid(), repere: '', designation: ss.name || '',
              machine: ss.machine || '', temps: ss.temps ?? '', observation: ss.observation || ''
            });
          });
        });
        delete s.steps;
      } else if(Array.isArray(s.operations)){
        flatOps = s.operations.map(op => {
          if('tempsReglage' in op || 'tempsUnitaire' in op || 'quantite' in op){
            // Toute première structure (réglage/unitaire/quantité) → temps fusionné
            return {
              id: op.id || uid(), repere: op.repere || '', designation: op.designation || '',
              machine: op.machine || '',
              temps: ((parseFloat(op.tempsReglage)||0) + (parseFloat(op.tempsUnitaire)||0) * (parseFloat(op.quantite)||0)) || '',
              observation: op.observation || ''
            };
          }
          return {
            id: op.id || uid(), repere: op.repere || '', designation: op.designation || '',
            machine: op.machine || '', temps: op.temps ?? '', observation: op.observation || ''
          };
        });
      }
      s.operations = flatOps;
      s.operations.forEach((op,i) => {
        if(!op.repere) op.repere = 'E' + (i+1);
        if(typeof op.controle !== 'boolean') op.controle = false;
      });
    });
    (data.folders||[]).forEach(f => {
      if(typeof f.reference !== 'string' || !f.reference) f.reference = generateFolderReference(data, f);
      if(!Array.isArray(f.debitSheetIds)) f.debitSheetIds = [];
      if(!Array.isArray(f.mfgSheetIds)) f.mfgSheetIds = [];
      if(!Array.isArray(f.photoSections)) f.photoSections = [];
    });
    (data.trips||[]).forEach(t => {
      if(typeof t.reference !== 'string' || !t.reference) t.reference = generateTripReference(data, t);
      if(typeof t.roundTrip !== 'boolean') t.roundTrip = false;
      if(typeof t.peopleCount === 'undefined') t.peopleCount = '';
    });
    (data.spacings||[]).forEach(s => {
      if(typeof s.reference !== 'string' || !s.reference) s.reference = generateSpacingReference(data, s);
      if(typeof s.edgeSpace !== 'boolean') s.edgeSpace = true;
    });
    (data.notes||[]).forEach(n => {
      if(typeof n.title !== 'string') n.title = '';
      if(typeof n.content !== 'string') n.content = '';
      if(typeof n.createdAt !== 'string') n.createdAt = new Date().toISOString();
      if(typeof n.updatedAt !== 'string') n.updatedAt = n.createdAt;
    });
    (data.recipes||[]).forEach(r => {
      if(typeof r.title !== 'string') r.title = '';
      if(!Array.isArray(r.ingredients)) r.ingredients = [];
      if(!Array.isArray(r.photos)) r.photos = [];
      if(typeof r.comments !== 'string') r.comments = '';
      if(typeof r.createdAt !== 'string') r.createdAt = new Date().toISOString();
      if(typeof r.updatedAt !== 'string') r.updatedAt = r.createdAt;
      r.ingredients.forEach(ing => { if(typeof ing.text !== 'string') ing.text = ''; });
    });
    if(!data.settings.hoursMigratedToWeeks && Array.isArray(data.hoursEntries) && data.hoursEntries.length){
      data.hoursEntries.forEach(old => {
        if(!old.date || !old.startTime || !old.endTime) return;
        const d = new Date(old.date);
        const weekStartIso = mondayOf(d).toISOString();
        let week = data.hoursWeeks.find(w => w.weekStart === weekStartIso);
        if(!week){
          week = newHoursWeek(weekStartIso);
          week.reference = generateHoursReference(data, week);
          data.hoursWeeks.push(week);
        }
        const dayIdx = (d.getDay() || 7) - 1; // lundi=0 … dimanche=6
        const [sh,sm] = old.startTime.split(':').map(Number);
        const [eh,em] = old.endTime.split(':').map(Number);
        if(isNaN(sh) || isNaN(eh)) return;
        const day = week.days[dayIdx];
        day.startHour = sh; day.startMinute = roundToQuarterHour(sm||0);
        day.endHour = eh; day.endMinute = roundToQuarterHour(em||0);
        const breakMin = parseFloat(old.breakMinutes) || 0;
        if(breakMin > 0){
          let startTotal = sh*60+(sm||0), endTotal = eh*60+(em||0);
          if(endTotal < startTotal) endTotal += 24*60;
          const mid = startTotal + Math.floor((endTotal-startTotal)/2);
          const pStart = Math.max(startTotal, mid - Math.floor(breakMin/2));
          const pEnd = pStart + breakMin;
          day.pauses.push({
            id: uid(),
            startHour: Math.floor((pStart%1440)/60), startMinute: roundToQuarterHour((pStart%1440)%60),
            endHour: Math.floor((pEnd%1440)/60), endMinute: roundToQuarterHour((pEnd%1440)%60)
          });
        }
      });
      data.settings.hoursMigratedToWeeks = true;
    }
    if(!data.settings.hoursMigratedToChantiers && Array.isArray(data.hoursWeeks)){
      data.hoursWeeks.forEach(week => {
        (week.days||[]).forEach(day => {
          if(Array.isArray(day.chantiers)) return; // déjà au nouveau format
          const hasRange = day.startHour!=='' && day.startHour!=null && day.endHour!=='' && day.endHour!=null;
          if(!hasRange){ day.chantiers = []; delete day.startHour; delete day.startMinute; delete day.endHour; delete day.endMinute; delete day.pauses; return; }
          let s = parseInt(day.startHour)*60 + parseInt(day.startMinute||0);
          let e = parseInt(day.endHour)*60 + parseInt(day.endMinute||0);
          if(e < s) e += 24*60;
          let segments = [{ start:s, end:e }];
          (day.pauses||[]).forEach(p => {
            if(p.startHour==='' || p.startHour==null || p.endHour==='' || p.endHour==null) return;
            let ps = parseInt(p.startHour)*60 + parseInt(p.startMinute||0);
            let pe = parseInt(p.endHour)*60 + parseInt(p.endMinute||0);
            if(pe < ps) pe += 24*60;
            const next = [];
            segments.forEach(seg => {
              if(pe <= seg.start || ps >= seg.end){ next.push(seg); return; }
              if(ps > seg.start) next.push({ start: seg.start, end: Math.min(ps, seg.end) });
              if(pe < seg.end) next.push({ start: Math.max(pe, seg.start), end: seg.end });
            });
            segments = next.filter(seg => seg.end > seg.start);
          });
          day.chantiers = segments.map(seg => {
            const st = minutesToHM(seg.start), en = minutesToHM(seg.end);
            return { id: uid(), name:'', startHour: st.hour, startMinute: st.minute, endHour: en.hour, endMinute: en.minute };
          });
          if(!day.chantiers.length) day.chantiers = [newChantierBlock()];
          delete day.startHour; delete day.startMinute; delete day.endHour; delete day.endMinute; delete day.pauses;
        });
      });
      data.settings.hoursMigratedToChantiers = true;
    }
    (data.hoursWeeks||[]).forEach(week => {
      (week.days||[]).forEach(day => {
        if(typeof day.status !== 'string') day.status = 'normal';
      });
    });
  }
  function save(){
    try{
      state.updatedAt = new Date().toISOString();   // permet d'arbitrer local / cloud
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){
      toast("Stockage plein — supprimez une photo ou exportez vos données.");
    }
    hasUnsavedChanges = false;
    scheduleCloudSave();
  }
  // Marque une vraie modification de l'utilisateur (par opposition aux migrations du demarrage)
  function markLocalEdit(){ hasLocalEdits = true; }
  // Avertit une seule fois par appareil que les données sont locales à ce navigateur.
  function warnLocalStorageOnce(){
    const KEY = 'rf-warned-local-storage';
    if(sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    if(location.protocol === 'file:'){
      toast('Astuce : hébergez ce fichier en ligne (GitHub Pages) pour un accès stable depuis un lien.');
    }
  }
  function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
  function toast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(()=>t.classList.remove('show'), 2600);
  }
  // Confirmation de suppression en deux clics, intégrée à l'app : évite de dépendre de window.confirm(),
  // qui peut être bloqué ou ne jamais s'afficher dans certains navigateurs intégrés/mobiles.
  function bindConfirmDeleteButton(btn, onConfirm, confirmLabel, stopProp){
    if(!btn || btn._confirmBound) return;
    btn._confirmBound = true;
    const originalLabel = btn.textContent;
    let armed = false, timer = null;
    function reset(){
      armed = false;
      clearTimeout(timer);
      btn.textContent = originalLabel;
      btn.classList.remove('btn-confirm-armed');
    }
    btn.addEventListener('click', (e) => {
      if(stopProp) e.stopPropagation();
      if(!armed){
        armed = true;
        btn.textContent = confirmLabel || 'Confirmer ?';
        btn.classList.add('btn-confirm-armed');
        timer = setTimeout(reset, 3500);
        return;
      }
      reset();
      onConfirm();
    });
  }

  // ============ COMPOSANT GENERIQUE "LISTE + DETAIL" ============
  // Les ~12 modules a liste plate (fournisseurs, fiches, dossiers, trajets, repartitions, notes,
  // recettes, releves, vehicules, albums, cadeaux) partagent exactement ce meme squelette de
  // barre laterale (recherche, etats vides, item actif) et les memes gestes (selection au clic,
  // creation d'un nouvel element). Le contenu du panneau de detail reste propre a chaque module
  // (les formulaires sont trop differents pour etre generifies sans perdre en clarte), mais toute
  // cette portion mecanique est factorisee ici plutot que redupliquee module par module.

  // Construit le HTML d'une liste laterale : recherche, etats vides, wrapper .sheet-item actif.
  // opts.itemHtml(item) fournit le contenu propre a chaque module (nom, badges, meta...).
  function renderListSidebar(opts){
    const list = document.getElementById(opts.listElId);
    if(!list) return;
    const q = opts.searchElId ? (document.getElementById(opts.searchElId)?.value || '').toLowerCase().trim() : '';
    let items = opts.items;
    if(opts.sortFn) items = items.slice().sort(opts.sortFn);
    const filtered = q ? items.filter(it => opts.matchQuery(it, q)) : items;
    if(!opts.items.length){
      list.innerHTML = opts.emptyMessage;
      return;
    }
    if(!filtered.length){
      list.innerHTML = opts.noMatchMessage ? opts.noMatchMessage(q) : `<div class="empty-side">Aucun résultat pour « ${esc(q)} ».</div>`;
      return;
    }
    list.innerHTML = filtered.map((it, i) => `
      ${opts.groupLabel ? (opts.groupLabel(it, i, filtered) || '') : ''}
      <div class="${opts.wrapperClass || 'sheet-item'} ${opts.itemClass ? opts.itemClass(it) : ''} ${it.id===opts.selectedId?'active':''}" data-${opts.dataAttr}="${it.id}" tabindex="0">
        ${opts.itemHtml(it)}
      </div>`).join('');
    if(opts.afterRender) opts.afterRender(list);
  }

  // Delegation de clic "selectionner un element de la liste" : un seul binding par liste,
  // pose une fois au demarrage (la liste elle-meme est reconstruite a chaque render).
  function bindListSelect(listElId, dataAttr, onSelect){
    const el = document.getElementById(listElId);
    if(!el) return;
    el.addEventListener('click', e => {
      const item = e.target.closest(`[data-${dataAttr}]`);
      if(!item) return;
      onSelect(item.dataset[dataAttr]);
      render();
    });
  }

  // Ajoute un nouvel element en tete de collection, le selectionne, sauvegarde, re-rend,
  // et place le focus sur le premier champ du formulaire de detail.
  function addListItem(collection, newItem, selectedIdSetter, focusElId){
    state[collection].unshift(newItem);
    selectedIdSetter(newItem.id);
    forceUnlockNext = true;
    save(); render();
    if(focusElId){
      const el = document.getElementById(focusElId);
      if(el){ el.focus(); if(el.select) el.select(); }
    }
  }
  // ==========================================================

  function esc(s){
    return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmtDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'});
  }

  function allComments(product){ return product.comments || []; }
  function productAvg(product){
    const c = allComments(product);
    if(!c.length) return null;
    return c.reduce((s,x)=>s+x.rating,0) / c.length;
  }
  function supplierAvg(supplier){
    const ratings = [];
    (supplier.products||[]).forEach(p => allComments(p).forEach(c => ratings.push(c.rating)));
    if(!ratings.length) return null;
    return ratings.reduce((s,x)=>s+x,0) / ratings.length;
  }
  function ratingClass(avg){
    if(avg === null) return 'rating-none';
    if(avg >= 8) return 'rating-good';
    if(avg >= 5) return 'rating-mid';
    return 'rating-low';
  }
  function scoreLabel(rating){
    return `${rating}<span style="opacity:.55; font-weight:400;">/10</span>`;
  }

  function getSupplier(id){ return state.suppliers.find(s => s.id === id); }
  function getProduct(supplier, pid){ return (supplier.products||[]).find(p => p.id === pid); }
  function getSheet(id){ return state.debitSheets.find(s => s.id === id); }
  function newRow(nextIndex){ return { id: uid(), repere: nextIndex ? ('P'+nextIndex) : '', designation:'', longueur:'', largeur:'', epaisseur:'', quantite:1, materiau:'', marge: state.settings.defaultMargin || '', observation:'' }; }
  function generateSheetReference(data, forSheet){
    const year = new Date((forSheet && forSheet.date) || Date.now()).getFullYear();
    const prefix = `FD-${year}-`;
    const nums = (data.debitSheets||[])
      .filter(s => s !== forSheet && (s.reference||'').startsWith(prefix))
      .map(s => parseInt((s.reference||'').slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3,'0');
  }

  // ---------- analyses de fabrication ----------
  function getMfgSheet(id){ return state.manufacturingSheets.find(s => s.id === id); }
  function newOperation(nextIndex){ return { id: uid(), repere: nextIndex ? ('E'+nextIndex) : '', designation:'', machine:'', temps:'', controle:false, observation:'' }; }
  function renumberOperations(sheet){
    (sheet.operations||[]).forEach((op,i) => { op.repere = 'E' + (i+1); });
  }
  function generateMfgReference(data, forSheet){
    const year = new Date((forSheet && forSheet.date) || Date.now()).getFullYear();
    const prefix = `AF-${year}-`;
    const nums = (data.manufacturingSheets||[])
      .filter(s => s !== forSheet && (s.reference||'').startsWith(prefix))
      .map(s => parseInt((s.reference||'').slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3,'0');
  }
  function generateFolderReference(data, forFolder){
    const year = new Date((forFolder && forFolder.date) || Date.now()).getFullYear();
    const prefix = `DS-${year}-`;
    const nums = (data.folders||[])
      .filter(f => f !== forFolder && (f.reference||'').startsWith(prefix))
      .map(f => parseInt((f.reference||'').slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3,'0');
  }
  function generateTripReference(data, forTrip){
    const year = new Date((forTrip && forTrip.date) || Date.now()).getFullYear();
    const prefix = `TR-${year}-`;
    const nums = (data.trips||[])
      .filter(t => t !== forTrip && (t.reference||'').startsWith(prefix))
      .map(t => parseInt((t.reference||'').slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3,'0');
  }
  function tripCost(trip){
    const distanceOneWay = parseFloat(trip.distanceKm) || 0;
    const conso = parseFloat(trip.consumptionL100) || 0;
    const fuelPrice = parseFloat(trip.fuelPrice) || 0;
    const tollOneWay = parseFloat(trip.tollPrice) || 0;
    const multiplier = trip.roundTrip ? 2 : 1;
    const distance = distanceOneWay * multiplier;
    const toll = tollOneWay * multiplier;
    const liters = (distance / 100) * conso;
    const fuelCost = liters * fuelPrice;
    const totalCost = fuelCost + toll;
    const costPerKm = distance > 0 ? totalCost / distance : 0;
    const peopleCount = Math.max(1, parseInt(trip.peopleCount) || 1);
    const costPerPerson = totalCost / peopleCount;
    return { liters, fuelCost, toll, totalCost, costPerKm, distance, peopleCount, costPerPerson };
  }
  const HOURS_DAY_NAMES = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
  function mondayOf(date){
    const d = new Date(date);
    const day = d.getDay() || 7; // dimanche(0) -> 7
    d.setDate(d.getDate() - day + 1);
    d.setHours(0,0,0,0);
    return d;
  }
  function roundToQuarterHour(m){
    return Math.round(m/15)*15 % 60;
  }
  function minutesToHM(totalMin){
    const m = ((totalMin % 1440) + 1440) % 1440;
    return { hour: Math.floor(m/60), minute: m%60 };
  }
  function newChantierBlock(){
    return { id: uid(), name:'', startHour:'', startMinute:'', endHour:'', endMinute:'' };
  }
  function newHoursDay(){
    return { status:'normal', chantiers: [newChantierBlock()] };
  }
  function newHoursWeek(weekStartIso){
    return { id: uid(), reference:'', weekStart: weekStartIso, days: Array.from({length:7}, () => newHoursDay()) };
  }
  function generateHoursReference(data, forWeek){
    const year = new Date((forWeek && forWeek.weekStart) || Date.now()).getFullYear();
    const prefix = `HR-${year}-`;
    const nums = (data.hoursWeeks||[])
      .filter(w => w !== forWeek && (w.reference||'').startsWith(prefix))
      .map(w => parseInt((w.reference||'').slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3,'0');
  }
  function hoursFormatDuration(hoursDecimal){
    const totalMin = Math.round(hoursDecimal*60);
    const h = Math.floor(totalMin/60), m = totalMin%60;
    return `${h} h ${String(m).padStart(2,'0')}`;
  }
  function chantierBlockMinutes(c){
    if(c.startHour==='' || c.startHour==null || c.startMinute==='' || c.startMinute==null ||
       c.endHour==='' || c.endHour==null || c.endMinute==='' || c.endMinute==null) return 0;
    let s = parseInt(c.startHour)*60 + parseInt(c.startMinute);
    let e = parseInt(c.endHour)*60 + parseInt(c.endMinute);
    if(e < s) e += 24*60; // passage de minuit
    return Math.max(0, e-s);
  }
  function hoursDayMinutes(day){
    if(day.status && day.status !== 'normal') return 0;
    return (day.chantiers||[]).reduce((sum,c) => sum + chantierBlockMinutes(c), 0);
  }
  function hoursWeekTotalMinutes(week){
    return (week.days||[]).reduce((sum,d) => sum + hoursDayMinutes(d), 0);
  }
  function getOrCreateWeek(weekStartIso){
    let week = state.hoursWeeks.find(w => w.weekStart === weekStartIso);
    if(!week){
      week = newHoursWeek(weekStartIso);
      week.reference = generateHoursReference(state, week);
    }
    return week;
  }
  function hoursExpandDate(dateOrIso){
    const d = new Date(dateOrIso);
    if(hoursExpandedYears) hoursExpandedYears.add(String(d.getFullYear()));
    if(hoursExpandedMonths) hoursExpandedMonths.add(`${d.getFullYear()}-${d.getMonth()}`);
  }
  function hoursSummary(){
    const viewedWeekStart = new Date(selectedWeekStart);
    const viewedYear = viewedWeekStart.getFullYear();
    const viewedMonth = viewedWeekStart.getMonth();
    let weekMin = 0, monthMin = 0;
    const displayedWeek = state.hoursWeeks.find(w => w.weekStart === selectedWeekStart);
    if(displayedWeek) weekMin = hoursWeekTotalMinutes(displayedWeek);
    state.hoursWeeks.forEach(w => {
      (w.days||[]).forEach((day, dayIdx) => {
        const d = new Date(w.weekStart);
        d.setDate(d.getDate() + dayIdx);
        if(d.getFullYear() === viewedYear && d.getMonth() === viewedMonth){
          monthMin += hoursDayMinutes(day);
        }
      });
    });
    return { weekHours: weekMin/60, monthHours: monthMin/60 };
  }
  const HOURS_MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  function hoursTimeLabel(h, m){
    if(h==='' || h==null || m==='' || m==null) return '—';
    return `${String(h).padStart(2,'0')}h${String(m).padStart(2,'0')}`;
  }
  const HOURS_CHANTIER_COLORS = ['#B8912A','#5F7455','#A63D2F','#3B5C7E','#7B5EA7','#C2703D','#4A8577','#9B4F6B'];
  // Relev\u00e9 d'heures d'UNE semaine, au format habituel (utilise dans le PDF de dossier)
  function buildHoursWeekPdfBody(week){
    const company = state.company || {};
    const start = new Date(week.weekStart);
    const days = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(d.getDate()+i); return d; });
    const totalMinutes = (week.days||[]).reduce((s,d) => s + hoursDayMinutes(d), 0);

    // Recap par chantier sur la semaine
    const byChantier = {};
    (week.days||[]).forEach(day => {
      if((day.status||'normal') !== 'normal') return;
      (day.chantiers||[]).forEach(ch => {
        const mins = chantierBlockMinutes(ch);
        if(mins <= 0) return;
        const name = (ch.name||'').trim() || '(sans nom)';
        byChantier[name] = (byChantier[name]||0) + mins;
      });
    });
    const recap = Object.entries(byChantier).sort((a,b) => b[1]-a[1]);

    const contactParts = [];
    if(company.phone) contactParts.push('T\u00e9l. ' + esc(company.phone));
    if(company.email) contactParts.push(esc(company.email));

    return `
  <div class="pdf-doc">
  <div class="letterhead">
    <div class="company-block">
      ${company.logo ? `<img src="${resolvePhotoSrc(company.logo)}" data-photo-ref="${esc(company.logo)}" alt="Logo">` : ''}
      <div>
        <p class="company-name">${esc(company.name || 'Mon Entreprise')}</p>
        <div class="company-meta">
          ${company.address ? esc(company.address) + '<br>' : ''}
          ${contactParts.join(' \u00b7 ')}
        </div>
      </div>
    </div>
    <div class="doc-title-block">
      <p class="doc-title">RELEV\u00c9 D'HEURES</p>
      <div class="doc-ref">${esc(week.reference || '')}</div>
      <div class="doc-date">\u00c9dit\u00e9 le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  <div class="agenda-week">
    <div class="agenda-week-header">
      <span>Semaine du ${days[0].toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} au ${days[6].toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}</span>
      <span class="agenda-week-total">${hoursFormatDuration(totalMinutes/60)}</span>
    </div>
    ${days.map((d,i) => {
      const day = (week.days||[])[i] || {};
      const status = day.status || 'normal';
      const isOff = status !== 'normal';
      const offLabel = status === 'ferie' ? 'F\u00e9ri\u00e9' : (status === 'conge' ? '\ud83c\udfd6\ufe0f Cong\u00e9' : '');
      const chantiers = isOff ? [] : (day.chantiers||[]).filter(ch => chantierBlockMinutes(ch) > 0);
      const dayMin = hoursDayMinutes(day);
      return `
      <div class="agenda-day-row${(chantiers.length||isOff)?'':' agenda-day-empty'}">
        <div class="agenda-day-label">${HOURS_DAY_NAMES[i]} ${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</div>
        <div class="agenda-day-content">
          ${isOff ? `<span class="agenda-off-label">${offLabel}</span>`
                  : (chantiers.length ? chantiers.map(ch => `<div class="agenda-chantier">${esc((ch.name||'').trim() || '(sans nom)')} \u00b7 ${hoursFormatDuration(chantierBlockMinutes(ch)/60)}</div>`).join('')
                                      : '<span class="agenda-empty-label">\u2014</span>')}
        </div>
        <div class="agenda-day-total">${(!isOff && dayMin > 0) ? hoursFormatDuration(dayMin/60) : ''}</div>
      </div>`;
    }).join('')}
  </div>

  <div class="cartouche" style="margin-top:14px;">
    <div><span>Total de la semaine</span><strong>${hoursFormatDuration(totalMinutes/60)}</strong></div>
    <div><span>En d\u00e9cimal</span><strong>${(totalMinutes/60).toFixed(2)} h</strong></div>
  </div>

  ${recap.length >= 2 ? `
  <div class="recap">
    <h4>R\u00e9capitulatif par chantier</h4>
    <table class="recap-table">
      <thead><tr><th>Chantier</th><th>Heures</th></tr></thead>
      <tbody>${recap.map(([name, mins]) => `<tr><td>${esc(name)}</td><td>${hoursFormatDuration(mins/60)}</td></tr>`).join('')}</tbody>
    </table>
  </div>` : ''}

  <div class="signatures">
    <div><span>Signature salari\u00e9</span></div>
    <div><span>Signature employeur</span></div>
  </div>

  <footer>
    <span>${esc(week.reference || '')} \u2014 ${esc(company.name || 'Mon Entreprise')}</span>
    <span>G\u00e9n\u00e9r\u00e9 le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;
  }

  function buildHoursMonthPdfBody(year, month){
    const company = state.company || {};
    const dayData = {};
    state.hoursWeeks.forEach(week => {
      week.days.forEach((day, dayIdx) => {
        const d = new Date(week.weekStart);
        d.setDate(d.getDate() + dayIdx);
        if(d.getFullYear() !== year || d.getMonth() !== month) return;
        const status = day.status || 'normal';
        const chantiers = status === 'normal' ? (day.chantiers||[]).filter(c => chantierBlockMinutes(c) > 0 || (c.name||'').trim()) : [];
        if(!chantiers.length && status === 'normal') return;
        const key = d.toISOString().slice(0,10);
        dayData[key] = {
          date: d,
          status,
          chantiers: chantiers.map(c => ({ name: (c.name||'').trim() || '(sans nom)', minutes: chantierBlockMinutes(c) })),
          totalMinutes: chantiers.reduce((s,c) => s + chantierBlockMinutes(c), 0)
        };
      });
    });
    const allEntries = Object.values(dayData).sort((a,b) => a.date - b.date);
    const totalMinutes = allEntries.reduce((s,e) => s + e.totalMinutes, 0);

    const byChantier = {};
    allEntries.forEach(e => e.chantiers.forEach(c => { byChantier[c.name] = (byChantier[c.name]||0) + c.minutes; }));
    const chantierRecap = Object.entries(byChantier).sort((a,b) => b[1]-a[1]);
    const chantierColor = {};
    chantierRecap.forEach(([name], i) => { chantierColor[name] = HOURS_CHANTIER_COLORS[i % HOURS_CHANTIER_COLORS.length]; });

    const monthLabel = `${HOURS_MONTH_NAMES[month]} ${year}`;

    // Construit la grille calendrier : semaines complètes (Lundi → Dimanche) couvrant tout le mois
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month+1, 0);
    const weeks = [];
    let cursor = mondayOf(firstOfMonth);
    while(true){
      const weekDays = [];
      for(let i=0;i<7;i++){ weekDays.push(new Date(cursor)); cursor.setDate(cursor.getDate()+1); }
      weeks.push(weekDays);
      if(weekDays[6] >= lastOfMonth) break;
    }

    const agendaHtml = weeks
      .filter(weekDays => weekDays.some(d => dayData[d.toISOString().slice(0,10)]))
      .map(weekDays => {
        const weekTotalMin = weekDays.reduce((s,d) => {
          const entry = dayData[d.toISOString().slice(0,10)];
          return s + (entry ? entry.totalMinutes : 0);
        }, 0);
        return `
        <div class="agenda-week">
          <div class="agenda-week-header">
            <span>Semaine du ${weekDays[0].toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})} au ${weekDays[6].toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}</span>
            <span class="agenda-week-total">${hoursFormatDuration(weekTotalMin/60)}</span>
          </div>
          ${weekDays.map((d,i) => {
            const inMonth = d.getMonth() === month;
            const key = d.toISOString().slice(0,10);
            const entry = dayData[key];
            const isOff = entry && entry.status && entry.status !== 'normal';
            const offLabel = entry && entry.status === 'ferie' ? 'Férié' : (entry && entry.status === 'conge' ? '🏖️ Congé' : '');
            return `
              <div class="agenda-day-row${entry?'':' agenda-day-empty'}">
                <div class="agenda-day-label">${HOURS_DAY_NAMES[i]} ${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}${inMonth?'':' <span class=\"agenda-outside\">(hors mois)</span>'}</div>
                <div class="agenda-day-content">
                  ${isOff ? `<span class="agenda-off-label">${offLabel}</span>` : (entry ? entry.chantiers.map(c => `<div class="agenda-chantier"><span class="cal-dot" style="background:${chantierColor[c.name]};"></span>${esc(c.name)} · ${hoursFormatDuration(c.minutes/60)}</div>`).join('') : '<span class="agenda-empty-label">—</span>')}
                </div>
                <div class="agenda-day-total">${entry && !isOff ? hoursFormatDuration(entry.totalMinutes/60) : ''}</div>
              </div>`;
          }).join('')}
        </div>`;
      }).join('') || `<div class="note-bar">Aucune heure enregistrée ce mois-ci.</div>`;

    const legendHtml = chantierRecap.length ? `
      <div class="cal-legend">
        ${chantierRecap.map(([name]) => `<span class="cal-legend-item"><span class="cal-dot" style="background:${chantierColor[name]};"></span>${esc(name)}</span>`).join('')}
      </div>` : '';

    // Graphique en barres : répartition par semaine du mois
    const weekTotals = {};
    allEntries.forEach(e => {
      const wk = mondayOf(e.date).toISOString();
      weekTotals[wk] = (weekTotals[wk]||0) + e.totalMinutes;
    });
    const weekTotalsSorted = Object.entries(weekTotals).sort((a,b) => new Date(a[0]) - new Date(b[0]));
    const maxWeekMinutes = Math.max(1, ...weekTotalsSorted.map(([,m]) => m));
    const barChartHtml = weekTotalsSorted.length >= 2 ? `
      <div class="recap">
        <h4>Répartition par semaine</h4>
        <div class="bar-chart">
          ${weekTotalsSorted.map(([wk,min], i) => `
            <div class="bar-col">
              <div class="bar-value">${hoursFormatDuration(min/60)}</div>
              <div class="bar-track"><div class="bar-fill" style="height:${Math.max(4, (min/maxWeekMinutes)*100)}%;"></div></div>
              <div class="bar-label">Sem. ${i+1}</div>
            </div>
          `).join('')}
        </div>
      </div>` : '';

    const recapHtml = chantierRecap.length >= 2 ? `
      <div class="recap">
        <h4>Récapitulatif par chantier</h4>
        <table class="recap-table">
          <thead><tr><th></th><th>Chantier</th><th>Total</th></tr></thead>
          <tbody>
            ${chantierRecap.map(([name,min]) => `<tr><td><span class="cal-dot" style="background:${chantierColor[name]};"></span></td><td>${esc(name)}</td><td>${hoursFormatDuration(min/60)}</td></tr>`).join('')}
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
        </div>
      </div>
    </div>
    <div class="doc-title-block">
      <p class="doc-title">RELEVÉ D'HEURES</p>
      <div class="doc-ref">${esc(monthLabel)}</div>
      <div class="doc-date">Édité le ${fmtDate(new Date().toISOString())}</div>
    </div>
  </div>

  ${agendaHtml}
  ${legendHtml}

  <div class="recap-columns">
    ${recapHtml}
    ${barChartHtml}
  </div>

  <div class="totals-strip">
    <div><span>Total du mois</span><b>${hoursFormatDuration(totalMinutes/60)}</b></div>
    <div><span>En décimal</span><b>${(totalMinutes/60).toFixed(2)} h</b></div>
  </div>

  <div class="signatures">
    <div class="sig-box"><div class="sig-label">Établi par</div><div class="sig-line">Nom, date et signature</div></div>
    <div class="sig-box"><div class="sig-label">Validé par</div><div class="sig-line">Nom, date et signature</div></div>
  </div>

  <footer>
    <span>${esc(monthLabel)} — ${esc(company.name || 'Mon Entreprise')}</span>
    <span>Généré le ${fmtDate(new Date().toISOString())}</span>
  </footer>
  </div>`;
  }
  function downloadHoursMonth(year, month){
    const body = buildHoursMonthPdfBody(year, month);
    openPrintWindow(`Relevé d'heures - ${HOURS_MONTH_NAMES[month]} ${year}`, body);
  }
  function generateSpacingReference(data, forSpacing){
    const year = new Date((forSpacing && forSpacing.date) || Date.now()).getFullYear();
    const prefix = `RE-${year}-`;
    const nums = (data.spacings||[])
      .filter(s => s !== forSpacing && (s.reference||'').startsWith(prefix))
      .map(s => parseInt((s.reference||'').slice(prefix.length), 10))
      .filter(n => !isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + String(next).padStart(3,'0');
  }
  function spacingResult(s){
    const L = parseFloat(s.totalLength) || 0;
    const W = parseFloat(s.elementWidth) || 0;
    const N = parseInt(s.elementCount) || 0;
    const withEdge = s.edgeSpace !== false;
    const gapsCount = withEdge ? (N + 1) : Math.max(0, N - 1);
    const totalElementsWidth = N * W;
    const remainingSpace = L - totalElementsWidth;
    const gap = gapsCount > 0 ? remainingSpace / gapsCount : 0;
    const positions = [];
    if(N > 0){
      let cursor = withEdge ? gap : 0;
      for(let i = 0; i < N; i++){
        positions.push({ index: i+1, start: cursor, end: cursor + W });
        cursor += W + gap;
      }
    }
    return {
      valid: N > 0 && L > 0,
      warn: gap < -0.01,
      gap, gapsCount, totalElementsWidth, remainingSpace, positions
    };
  }
  function mfgSheetTotals(sheet){
    const ops = sheet.operations || [];
    let totalMinutes = 0;
    ops.forEach(op => { totalMinutes += parseFloat(op.temps) || 0; });
    return { totalMinutes, opsCount: ops.length };
  }
  function formatMinutes(mins){
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if(h === 0) return `${m} min`;
    return `${h} h ${String(m).padStart(2,'0')}`;
  }
  function curr(){ return (state.settings && state.settings.currency) || '€'; }


  function checkDimensionAlert(field, value){
    if(!state.settings.dimensionAlertsEnabled) return null;
    if(value === '' || value == null) return null;
    const num = parseFloat(value);
    if(isNaN(num)) return null;
    if(['longueur','largeur','epaisseur','quantite'].includes(field) && num <= 0){
      return 'Valeur incorrecte : doit être supérieure à 0.';
    }
    if((field === 'longueur' || field === 'largeur') && num > 6000){
      return 'Cette dimension semble anormalement grande (> 6 m). Vérifie l\'unité (mm).';
    }
    return null;
  }

  function sheetTotals(sheet){
    let pieces = 0, linear = 0, surface = 0, volume = 0, volumeWithMargin = 0;
    (sheet.rows||[]).forEach(r => {
      const l = parseFloat(r.longueur) || 0;
      const w = parseFloat(r.largeur) || 0;
      const e = parseFloat(r.epaisseur) || 0;
      const q = parseFloat(r.quantite) || 0;
      const m = parseFloat(r.marge) || 0;
      const rowVolume = (l * w * e * q) / 1_000_000_000;
      pieces += q;
      linear += (l * q) / 1000;
      surface += (l * w * q) / 1_000_000;
      volume += rowVolume;
      volumeWithMargin += rowVolume * (1 + m / 100);
    });
    return { pieces, linear, surface, volume, volumeWithMargin };
  }

  function materialSummary(rows){
    const map = {};
    const order = [];
    (rows||[]).forEach(r => {
      const key = (r.materiau||'').trim() || 'Non spécifié';
      const l = parseFloat(r.longueur) || 0;
      const w = parseFloat(r.largeur) || 0;
      const e = parseFloat(r.epaisseur) || 0;
      const q = parseFloat(r.quantite) || 0;
      const m = parseFloat(r.marge) || 0;
      const rowVolume = (l * w * e * q) / 1_000_000_000;
      if(!map[key]){ map[key] = { pieces:0, linear:0, surface:0, volume:0, volumeWithMargin:0 }; order.push(key); }
      map[key].pieces += q;
      map[key].linear += (l * q) / 1000;
      map[key].surface += (l * w * q) / 1_000_000;
      map[key].volume += rowVolume;
      map[key].volumeWithMargin += rowVolume * (1 + m / 100);
    });
    return order.map(key => ({ key, ...map[key] }));
  }

  // ---------- render ----------
  // Chaque vue n'est reconstruite que quand elle est effectivement affichee (voir switchView) :
  // avant, render() reconstruisait les ~19 vues a chaque sauvegarde meme quand 18 d'entre elles
  // etaient masquees. La table ci-dessous fait le lien entre un nom de vue et ses fonctions de
  // rendu ; switchView() l'utilise aussi pour rafraichir la vue qu'elle vient de reveler.
