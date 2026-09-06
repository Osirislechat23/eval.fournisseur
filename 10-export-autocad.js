/* ============================================================================
   10-export-autocad.js — Export d'une fiche de débit vers AutoCAD
   ----------------------------------------------------------------------------
   Module autonome : il ne modifie aucun autre fichier.
   Il ajoute un bouton dans la barre d'outils de la fiche de débit et propose
   deux façons d'envoyer les pièces dans AutoCAD :
     1. un texte à copier-coller directement dans la ligne de commande
     2. un fichier DXF à télécharger (contient en plus les calques et le texte)
   Les pièces sont générées à l'échelle 1:1, en millimètres.
   ========================================================================== */
(function () {
  'use strict';

  var GAP = 50;          // espace entre pièces (mm)
  var MAX_WIDTH = 3000;  // largeur du plan avant retour à la ligne (mm)

  /* ---------- Lecture des lignes depuis le tableau affiché ----------
     On repère les colonnes par leur intitulé plutôt que par une classe :
     le module reste valable même si la structure interne change.          */

  function normalise(s) {
    return (s || '').toString().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function valeurCellule(cellule) {
    if (!cellule) return '';
    var champ = cellule.querySelector('input, select, textarea');
    if (champ) return (champ.value || '').trim();
    return (cellule.textContent || '').trim();
  }

  function lireLignes() {
    var zone = document.getElementById('debitMainArea');
    if (!zone) return [];
    var table = zone.querySelector('table.debit-table, .debit-table table, table');
    if (!table) return [];

    var entetes = Array.prototype.map.call(
      table.querySelectorAll('thead th'), function (th) { return normalise(th.textContent); });

    function colonne() {
      for (var i = 0; i < arguments.length; i++) {
        var cherche = arguments[i];
        for (var j = 0; j < entetes.length; j++) {
          if (entetes[j].indexOf(cherche) === 0) return j;
        }
      }
      return -1;
    }

    var cRepere = colonne('repere', 'rep'),
        cDesign = colonne('designation', 'design'),
        cLong   = colonne('longueur', 'long'),
        cLarg   = colonne('largeur', 'larg'),
        cEp     = colonne('epaisseur', 'ep'),
        cQte    = colonne('quantite', 'qte', 'qt'),
        cMat    = colonne('materiau', 'mat');

    if (cLong < 0 || cLarg < 0) return [];

    var lignes = [];
    Array.prototype.forEach.call(table.querySelectorAll('tbody tr'), function (tr) {
      var td = tr.querySelectorAll('td');
      if (!td.length) return;
      var L = parseFloat(valeurCellule(td[cLong]).replace(',', '.'));
      var l = parseFloat(valeurCellule(td[cLarg]).replace(',', '.'));
      if (!(L > 0) || !(l > 0)) return;   // ligne vide ou incomplète : ignorée
      lignes.push({
        longueur: L,
        largeur: l,
        epaisseur: cEp >= 0 ? valeurCellule(td[cEp]) : '',
        quantite: Math.max(1, parseInt(cQte >= 0 ? valeurCellule(td[cQte]) : '1', 10) || 1),
        repere: cRepere >= 0 ? valeurCellule(td[cRepere]) : '',
        designation: cDesign >= 0 ? valeurCellule(td[cDesign]) : '',
        materiau: cMat >= 0 ? valeurCellule(td[cMat]) : ''
      });
    });
    return lignes;
  }

  /* ---------- Rangement des pièces ----------
     Placement en étagères : de gauche à droite, retour à la ligne au-delà
     de la largeur maximale. Les pièces les plus larges d'abord, ce qui
     limite les vides.                                                     */

  function ranger(lignes) {
    var pieces = [];
    lignes.forEach(function (r) {
      for (var i = 0; i < r.quantite; i++) {
        pieces.push({
          L: r.longueur, l: r.largeur, ep: r.epaisseur,
          materiau: r.materiau, designation: r.designation,
          repere: r.repere + (r.quantite > 1 ? ' (' + (i + 1) + '/' + r.quantite + ')' : '')
        });
      }
    });
    pieces.sort(function (a, b) { return b.l - a.l; });

    var x = 0, y = 0, hauteurRangee = 0;
    pieces.forEach(function (p) {
      if (x > 0 && x + p.L > MAX_WIDTH) {
        x = 0; y -= (hauteurRangee + GAP * 2); hauteurRangee = 0;
      }
      p.x = x;
      p.y = y - p.l;
      x += p.L + GAP;
      hauteurRangee = Math.max(hauteurRangee, p.l);
    });
    return pieces;
  }

  var arrondi = function (n) { return (Math.round(n * 1000) / 1000).toString(); };

  /* ---------- 1. Texte à coller dans la ligne de commande AutoCAD ---------- */

  function scriptAutocad(pieces, avecTextes) {
    var out = [];
    pieces.forEach(function (p) {
      out.push('_.PLINE');
      out.push(arrondi(p.x) + ',' + arrondi(p.y));
      out.push(arrondi(p.x + p.L) + ',' + arrondi(p.y));
      out.push(arrondi(p.x + p.L) + ',' + arrondi(p.y + p.l));
      out.push(arrondi(p.x) + ',' + arrondi(p.y + p.l));
      out.push('_C');                        // ferme le contour
    });

    if (avecTextes) {
      pieces.forEach(function (p) {
        var h = Math.max(8, Math.min(30, p.l / 7));
        var libelle = [p.repere, p.designation].filter(Boolean).join(' - ');
        var cotes = arrondi(p.L) + ' x ' + arrondi(p.l) + (p.ep ? ' x ' + p.ep : '');
        if (p.materiau) cotes += '  ' + p.materiau;
        if (libelle) {
          out.push('_.TEXT');
          out.push(arrondi(p.x + h * 0.6) + ',' + arrondi(p.y + p.l - h * 1.8));
          out.push(arrondi(h));
          out.push('0');
          out.push(sansAccents(libelle));
        }
        out.push('_.TEXT');
        out.push(arrondi(p.x + h * 0.6) + ',' + arrondi(p.y + h * 0.8));
        out.push(arrondi(h * 0.85));
        out.push('0');
        out.push(sansAccents(cotes));
      });
    }
    return out.join('\n') + '\n';
  }

  function sansAccents(s) {
    return (s || '').toString().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');
  }

  /* ---------- 2. Fichier DXF (version R12, la plus universelle) ---------- */

  function paire(code, valeur) { return code + '\n' + valeur + '\n'; }

  function calque(nom, couleur) {
    return paire(0, 'LAYER') + paire(2, nom) + paire(70, '0') +
           paire(62, String(couleur)) + paire(6, 'CONTINUOUS');
  }

  function rectangleDxf(nom, x, y, w, h) {
    var s = paire(0, 'POLYLINE') + paire(8, nom) + paire(66, '1') + paire(70, '1');
    [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(function (pt) {
      s += paire(0, 'VERTEX') + paire(8, nom) +
           paire(10, arrondi(pt[0])) + paire(20, arrondi(pt[1])) + paire(30, '0.0');
    });
    return s + paire(0, 'SEQEND') + paire(8, nom);
  }

  function texteDxf(nom, x, y, h, txt) {
    return paire(0, 'TEXT') + paire(8, nom) +
           paire(10, arrondi(x)) + paire(20, arrondi(y)) + paire(30, '0.0') +
           paire(40, arrondi(h)) + paire(1, sansAccents(txt).slice(0, 80));
  }

  function construireDxf(pieces, titre, client) {
    var ents = '';
    pieces.forEach(function (p) {
      ents += rectangleDxf('PIECES', p.x, p.y, p.L, p.l);
      var h = Math.max(8, Math.min(30, p.l / 7));
      var libelle = [p.repere, p.designation].filter(Boolean).join(' - ');
      if (libelle) ents += texteDxf('REPERES', p.x + h * 0.6, p.y + p.l - h * 1.8, h, libelle);
      var cotes = arrondi(p.L) + ' x ' + arrondi(p.l) + (p.ep ? ' x ' + p.ep : '') +
                  (p.materiau ? '  ' + p.materiau : '');
      ents += texteDxf('COTES', p.x + h * 0.6, p.y + h * 0.8, h * 0.85, cotes);
    });
    ents += texteDxf('CARTOUCHE', 0, GAP * 2, 60, titre || 'Fiche de debit');
    ents += texteDxf('CARTOUCHE', 0, GAP * 2 - 80, 35,
      (client ? 'Client: ' + client + '   |   ' : '') +
      'Pieces: ' + pieces.length + '   |   Unites: mm   |   Echelle 1:1');

    var minY = Math.min.apply(null, pieces.map(function (p) { return p.y; })) - GAP;
    var maxX = Math.max.apply(null, pieces.map(function (p) { return p.x + p.L; })) + GAP;

    return paire(0, 'SECTION') + paire(2, 'HEADER') +
           paire(9, '$ACADVER') + paire(1, 'AC1009') +
           paire(9, '$INSUNITS') + paire(70, '4') +
           paire(9, '$EXTMIN') + paire(10, '0.0') + paire(20, arrondi(minY)) + paire(30, '0.0') +
           paire(9, '$EXTMAX') + paire(10, arrondi(maxX)) + paire(20, arrondi(GAP * 2 + 60)) + paire(30, '0.0') +
           paire(0, 'ENDSEC') +
           paire(0, 'SECTION') + paire(2, 'TABLES') +
           paire(0, 'TABLE') + paire(2, 'LAYER') + paire(70, '4') +
           calque('PIECES', 7) + calque('REPERES', 3) + calque('COTES', 4) + calque('CARTOUCHE', 1) +
           paire(0, 'ENDTAB') + paire(0, 'ENDSEC') +
           paire(0, 'SECTION') + paire(2, 'ENTITIES') + ents + paire(0, 'ENDSEC') +
           paire(0, 'EOF');
  }

  /* ---------- Fenêtre de dialogue ---------- */

  function titreFiche() {
    var zone = document.getElementById('debitMainArea');
    if (!zone) return { titre: 'Fiche de debit', client: '' };
    var champs = zone.querySelectorAll('.sheet-header-form input, .sheet-title-input');
    var titre = '', client = '', ref = '';
    Array.prototype.forEach.call(zone.querySelectorAll('.field'), function (f) {
      var lab = normalise((f.querySelector('label') || {}).textContent);
      var inp = f.querySelector('input');
      if (!inp) return;
      if (lab.indexOf('client') === 0) client = inp.value;
      if (lab.indexOf('titre') === 0 || lab.indexOf('intitule') === 0) titre = inp.value;
      if (lab.indexOf('ref') === 0) ref = inp.value;
    });
    if (!titre) {
      var t = zone.querySelector('.sheet-title-input, #sheetTitle');
      if (t) titre = t.value || '';
    }
    return { titre: [ref, titre].filter(Boolean).join(' - ') || 'Fiche de debit', client: client, ref: ref || titre };
  }

  function ouvrirFenetre() {
    var lignes = lireLignes();
    if (!lignes.length) {
      alert("Aucune pièce exploitable.\n\nRenseigne au moins une ligne avec une longueur et une largeur.");
      return;
    }
    var pieces = ranger(lignes);
    var info = titreFiche();

    var fond = document.createElement('div');
    fond.id = 'acadOverlay';
    fond.style.cssText =
      'position:fixed;inset:0;z-index:3000;background:rgba(15,22,40,.6);display:flex;' +
      'align-items:center;justify-content:center;padding:16px;';

    var boite = document.createElement('div');
    boite.style.cssText =
      'background:var(--paper,#F7F5EF);color:var(--ink,#1B2A4A);border-radius:14px;' +
      'max-width:640px;width:100%;max-height:92vh;overflow-y:auto;padding:22px 20px;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.35);font-family:"IBM Plex Sans",system-ui,sans-serif;';

    boite.innerHTML =
      '<h3 style="margin:0 0 4px;font-family:Fraunces,Georgia,serif;font-size:19px;">📐 Envoyer vers AutoCAD</h3>' +
      '<p style="margin:0 0 14px;font-size:12.5px;color:var(--text-dim,#6B6559);line-height:1.55;">' +
        pieces.length + ' pièce' + (pieces.length > 1 ? 's' : '') +
        ' à l’échelle 1:1, en millimètres. Colle le texte dans la ligne de commande d’AutoCAD : ' +
        'les contours se tracent tout seuls.</p>' +

      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:10px;cursor:pointer;">' +
        '<input type="checkbox" id="acadTextes"> Ajouter les repères et les cotes en texte' +
      '</label>' +

      '<textarea id="acadScript" readonly style="width:100%;height:190px;font-family:\'IBM Plex Mono\',monospace;' +
        'font-size:11.5px;line-height:1.45;padding:10px;border:1px solid var(--line,#DCD6C8);border-radius:8px;' +
        'background:var(--paper-raised,#FBFAF5);color:inherit;resize:vertical;"></textarea>' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">' +
        '<button id="acadCopier" class="btn btn-gold" style="flex:1;min-width:150px;">📋 Copier le texte</button>' +
        '<button id="acadDxf" class="btn btn-line">⬇ Fichier DXF</button>' +
        '<button id="acadFermer" class="btn btn-line">Fermer</button>' +
      '</div>' +

      '<details style="margin-top:14px;font-size:12.5px;color:var(--text-dim,#6B6559);">' +
        '<summary style="cursor:pointer;font-weight:600;">Comment coller dans AutoCAD ?</summary>' +
        '<ol style="margin:8px 0 0;padding-left:18px;line-height:1.7;">' +
          '<li>Ouvre un dessin vide, unités en <strong>millimètres</strong>.</li>' +
          '<li>Clique dans la <strong>ligne de commande</strong> (en bas).</li>' +
          '<li>Colle (Ctrl+V) puis appuie sur Entrée.</li>' +
          '<li>Tape <code>Z</code> puis <code>E</code> pour cadrer sur les pièces.</li>' +
        '</ol>' +
        '<p style="margin:8px 0 0;line-height:1.6;">Si tu coches les textes et qu’ils ne s’affichent pas, ' +
        'c’est que ton style de texte impose une hauteur fixe : passe-la à 0 dans la commande ' +
        '<code>STYLE</code>, ou utilise plutôt le fichier DXF.</p>' +
      '</details>';

    fond.appendChild(boite);
    document.body.appendChild(fond);

    var zoneTexte = boite.querySelector('#acadScript');
    var caseTextes = boite.querySelector('#acadTextes');

    function rafraichir() {
      zoneTexte.value = scriptAutocad(pieces, caseTextes.checked);
    }
    rafraichir();
    caseTextes.addEventListener('change', rafraichir);

    function fermer() { if (fond.parentNode) fond.parentNode.removeChild(fond); }
    fond.addEventListener('click', function (e) { if (e.target === fond) fermer(); });
    boite.querySelector('#acadFermer').addEventListener('click', fermer);

    boite.querySelector('#acadCopier').addEventListener('click', function () {
      var bouton = this;
      var fini = function () {
        bouton.textContent = '✓ Copié';
        setTimeout(function () { bouton.textContent = '📋 Copier le texte'; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(zoneTexte.value).then(fini, function () {
          zoneTexte.select(); document.execCommand('copy'); fini();
        });
      } else {
        zoneTexte.select(); document.execCommand('copy'); fini();
      }
    });

    boite.querySelector('#acadDxf').addEventListener('click', function () {
      var contenu = construireDxf(pieces, info.titre, info.client);
      var blob = new Blob([contenu], { type: 'application/dxf' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (info.ref || 'fiche-debit').replace(/[^\w\-]+/g, '-') + '.dxf';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
  }

  /* ---------- Insertion du bouton ----------
     On ne dépend pas d'une classe précise : plusieurs points d'accroche sont
     essayés, et en dernier recours le bouton crée sa propre barre en haut de
     la fiche. Ainsi le module reste valable même si le reste du code évolue. */

  var LOG = '[export-autocad]';

  function zoneFiche() {
    return document.getElementById('debitMainArea') ||
           document.querySelector('#layoutDebit .main') ||
           null;
  }

  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  }

  function creerBouton() {
    var b = document.createElement('button');
    b.id = 'btnExportAutocad';
    b.className = 'btn btn-line no-lock';
    b.type = 'button';
    b.textContent = '📐 AutoCAD';
    b.title = 'Copier les pièces dans AutoCAD, ou télécharger un DXF';
    b.addEventListener('click', function (e) { e.preventDefault(); ouvrirFenetre(); });
    return b;
  }

  function poserBouton() {
    var zone = zoneFiche();
    if (!zone) return false;
    if (document.getElementById('btnExportAutocad')) return true;   // déjà posé
    if (!visible(zone)) return false;                               // vue non affichée

    // 1er choix : la barre d'actions de la fiche, à côté des autres boutons
    var barre = zone.querySelector('.sheet-toolbar-actions');

    // 2e choix : n'importe quel conteneur de boutons en haut de la fiche
    if (!barre) {
      var candidat = zone.querySelector('.sheet-toolbar, .toolbar, .main-toolbar');
      if (candidat) barre = candidat;
    }

    // 3e choix : juste avant le bouton PDF, où qu'il soit
    if (!barre) {
      var pdf = zone.querySelector('#btnPrintSheet, [id*="Print"], [id*="Pdf"]');
      if (pdf && pdf.parentNode) barre = pdf.parentNode;
    }

    // Dernier recours : on crée notre propre barre en tête de fiche
    if (!barre) {
      barre = document.createElement('div');
      barre.className = 'acad-barre';
      barre.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:10px;';
      zone.insertBefore(barre, zone.firstChild);
    }

    barre.insertBefore(creerBouton(), barre.firstChild);
    return true;
  }

  /* Diagnostic : à taper dans la console si le bouton n'apparaît pas. */
  window.diagnosticAutocad = function () {
    var zone = zoneFiche();
    var res = {
      'module chargé': true,
      'zone de la fiche trouvée': !!zone,
      'zone visible': visible(zone),
      'barre .sheet-toolbar-actions': !!(zone && zone.querySelector('.sheet-toolbar-actions')),
      'bouton PDF repéré': !!(zone && zone.querySelector('#btnPrintSheet')),
      'bouton AutoCAD présent': !!document.getElementById('btnExportAutocad'),
      'tableau détecté': !!(zone && zone.querySelector('table')),
      'lignes exploitables': lireLignes().length
    };
    console.table(res);
    if (!zone) console.warn(LOG, "Ouvre d'abord l'onglet Fiches de débit et sélectionne une fiche.");
    return res;
  };

  function demarrer() {
    poserBouton();

    // La fiche est reconstruite à chaque changement : on surveille en continu.
    var zone = zoneFiche();
    if (zone && window.MutationObserver) {
      new MutationObserver(function () { poserBouton(); })
        .observe(zone, { childList: true, subtree: true });
    }
    // Filet de sécurité : la vue peut être créée après le chargement du module.
    document.addEventListener('click', function () { setTimeout(poserBouton, 150); }, true);
    var essais = 0;
    var minuteur = setInterval(function () {
      poserBouton();
      if (++essais > 40) clearInterval(minuteur);   // ~20 s puis on s'arrête
    }, 500);

    console.log(LOG, 'chargé. En cas de souci, tape diagnosticAutocad() dans la console.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
