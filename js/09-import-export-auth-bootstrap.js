  let pendingImport = null;

  function closeImportConfirm(){
    document.getElementById('importConfirmModal').style.display = 'none';
    pendingImport = null;
  }

  document.getElementById('btnImport').addEventListener('change', e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const imported = JSON.parse(reader.result);
        if(!imported.suppliers) throw new Error('format invalide');
        migrate(imported);
        if(!Array.isArray(imported.debitSheets)) imported.debitSheets = [];
        pendingImport = imported;
        const fileDate = file.lastModified ? new Date(file.lastModified).toLocaleDateString('fr-FR', { day:'numeric', month:'long', year:'numeric' }) : null;
        document.getElementById('importConfirmSummary').innerHTML =
          `Fichier : <strong>${esc(file.name)}</strong>${fileDate ? ` (modifié le ${fileDate})` : ''}<br>`
          + `Contenu : ${imported.suppliers.length} fournisseur(s), ${imported.debitSheets.length} fiche(s) de débit.`;
        document.getElementById('importConfirmModal').style.display = 'flex';
      }catch(err){
        toast("Fichier invalide — l'import a échoué.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btnImportConfirmApply').addEventListener('click', () => {
    if(!pendingImport) return;
    state = pendingImport;
    selectedSupplierId = state.suppliers[0]?.id ?? null;
    selectedSheetId = state.debitSheets[0]?.id ?? null;
    closeImportConfirm();
    save(); render();
    toast('Import réussi.');
  });
  document.getElementById('btnImportConfirmCancel').addEventListener('click', closeImportConfirm);
  document.getElementById('btnImportConfirmClose').addEventListener('click', closeImportConfirm);
  document.getElementById('importConfirmModal').addEventListener('click', e => { if(e.target.id === 'importConfirmModal') closeImportConfirm(); });

  function bindMainEvents(supplier){
    const main = document.getElementById('mainArea');

    main.querySelectorAll('[data-field]').forEach(inp => {
      inp.addEventListener('change', () => {
        supplier[inp.dataset.field] = inp.value;
        save(); renderSidebar();
        if(['phone','email','status'].includes(inp.dataset.field)) renderMain();
      });
    });

    const delSupplierBtn = document.getElementById('btnDeleteSupplier');
    if(delSupplierBtn) bindConfirmDeleteButton(delSupplierBtn, () => {
      trashPut('suppliers', supplier.name, supplier);
      state.suppliers = state.suppliers.filter(s => s.id !== supplier.id);
      selectedSupplierId = state.suppliers[0]?.id ?? null;
      save(); render();
    });

    const toggleNewProduct = document.getElementById('btnToggleNewProduct');
    if(toggleNewProduct) toggleNewProduct.addEventListener('click', () => {
      openNewProductForm = !openNewProductForm;
      render();
      const inp = document.getElementById('newProductName');
      if(inp) inp.focus();
    });

    const saveProductBtn = document.getElementById('btnSaveProduct');
    if(saveProductBtn) saveProductBtn.addEventListener('click', () => {
      const name = document.getElementById('newProductName').value.trim();
      if(!name){ toast('Donnez un nom au produit.'); return; }
      supplier.products = supplier.products || [];
      supplier.products.push({ id: uid(), name, comments: [] });
      openNewProductForm = false;
      save(); render();
    });
    const cancelProductBtn = document.getElementById('btnCancelProduct');
    if(cancelProductBtn) cancelProductBtn.addEventListener('click', () => { openNewProductForm = false; hasUnsavedChanges = false; render(); });

    main.querySelectorAll('[data-toggle-product]').forEach(el => {
      el.addEventListener('click', e => {
        if(e.target.closest('[data-delete-product]')) return;
        const pid = el.dataset.toggleProduct;
        if(openProducts.has(pid)) openProducts.delete(pid); else openProducts.add(pid);
        render();
      });
    });

    main.querySelectorAll('[data-delete-product]').forEach(el => {
      const pid = el.dataset.deleteProduct;
      bindConfirmDeleteButton(el, () => {
        const product = supplier.products.find(p => p.id === pid);
        if(product) (product.comments||[]).forEach(c => deletePhotoRefs(c.photos));
        supplier.products = supplier.products.filter(p => p.id !== pid);
        save(); render();
      }, '?', true);
    });

    main.querySelectorAll('[data-open-comment]').forEach(el => {
      el.addEventListener('click', () => {
        openNewCommentFor = el.dataset.openComment;
        pendingRating = 0; pendingPhotos = []; pendingText = '';
        editingComment = null;
        render();
      });
    });

    const cancelCommentBtn = document.getElementById('btnCancelComment');
    if(cancelCommentBtn) cancelCommentBtn.addEventListener('click', () => {
      openNewCommentFor = null; pendingPhotos = []; pendingRating = 0; pendingText = ''; hasUnsavedChanges = false; render();
    });

    const starPicker = document.getElementById('starPicker');
    if(starPicker) starPicker.addEventListener('click', e => {
      const star = e.target.closest('[data-star]');
      if(!star) return;
      pendingRating = parseInt(star.dataset.star, 10);
      render();
      const ta = document.getElementById('newCommentText');
      if(ta) ta.focus();
    });

    const newCommentTextarea = document.getElementById('newCommentText');
    if(newCommentTextarea) newCommentTextarea.addEventListener('input', () => {
      pendingText = newCommentTextarea.value;
    });

    const photoInput = document.getElementById('newCommentPhoto');
    if(photoInput) photoInput.addEventListener('change', e => {
      const files = Array.from(e.target.files || []);
      if(!files.length) return;
      let remaining = files.length;
      files.forEach(file => {
        resizeImage(file, async dataUrl => {
          const ref = await storePhoto(dataUrl, 'comment');
          pendingPhotos.push(ref);
          remaining--;
          if(remaining === 0) render();
        });
      });
    });
    main.querySelectorAll('[data-remove-pending-photo]').forEach(el => {
      el.addEventListener('click', () => {
        const [removed] = pendingPhotos.splice(parseInt(el.dataset.removePendingPhoto, 10), 1);
        deletePhotoRef(removed);
        render();
      });
    });

    const saveCommentBtn = document.getElementById('btnSaveComment');
    if(saveCommentBtn) saveCommentBtn.addEventListener('click', () => {
      if(pendingRating === 0){ toast('Choisissez une note de 1 à 10.'); return; }
      const product = getProduct(supplier, openNewCommentFor);
      const text = document.getElementById('newCommentText').value.trim();
      product.comments = product.comments || [];
      product.comments.push({
        id: uid(),
        rating: pendingRating,
        text,
        photos: pendingPhotos.slice(),
        date: new Date().toISOString()
      });
      openNewCommentFor = null; pendingPhotos = []; pendingRating = 0; pendingText = '';
      save(); render();
    });

    main.querySelectorAll('[data-edit-comment]').forEach(el => {
      el.addEventListener('click', () => {
        const [pid, cid] = el.dataset.editComment.split('|');
        const product = getProduct(supplier, pid);
        const c = product.comments.find(x => x.id === cid);
        editingComment = { pid, cid };
        editRating = c.rating;
        editText = c.text || '';
        editPhotos = (c.photos || []).slice();
        openNewCommentFor = null;
        render();
      });
    });

    const cancelEditBtn = document.getElementById('btnCancelEditComment');
    if(cancelEditBtn) cancelEditBtn.addEventListener('click', () => {
      editingComment = null; hasUnsavedChanges = false; render();
    });

    const editStarPicker = document.getElementById('editStarPicker');
    if(editStarPicker) editStarPicker.addEventListener('click', e => {
      const star = e.target.closest('[data-edit-star]');
      if(!star) return;
      editRating = parseInt(star.dataset.editStar, 10);
      const ta = document.getElementById('editCommentText');
      editText = ta ? ta.value : editText;
      render();
    });

    const editTextArea = document.getElementById('editCommentText');
    if(editTextArea) editTextArea.addEventListener('input', e => { editText = e.target.value; });

    const editPhotoInput = document.getElementById('editCommentPhoto');
    if(editPhotoInput) editPhotoInput.addEventListener('change', e => {
      const files = Array.from(e.target.files || []);
      if(!files.length) return;
      let remaining = files.length;
      files.forEach(file => {
        resizeImage(file, async dataUrl => {
          const ref = await storePhoto(dataUrl, 'comment');
          editPhotos.push(ref);
          remaining--;
          if(remaining === 0) render();
        });
      });
    });
    main.querySelectorAll('[data-remove-edit-photo]').forEach(el => {
      el.addEventListener('click', () => {
        const [removed] = editPhotos.splice(parseInt(el.dataset.removeEditPhoto, 10), 1);
        deletePhotoRef(removed);
        render();
      });
    });

    const saveEditBtn = document.getElementById('btnSaveEditComment');
    if(saveEditBtn) saveEditBtn.addEventListener('click', () => {
      if(editRating === 0){ toast('Choisissez une note de 1 à 10.'); return; }
      const { pid, cid } = editingComment;
      const product = getProduct(supplier, pid);
      const c = product.comments.find(x => x.id === cid);
      const ta = document.getElementById('editCommentText');
      c.rating = editRating;
      c.text = ta ? ta.value.trim() : editText.trim();
      c.photos = editPhotos.slice();
      editingComment = null;
      save(); render();
    });

    main.querySelectorAll('[data-delete-comment]').forEach(el => {
      const [pid, cid] = el.dataset.deleteComment.split('|');
      bindConfirmDeleteButton(el, () => {
        const product = getProduct(supplier, pid);
        const comment = product.comments.find(c => c.id === cid);
        if(comment) deletePhotoRefs(comment.photos);
        product.comments = product.comments.filter(c => c.id !== cid);
        save(); render();
      }, '?');
    });

    main.querySelectorAll('[data-view-photo]').forEach(el => {
      el.addEventListener('click', async () => {
        const pid = el.dataset.viewPid, cid = el.dataset.viewCid;
        const index = parseInt(el.dataset.viewIndex, 10);
        const product = getProduct(supplier, pid);
        const c = product.comments.find(x => x.id === cid);
        const srcs = await Promise.all((c.photos || []).map(getPhotoDataUrl));
        openLightbox(srcs, index);
      });
    });
  }

  function resizeImage(file, cb){
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width > height){ height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        cb(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // Redimensionne un logo en conservant la transparence (PNG), pour un rendu propre sur le PDF
  function resizeLogo(file, cb){
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 360;
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width > height){ height = Math.round(height * maxDim / width); width = maxDim; }
          else { width = Math.round(width * maxDim / height); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        cb(canvas.toDataURL('image/png'));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function openLightbox(photos, startIndex){
    if(!photos || !photos.length) return;
    let index = startIndex || 0;
    const box = document.createElement('div');
    box.className = 'lightbox';
    function paint(){
      box.innerHTML = `
        <button class="close" aria-label="Fermer">&times;</button>
        ${photos.length > 1 ? `<button class="lb-nav lb-prev" aria-label="Photo précédente">&#8249;</button>` : ''}
        <img src="${photos[index]}" alt="Photo agrandie ${index+1} sur ${photos.length}">
        ${photos.length > 1 ? `<button class="lb-nav lb-next" aria-label="Photo suivante">&#8250;</button>
        <div class="lb-count mono">${index+1} / ${photos.length}</div>` : ''}
      `;
    }
    paint();
    box.addEventListener('click', e => {
      if(e.target === box || e.target.classList.contains('close')) { box.remove(); return; }
      if(e.target.classList.contains('lb-prev')){ index = (index - 1 + photos.length) % photos.length; paint(); return; }
      if(e.target.classList.contains('lb-next')){ index = (index + 1) % photos.length; paint(); return; }
    });
    document.body.appendChild(box);
  }

  applyTheme();
  applyFontSize();
  applyContrast();
  switchSpace('personal');
  switchView('notes');
  render();
  try{ localStorage.removeItem(RPG_SAVE_KEY); }catch(e){} // nettoyage : le jeu ne persiste plus

  // ============ DEMARRAGE AVEC CONNEXION CLOUD ============
  let authMode = 'signin'; // 'signin' | 'signup'
  const authScreen = document.getElementById('authScreen');
  const showApp = () => {
    clearTimeout(authStuckTimer);
    authScreen.style.display = 'none';
  };
  const showAuth = () => { authScreen.style.display = 'flex'; };

  function setAuthMode(mode){
    authMode = mode;
    document.getElementById('authSubmit').textContent = mode === 'signin' ? 'Se connecter' : 'Cr\u00e9er mon compte';
    document.getElementById('authToggle').textContent = mode === 'signin' ? 'Pas encore de compte ? Cr\u00e9er un compte' : 'D\u00e9j\u00e0 un compte ? Se connecter';
    document.getElementById('authPassword').setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
    const err = document.getElementById('authError'); err.style.display = 'none';
  }
  function authError(msg){
    const err = document.getElementById('authError');
    err.textContent = msg; err.style.display = 'block';
    document.getElementById('authForm').style.display = 'block';
    document.getElementById('authLoading').style.display = 'none';
  }
  let authStuckTimer = null;
  function authLoading(msg){
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('authLoading').style.display = 'block';
    document.getElementById('authLoadingMsg').textContent = msg || 'Connexion\u2026';
    // Securite : si rien n'aboutit en 15s, on ne laisse jamais l'ecran bloque
    clearTimeout(authStuckTimer);
    authStuckTimer = setTimeout(() => {
      if(authScreen && authScreen.style.display !== 'none'
         && document.getElementById('authLoading').style.display === 'block'){
        if(lastKnownUser()){
          setCloudStatus('offline');
          showApp();   // compte deja connu : on entre directement
        } else {
          authError('La connexion au serveur est trop lente. R\u00e9essaie, ou continue hors-ligne.');
        }
      }
    }, 15000);
  }

  function formatSyncTime(ms){
    if(!ms) return 'date inconnue';
    return new Date(ms).toLocaleString('fr-FR', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  // Affiche la modale de conflit et attend le choix de l'utilisateur ('local' ou 'cloud')
  function askSyncConflict(localTime, cloudTime){
    return new Promise(resolve => {
      document.getElementById('syncConflictLocalTime').textContent = formatSyncTime(localTime);
      document.getElementById('syncConflictCloudTime').textContent = formatSyncTime(cloudTime);
      const modal = document.getElementById('syncConflictModal');
      modal.style.display = 'flex';
      const btnLocal = document.getElementById('btnSyncKeepLocal');
      const btnCloud = document.getElementById('btnSyncKeepCloud');
      const btnExportFirst = document.getElementById('btnSyncExportFirst');
      const cleanup = () => {
        modal.style.display = 'none';
        btnLocal.removeEventListener('click', onLocal);
        btnCloud.removeEventListener('click', onCloud);
        btnExportFirst.removeEventListener('click', onExportFirst);
      };
      const onLocal = () => { cleanup(); resolve('local'); };
      const onCloud = () => { cleanup(); resolve('cloud'); };
      const onExportFirst = () => { document.getElementById('btnExport').click(); };
      btnLocal.addEventListener('click', onLocal);
      btnCloud.addEventListener('click', onCloud);
      btnExportFirst.addEventListener('click', onExportFirst);
    });
  }

  // Applique la fusion local <-> cloud pour des donnees recuperees du cloud.
  // Si les deux versions ont divergé (edition locale ET modif cloud entre-temps),
  // on demande a l'utilisateur plutot que d'ecraser silencieusement l'une des deux.
  async function resolveCloudSync(cloudData){
    const localTime = new Date(loadedUpdatedAt || 0).getTime();
    const cloudTime = new Date(cloudData.updatedAt || 0).getTime();
    const isConflict = hasLocalEdits && cloudTime > localTime + 1000;
    let keep;
    if(isConflict){
      keep = await askSyncConflict(localTime, cloudTime);
    } else {
      keep = (hasLocalEdits || localTime > cloudTime + 1000) ? 'local' : 'cloud';
    }
    if(keep === 'cloud'){
      migrate(cloudData); state = cloudData;
      loadedUpdatedAt = state.updatedAt || null;
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
      render();
    } else {
      await withTimeout(cloudPush(), 12000, null);
    }
  }

  // Apres connexion reussie : fusionner cloud <-> local, puis lancer l'app
  async function onAuthenticated(){
    authLoading('Chargement de tes donn\u00e9es\u2026');
    try {
      // Jamais plus de 12s d'attente : au pire on ouvre sur les donnees locales
      const cloudData = await withTimeout(cloudPull(), 12000, undefined);
      if(cloudData){
        // Si ce qui est sur l'appareil est plus recent que le cloud (modification
        // faite juste avant de fermer), on garde le local et on le renvoie.
        // En cas de divergence reelle entre les deux, on demande a l'utilisateur.
        await resolveCloudSync(cloudData);
        setCloudStatus('saved');
      } else if(cloudData === null){
        // Compte vide : on y envoie les donnees locales
        await withTimeout(cloudPush(), 12000, null);
        setCloudStatus('saved');
      } else {
        // Delai depasse : on ouvre en local, la synchro reprendra toute seule
        setCloudStatus('offline');
      }
    } catch(e){
      setCloudStatus('offline');
    }
    render();
    showApp();   // quoi qu'il arrive, on entre dans l'app
  }

  document.getElementById('authToggle').addEventListener('click', () => setAuthMode(authMode === 'signin' ? 'signup' : 'signin'));

  document.getElementById('authSubmit').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim();
    const pwd = document.getElementById('authPassword').value;
    if(!email || !pwd){ authError('Renseigne ton e-mail et ton mot de passe.'); return; }
    if(pwd.length < 6){ authError('Le mot de passe doit faire au moins 6 caract\u00e8res.'); return; }
    if(!sb){ authError('Connexion au serveur impossible. V\u00e9rifie ta connexion internet.'); return; }
    authLoading(authMode === 'signin' ? 'Connexion\u2026' : 'Cr\u00e9ation du compte\u2026');
    try {
      let res;
      if(authMode === 'signin') res = await sb.auth.signInWithPassword({ email, password: pwd });
      else res = await sb.auth.signUp({ email, password: pwd });
      if(res.error){
        const m = res.error.message || '';
        if(/invalid login/i.test(m)) authError('E-mail ou mot de passe incorrect.');
        else if(/already registered|already exists/i.test(m)) authError('Ce compte existe d\u00e9j\u00e0 \u2014 connecte-toi.');
        else if(/confirm/i.test(m)) authError('V\u00e9rifie ta bo\u00eete mail pour confirmer ton compte, puis connecte-toi.');
        else authError(m || 'Une erreur est survenue.');
        return;
      }
      if(!res.data || !res.data.user || !res.data.session){
        authError('Compte cr\u00e9\u00e9. V\u00e9rifie ta bo\u00eete mail pour le confirmer, puis connecte-toi.');
        setAuthMode('signin');
        return;
      }
      cloudUser = res.data.user;
      rememberUser(cloudUser);
      clearSignedOut();
      await onAuthenticated();
    } catch(e){
      authError('Erreur de connexion. R\u00e9essaie.');
    }
  });

  document.getElementById('authOffline').addEventListener('click', () => {
    clearSignedOut();
    setCloudStatus('offline');
    showApp();
    warnLocalStorageOnce();
  });

  // ============ MOT DE PASSE OUBLIE ============
  function showResetRequestForm(){
    document.getElementById('authForm').style.display = 'none';
    document.getElementById('authResetNewPasswordForm').style.display = 'none';
    document.getElementById('authResetRequestForm').style.display = 'block';
    document.getElementById('authResetRequestSent').style.display = 'none';
    document.getElementById('authResetRequestError').style.display = 'none';
    document.getElementById('authResetEmail').value = document.getElementById('authEmail').value.trim();
  }
  function showSigninForm(){
    document.getElementById('authResetRequestForm').style.display = 'none';
    document.getElementById('authResetNewPasswordForm').style.display = 'none';
    document.getElementById('authForm').style.display = 'block';
  }

  document.getElementById('authForgotLink').addEventListener('click', showResetRequestForm);
  document.getElementById('authResetRequestCancel').addEventListener('click', showSigninForm);

  document.getElementById('authResetRequestSubmit').addEventListener('click', async () => {
    const email = document.getElementById('authResetEmail').value.trim();
    const errEl = document.getElementById('authResetRequestError');
    const sentEl = document.getElementById('authResetRequestSent');
    errEl.style.display = 'none';
    sentEl.style.display = 'none';
    if(!email){ errEl.textContent = 'Renseigne ton adresse e-mail.'; errEl.style.display = 'block'; return; }
    if(!sb){ errEl.textContent = 'Connexion au serveur impossible. Vérifie ta connexion internet.'; errEl.style.display = 'block'; return; }
    const btn = document.getElementById('authResetRequestSubmit');
    btn.disabled = true;
    try {
      const cleanUrl = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: cleanUrl });
      if(error){ errEl.textContent = error.message || 'Une erreur est survenue.'; errEl.style.display = 'block'; }
      else { sentEl.textContent = `Un e-mail a été envoyé à ${email}. Suis le lien qu'il contient pour choisir un nouveau mot de passe.`; sentEl.style.display = 'block'; }
    } catch(e){
      errEl.textContent = 'Erreur de connexion. Réessaie.'; errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('authResetNewSubmit').addEventListener('click', async () => {
    const pwd = document.getElementById('authNewPassword').value;
    const errEl = document.getElementById('authResetNewError');
    errEl.style.display = 'none';
    if(!pwd || pwd.length < 6){ errEl.textContent = 'Le mot de passe doit faire au moins 6 caractères.'; errEl.style.display = 'block'; return; }
    if(!sb){ errEl.textContent = 'Connexion au serveur impossible.'; errEl.style.display = 'block'; return; }
    const btn = document.getElementById('authResetNewSubmit');
    btn.disabled = true;
    try {
      const { data, error } = await sb.auth.updateUser({ password: pwd });
      if(error){ errEl.textContent = error.message || 'Une erreur est survenue.'; errEl.style.display = 'block'; btn.disabled = false; return; }
      toast('Mot de passe mis à jour.');
      cloudUser = (data && data.user) ? data.user : cloudUser;
      if(cloudUser) rememberUser(cloudUser);
      clearSignedOut();
      document.getElementById('authResetNewPasswordForm').style.display = 'none';
      await onAuthenticated();
    } catch(e){
      errEl.textContent = 'Erreur de connexion. Réessaie.'; errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
    }
  });

  // Lien recu par e-mail (reinitialisation de mot de passe) : Supabase renvoie ici avec
  // #access_token=...&type=recovery dans l'URL. On l'intercepte pour ouvrir le formulaire
  // de choix du nouveau mot de passe, sans jamais renvoyer vers l'app tant qu'il n'est pas defini.
  function checkPasswordRecoveryLink(){
    const hash = window.location.hash || '';
    if(!sb || hash.indexOf('type=recovery') === -1) return false;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if(!access_token || !refresh_token) return false;
    history.replaceState(null, '', window.location.pathname + window.location.search);
    sb.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      showAuth();
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('authResetRequestForm').style.display = 'none';
      document.getElementById('authLoading').style.display = 'none';
      if(error){
        const errEl = document.getElementById('authResetNewError');
        errEl.textContent = "Ce lien de réinitialisation n'est plus valide. Refais une demande.";
        errEl.style.display = 'block';
        document.getElementById('authResetNewPasswordForm').style.display = 'block';
      } else {
        document.getElementById('authResetNewPasswordForm').style.display = 'block';
      }
    });
    return true;
  }
  const isPasswordRecovery = checkPasswordRecoveryLink();

  // Entree valide le formulaire
  ['authEmail','authPassword'].forEach(id => document.getElementById(id).addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('authSubmit').click();
  }));
  document.getElementById('authResetEmail').addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('authResetRequestSubmit').click();
  });
  document.getElementById('authNewPassword').addEventListener('keydown', e => {
    if(e.key === 'Enter') document.getElementById('authResetNewSubmit').click();
  });

  // Reprend la main quand la session revient (jeton renouvele, retour en ligne...)
  function attachAuthWatcher(){
    if(!sb || !sb.auth || !sb.auth.onAuthStateChange) return;
    sb.auth.onAuthStateChange((event, session) => {
      if(session && session.user){
        const isNew = !cloudUser || cloudUser.id !== session.user.id;
        cloudUser = session.user;
        rememberUser(cloudUser);
        if(typeof refreshCloudAccountRow === 'function') refreshCloudAccountRow();
        setCloudStatus('saved');
        // Session retrouvee alors qu'on tournait en local : on recupere les donnees du compte
        if(isNew && authScreen.style.display === 'none'){ cloudPull().then(d => { if(d){ migrate(d); state = d; try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(_){} render(); } }); }
      } else if(event === 'SIGNED_OUT'){
        cloudUser = null;
        setCloudStatus('offline');
      }
    });
  }

  // Au chargement.
  // Regle d'or : si un compte a deja ete utilise sur cet appareil, on ouvre l'app directement
  // avec les donnees locales. La session est verifiee en arriere-plan, sans bloquer ni
  // renvoyer vers l'ecran de connexion (evite de redemander le mot de passe hors-ligne).
  (async () => {
    // Lien de reinitialisation de mot de passe : on laisse checkPasswordRecoveryLink()
    // gerer entierement l'ecran (formulaire nouveau mot de passe), sans ouvrir l'app.
    if(isPasswordRecovery) return;
    // Y a-t-il deja des donnees sur cet appareil ?
    let hasLocalData = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        const d = JSON.parse(raw);
        hasLocalData = !!d && ['suppliers','notes','budgetEntries','hoursWeeks','debitSheets','folders','recipes','trips']
          .some(k => Array.isArray(d[k]) && d[k].length);
      }
    } catch(e){}

    if(!sb){ showApp(); setCloudStatus('offline'); warnLocalStorageOnce(); return; }
    attachAuthWatcher();
    // Deconnexion volontaire : on repasse toujours par l'ecran de connexion
    const known = wasSignedOut() ? null : (lastKnownUser() || (hasLocalData ? { id: null, email: null } : null));

    if(known){
      // Ouverture immediate sur les donnees locales
      showApp();   // ouverture immediate, jamais d'ecran de connexion
      setCloudStatus(known.id ? 'saving' : 'offline');
      cloudUser = known.id ? { id: known.id, email: known.email } : null;
      if(typeof refreshCloudAccountRow === 'function') refreshCloudAccountRow();
      // Verification de la session en arriere-plan (max 8s), sans jamais bloquer l'app
      try {
        const data = await withTimeout(sb.auth.getSession().then(r => r.data).catch(() => null), 8000, null);
        if(data && data.session && data.session.user){
          cloudUser = data.session.user;
          rememberUser(cloudUser);
          if(typeof refreshCloudAccountRow === 'function') refreshCloudAccountRow();
          const cloudData = await withTimeout(cloudPull(), 12000, undefined);
          if(cloudData){
            await resolveCloudSync(cloudData);
          }
          setCloudStatus('saved');
        } else {
          setCloudStatus('offline');
        }
      } catch(e){ setCloudStatus('offline'); }
      return;
    }

    // Aucun compte connu et aucune donnee : ecran de connexion
    try {
      const data = await withTimeout(sb.auth.getSession().then(r => r.data).catch(() => null), 8000, null);
      if(data && data.session && data.session.user){
        cloudUser = data.session.user;
        rememberUser(cloudUser);
        showAuth();
        await onAuthenticated();
      } else {
        setAuthMode('signin');
        showAuth();
      }
    } catch(e){
      setAuthMode('signin');
      showAuth();
    }
  })();
  // =======================================================

  // Retour sur l'appli / retour du reseau : on retente la synchro sans jamais rouvrir la connexion
  async function tryResumeCloud(){
    if(!sb || !lastKnownUser() || authScreen.style.display !== 'none') return;
    try {
      const data = await withTimeout(sb.auth.getSession().then(r => r.data), 8000, null);
      if(data && data.session && data.session.user){
        cloudUser = data.session.user;
        rememberUser(cloudUser);
        if(typeof refreshCloudAccountRow === 'function') refreshCloudAccountRow();
        setCloudStatus('saving');
        await cloudPush();   // renvoie les modifications faites hors-ligne
      }
    } catch(e){}
  }
  document.addEventListener('visibilitychange', () => { if(!document.hidden) tryResumeCloud(); });
  window.addEventListener('online', tryResumeCloud);
  window.addEventListener('pageshow', () => tryResumeCloud());

  // ============ INSTALLATION PWA ============
  let deferredInstallPrompt = null;
  const btnInstallApp = document.getElementById('btnInstallApp');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btnInstallApp.style.display = '';
  });
  btnInstallApp.addEventListener('click', async () => {
    if(!deferredInstallPrompt) return;
    btnInstallApp.disabled = true;
    deferredInstallPrompt.prompt();
    try { await deferredInstallPrompt.userChoice; } catch(e){}
    deferredInstallPrompt = null;
    btnInstallApp.style.display = 'none';
    btnInstallApp.disabled = false;
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    btnInstallApp.style.display = 'none';
    toast('Application installée.');
  });

  // Alerte avant de fermer l'onglet si des champs ont été modifiés sans être encore enregistrés
  const DIRTY_FIELD_SELECTOR = '.name-input, .cat-input, .contact-input, #sheetTitle, #sheetClient, #sheetDate, #sheetNote, #sheetOperator, #sheetReference, #sheetRowsBody input, #newCommentText, #editCommentText, #newProductName, #mfgTitle, #mfgClient, #mfgDate, #mfgNote, #mfgOperator, #mfgReference, #mfgOperationsBody input, #folderTitle, #folderClient, #folderDate, #folderNote, #tripTitle, #tripDate, #tripDistance, #tripConsumption, #tripFuelPrice, #tripToll, #tripNote, #spacingTitle, #spacingDate, #spacingLength, #spacingWidth, #spacingCount, #spacingNote, #noteTitle, #noteContent, #recipeTitle, #recipeComments, [data-ingredient-text], .hours-chantier-name';
  document.body.addEventListener('input', e => {
    if(e.target.matches && e.target.matches(DIRTY_FIELD_SELECTOR)) hasUnsavedChanges = true;
  });
  window.addEventListener('beforeunload', e => {
    if(hasUnsavedChanges){
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Échap ferme la visionneuse photo ou la modale actuellement ouverte, où qu'on soit dans l'app
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    const lightbox = document.querySelector('.lightbox');
    if(lightbox){ lightbox.remove(); return; }
    if(document.getElementById('gameModal').style.display === 'flex'){ closeGameModal(); return; }
    if(document.getElementById('featuresModal').style.display === 'flex'){ closeFeaturesModal(); return; }
    if(document.getElementById('settingsModal').style.display === 'flex'){ closeSettingsModal(); return; }
    if(document.getElementById('companyModal').style.display === 'flex'){ closeCompanyModal(); return; }
    if(document.getElementById('libraryModal').style.display === 'flex'){ closeLibraryModal(); return; }
    if(document.getElementById('importConfirmModal').style.display === 'flex'){ closeImportConfirm(); return; }
  });
