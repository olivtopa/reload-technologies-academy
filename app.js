/* ==========================================================================
   Reload Technologies · Logique Applicative & Interactivité Pédagogique
   ========================================================================== */

(function () {
  const DATA = window.RELOAD_DATA;
  const STORAGE_KEY = "reload_cockpit_state_v1";

  const defaultState = {
    view: "dashboard",
    trackFilter: "all",
    currentModuleIndex: 0,
    completedModules: [],
    quizAnswers: {},
    moduleNotes: {},
    checkedRoadmap: [],
    scenarioProgress: {},
    examAnswers: {},
    examSubmitted: false,
    roadmapTab: "master90",
    toolTab: "circuit",
    circuitSim: {
      sensorType: "PNP",
      sensorActive: false,
      faultMode: "normal" // normal | surge45v | reverse | watchdog
    },
    calcSim: {
      cardsPerMonth: 1,
      cardPriceHT: 1800,
      cardDebours: 55,
      artisansCount: 3,
      artisanSetupCount: 1,
      artisanSetupPrice: 550,
      artisanMrrPrice: 300,
      simLicensesCount: 2,
      simLicensePrice: 350,
      hoursPerMonth: 24
    },
    kpis: {
      artisansContacted: 0,
      artisansSigned: 0,
      cardsAudited: 0,
      simulatorsBuilt: 0
    },
    auditBoard: {
      clientName: "Menuiserie Dupuis",
      machineName: "Presse hydraulique 1996",
      pcbDimensions: "145 x 95 mm (entraxes 135 x 85 mm)",
      rows: [
        { conn: "J1", pin: "1", name: "VCC_24V", type: "Alim +24V DC", idle: "24.2 V", active: "24.1 V", current: "350 mA", role: "Alimentation générale armoire" },
        { conn: "J1", pin: "2", name: "GND_0V", type: "Masse 0V", idle: "0 V", active: "0 V", current: "-", role: "Référence commune 0V" },
        { conn: "J2", pin: "1", name: "CAP_HAUT", type: "Entrée PNP", idle: "0 V", active: "+24 V", current: "8 mA", role: "Fin de course vérin position haute" },
        { conn: "J2", pin: "2", name: "CAP_BAS", type: "Entrée NPN", idle: "+24 V", active: "0 V", current: "8 mA", role: "Détection pièce présente (puits)" },
        { conn: "J2", pin: "3", name: "BP_DEPART", type: "Contact sec", idle: "Ouvert", active: "Fermé (+24V)", current: "5 mA", role: "Bouton poussoir départ cycle" },
        { conn: "J3", pin: "1", name: "EV_DESCENTE", type: "Sortie Relais", idle: "0 V", active: "+24 V DC", current: "1.2 A", role: "Électrovanne descente (charge inductive)" }
      ]
    }
  };

  let state = loadState();
  let pitchTimerInterval = null;
  let pitchSeconds = 0;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(defaultState),
        ...parsed,
        circuitSim: { ...defaultState.circuitSim, ...(parsed.circuitSim || {}) },
        calcSim: { ...defaultState.calcSim, ...(parsed.calcSim || {}) },
        kpis: { ...defaultState.kpis, ...(parsed.kpis || {}) },
        auditBoard: {
          ...defaultState.auditBoard,
          ...(parsed.auditBoard || {}),
          rows: Array.isArray(parsed.auditBoard?.rows) ? parsed.auditBoard.rows : defaultState.auditBoard.rows
        }
      };
    } catch (e) {
      return structuredClone(defaultState);
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Ignore storage quota errors
    }
    updateGlobalProgressUI();
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function announce(msg) {
    const live = document.getElementById("polite-announcer");
    if (live) live.textContent = msg;
    const toastRegion = document.getElementById("toast-region");
    if (!toastRegion) return;
    const el = document.createElement("div");
    el.className = "toast-msg";
    el.textContent = msg;
    toastRegion.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function getStats() {
    const totalModules = DATA.modules.length;
    const doneModules = state.completedModules.length;

    const allRoadmapTasks = [
      ...DATA.roadmap.master90.flatMap((p) => p.tasks.map((t) => t.id)),
      ...DATA.roadmap.sprintPcb30.map((t) => t.id),
      ...DATA.roadmap.sprintVocal30.map((t) => t.id)
    ];
    const doneRoadmap = state.checkedRoadmap.filter((id) => allRoadmapTasks.includes(id)).length;

    let totalQuiz = 0;
    let correctQuiz = 0;
    DATA.modules.forEach((m) => {
      m.quiz.forEach((q, qi) => {
        totalQuiz++;
        const key = `${m.id}_${qi}`;
        if (state.quizAnswers[key] === q.correct) correctQuiz++;
      });
    });

    const overallPct = Math.round(
      (doneModules / totalModules) * 45 +
      (correctQuiz / Math.max(1, totalQuiz)) * 30 +
      (doneRoadmap / Math.max(1, allRoadmapTasks.length)) * 25
    );

    return {
      totalModules,
      doneModules,
      totalQuiz,
      correctQuiz,
      totalRoadmap: allRoadmapTasks.length,
      doneRoadmap,
      overallPct
    };
  }

  function updateGlobalProgressUI() {
    const stats = getStats();
    const pctEl = document.getElementById("global-pct");
    const fillEl = document.getElementById("global-progress-fill");
    const subEl = document.getElementById("global-progress-sub");
    if (pctEl) pctEl.textContent = `${stats.overallPct}%`;
    if (fillEl) fillEl.style.width = `${stats.overallPct}%`;
    if (subEl) {
      subEl.textContent = `${stats.doneModules}/${stats.totalModules} modules · ${stats.correctQuiz}/${stats.totalQuiz} quiz · ${stats.doneRoadmap} étapes`;
    }

    const badgeMap = {
      academy: `${stats.doneModules}/${stats.totalModules}`,
      evaluation: `${stats.correctQuiz}/${stats.totalQuiz}`,
      roadmap: `${stats.doneRoadmap}/${stats.totalRoadmap}`
    };
    Object.entries(badgeMap).forEach(([k, val]) => {
      const b = document.getElementById(`badge-${k}`);
      if (b) b.textContent = val;
    });
  }

  function setView(viewName) {
    if (pitchTimerInterval) {
      clearInterval(pitchTimerInterval);
      pitchTimerInterval = null;
    }
    state.view = viewName;
    saveState();
    renderNavState();
    renderMain();
    const mainEl = document.getElementById("main-content");
    if (mainEl) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function renderNavState() {
    document.querySelectorAll("[data-nav-view]").forEach((btn) => {
      const isCurrent = btn.getAttribute("data-nav-view") === state.view;
      if (isCurrent) {
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("aria-current");
      }
    });
  }

  /* ==========================================================================
     1. VUE COCKPIT (DASHBOARD)
     ========================================================================== */
  function renderDashboard() {
    const stats = getStats();
    const nextModuleIdx = DATA.modules.findIndex((m) => !state.completedModules.includes(m.id));
    const nextModule = DATA.modules[nextModuleIdx >= 0 ? nextModuleIdx : 0];

    const masterTasks = DATA.roadmap.master90.flatMap((p) => p.tasks);
    const nextTask = masterTasks.find((t) => !state.checkedRoadmap.includes(t.id)) || masterTasks[0];

    const estMrr = state.kpis.artisansSigned * 300;
    const estPcb = state.kpis.cardsAudited * 1800;
    const estSim = state.kpis.simulatorsBuilt * 500;
    const estGross = estMrr + estPcb + estSim;

    return `
      <section aria-labelledby="dash-title">
        <div class="card" style="background: linear-gradient(135deg, var(--brand-soft), var(--surface)); border-color: var(--brand);">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px; align-items:center;">
            <div style="max-width: 700px;">
              <span class="pill">🚀 Cockpit Stratégique · Reload Technologies</span>
              <h1 id="dash-title" style="margin-top:8px;">Votre Accompagnateur <span class="gradient-text">Pédagogique, Technique & Marketing</span></h1>
              <p class="muted" style="margin:0;">
                Maîtrisez les <strong>3 Piliers synergiques</strong> (Rétro-ingénierie électronique industrielle, Assistant Devis Vocal IA & Simulateurs éducatifs), validez vos acquis par la pratique et exécutez votre plan 90 jours vers <strong>&gt; 2 200 € net/mois en 6 à 8h/semaine</strong>.
              </p>
            </div>
            <div class="btn-row">
              <button type="button" class="btn" data-action="open-module" data-index="${nextModuleIdx >= 0 ? nextModuleIdx : 0}">
                ▶️ Continuer : Module ${nextModule.num}
              </button>
              <button type="button" class="btn btn-secondary" data-action="go-view" data-view="roadmap">
                🗓️ Plan 90 Jours
              </button>
            </div>
          </div>
        </div>

        <div class="grid-4" style="margin-bottom:18px;">
          <div class="kpi-card">
            <span class="kpi-label">Progression Globale</span>
            <span class="kpi-value">${stats.overallPct} %</span>
            <span class="muted" style="font-size:0.78rem;">Formation + Quiz + Exécution</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Modules Maîtrisés</span>
            <span class="kpi-value">${stats.doneModules} / ${stats.totalModules}</span>
            <span class="muted" style="font-size:0.78rem;">4 Parcours complets</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Quiz Validés</span>
            <span class="kpi-value">${stats.correctQuiz} / ${stats.totalQuiz}</span>
            <span class="muted" style="font-size:0.78rem;">Contrôle des connaissances</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Étapes Terrain Cochées</span>
            <span class="kpi-value">${stats.doneRoadmap} / ${stats.totalRoadmap}</span>
            <span class="muted" style="font-size:0.78rem;">Feuilles de route 30j & 90j</span>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
            <span class="pill amber">🎯 Prochaines Actions Recommandées</span>
            <h2 style="margin-top:8px;">Votre feuille de route immédiate</h2>
            <div class="card-elevated" style="margin-bottom:12px;">
              <div style="font-size:0.78rem; font-weight:700; color:var(--brand); text-transform:uppercase;">📚 Prochain Module Pédagogique</div>
              <h3 style="margin:4px 0;">${nextModule.icon} Module ${nextModule.num} · ${escapeHtml(nextModule.title)}</h3>
              <p class="muted" style="font-size:0.86rem; margin:0 0 10px;">${escapeHtml(nextModule.subtitle)}</p>
              <button type="button" class="btn btn-sm" data-action="open-module" data-index="${nextModuleIdx >= 0 ? nextModuleIdx : 0}">
                Étudier ce module (${nextModule.duration}) →
              </button>
            </div>

            <div class="card-elevated">
              <div style="font-size:0.78rem; font-weight:700; color:var(--accent); text-transform:uppercase;">⚡ Prochain Jalon Opérationnel (Plan 90 Jours)</div>
              <h3 style="margin:4px 0;">${escapeHtml(nextTask.title)}</h3>
              <p class="muted" style="font-size:0.86rem; margin:0 0 10px;">${escapeHtml(nextTask.detail)}</p>
              <div class="btn-row">
                <button type="button" class="btn btn-secondary btn-sm" data-action="quick-check-task" data-task-id="${nextTask.id}">
                  ✓ Marquer cette étape accomplie
                </button>
                <button type="button" class="btn btn-secondary btn-sm" data-action="go-view" data-view="roadmap">
                  Voir toute la feuille de route
                </button>
              </div>
            </div>
          </div>

          <div class="card">
            <span class="pill indigo">📈 Compteur Terrain Réel (Vos Résultats)</span>
            <h2 style="margin-top:8px;">Suivi d'exécution commerciale</h2>
            <p class="muted" style="font-size:0.86rem; margin-top:0;">Mettez à jour vos résultats réels au fil de vos démarches :</p>
            <div class="grid-2" style="gap:10px;">
              <div class="card-elevated">
                <div style="font-size:0.8rem; font-weight:700;">🤝 Artisans démarchés (cible : 10)</div>
                <div class="btn-row" style="margin-top:6px;">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="artisansContacted" data-delta="-1" aria-label="Retirer un artisan démarché">−</button>
                  <strong style="font-size:1.25rem; min-width:32px; text-align:center;">${state.kpis.artisansContacted}</strong>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="artisansContacted" data-delta="1" aria-label="Ajouter un artisan démarché">+</button>
                </div>
              </div>
              <div class="card-elevated">
                <div style="font-size:0.8rem; font-weight:700;">🎙️ Artisans abonnés MRR (cible : 3)</div>
                <div class="btn-row" style="margin-top:6px;">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="artisansSigned" data-delta="-1" aria-label="Retirer un artisan abonné">−</button>
                  <strong style="font-size:1.25rem; min-width:32px; text-align:center;">${state.kpis.artisansSigned}</strong>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="artisansSigned" data-delta="1" aria-label="Ajouter un artisan abonné">+</button>
                </div>
              </div>
              <div class="card-elevated">
                <div style="font-size:0.8rem; font-weight:700;">🔌 Cartes PCB auditées/livrées</div>
                <div class="btn-row" style="margin-top:6px;">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="cardsAudited" data-delta="-1" aria-label="Retirer une carte PCB">−</button>
                  <strong style="font-size:1.25rem; min-width:32px; text-align:center;">${state.kpis.cardsAudited}</strong>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="cardsAudited" data-delta="1" aria-label="Ajouter une carte PCB">+</button>
                </div>
              </div>
              <div class="card-elevated">
                <div style="font-size:0.8rem; font-weight:700;">🎬 Simulateurs / Packs signés</div>
                <div class="btn-row" style="margin-top:6px;">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="simulatorsBuilt" data-delta="-1" aria-label="Retirer un simulateur ou pack">−</button>
                  <strong style="font-size:1.25rem; min-width:32px; text-align:center;">${state.kpis.simulatorsBuilt}</strong>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="kpi-step" data-kpi="simulatorsBuilt" data-delta="1" aria-label="Ajouter un simulateur ou pack">+</button>
                </div>
              </div>
            </div>
            <div class="callout" style="margin-bottom:0; margin-top:12px;">
              <strong>💰 CA Mensuel Généré Actuel : ${estGross.toLocaleString("fr-FR")} € HT</strong>
              <span style="display:block; font-size:0.84rem;" class="muted">
                Dont ${estMrr} € HT/mois de rente récurrente (MRR) · Objectif mois type : 3 400 € HT (&gt; 2 200 € net).
              </span>
            </div>
          </div>
        </div>

        <div class="card">
          <span class="pill">🔄 Architecture Stratégique : Le Cercle Vertueux des 3 Piliers</span>
          <h2 style="margin-top:8px;">Comment vos 3 activités s'alimentent sans prospection à froid</h2>
          <div class="grid-3" style="margin-top:14px;">
            <div class="concept-item">
              <strong>🔌 Pilier 1 · Rétro-Ingénierie PCB</strong>
              <span>
                <b>Offre :</b> Remplacement « drop-in » de cartes industrielles obsolètes (KiCad 4 couches + STM32/ESP32 + PCBA clé en main).<br>
                <b>Tarif :</b> 1 200 à 3 500 € HT / projet (12–18h).<br>
                <b>Rôle :</b> Fort cash-flow immédiat & confiance technique absolue.
              </span>
              <div style="margin-top:10px;">
                <button type="button" class="btn btn-secondary btn-sm" data-action="filter-track" data-track="pilier1">Explorer les 5 modules PCB →</button>
              </div>
            </div>

            <div class="concept-item" style="border-left-color: var(--accent);">
              <strong>🎙️ Pilier 2 · Assistant Devis Vocal IA</strong>
              <span>
                <b>Offre :</b> Note vocale WhatsApp/Telegram de 30s → Devis PDF normé NF C 15-100 en 15s (Make/n8n + Gemini 2.5 Flash / App SaaS).<br>
                <b>Tarif :</b> Setup 450–750 € HT + 250–350 € HT/mois.<br>
                <b>Rôle :</b> Rente mensuelle récurrente prévisible (MRR).
              </span>
              <div style="margin-top:10px;">
                <button type="button" class="btn btn-secondary btn-sm" data-action="filter-track" data-track="pilier2">Explorer les modules Devis Vocal →</button>
              </div>
            </div>

            <div class="concept-item" style="border-left-color: var(--indigo);">
              <strong>🎬 Pilier 3 · Simulateurs & Studio Vidéo</strong>
              <span>
                <b>Offre :</b> Micro-simulateurs web (NF C 18-510, diagnostic 24V) pour CFA/IUT + vidéos courtes 9:16 de preuve terrain.<br>
                <b>Tarif :</b> Licences 500–1 500 €/an · Packs 300–500 €/mois.<br>
                <b>Rôle :</b> Actifs scalables à coût nul & acquisition Inbound.
              </span>
              <div style="margin-top:10px;">
                <button type="button" class="btn btn-secondary btn-sm" data-action="filter-track" data-track="pilier3">Explorer les modules Simulateurs →</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /* ==========================================================================
     2. VUE ACADÉMIE (12 MODULES + SCHÉMAS + FLASHCARDS + QUIZ + NOTES)
     ========================================================================== */
  function renderPnpNpnSvg() {
    return `
      <svg class="svg-diagram" viewBox="0 0 680 175" role="img" aria-labelledby="svg-pnp-title">
        <title id="svg-pnp-title">Comparaison du câblage d'un capteur PNP (source +24V) et d'un capteur NPN (puits 0V)</title>
        <text x="16" y="22" font-weight="700" font-size="14">Capteur PNP (Logique Source / Push +24V)</text>
        <text x="70" y="42" text-anchor="middle" font-size="12">+24V DC</text>
        <line class="wire" x1="70" y1="48" x2="70" y2="72"/>
        <rect class="box" x="25" y="72" width="90" height="44" rx="8"/>
        <text x="70" y="98" text-anchor="middle" font-size="13" font-weight="600">Capteur PNP</text>
        <line class="wire-active" x1="115" y1="94" x2="225" y2="94"/>
        <text x="170" y="85" text-anchor="middle" font-size="11">+24V si actif →</text>
        <rect class="box" x="225" y="72" width="95" height="44" rx="8"/>
        <text x="272" y="92" text-anchor="middle" font-size="12" font-weight="600">Entrée Opto</text>
        <text x="272" y="108" text-anchor="middle" font-size="10">TLP290-4 + LED</text>
        <line class="wire" x1="272" y1="116" x2="272" y2="144"/>
        <text x="272" y="160" text-anchor="middle" font-size="12">Com = 0V (GND)</text>

        <text x="365" y="22" font-weight="700" font-size="14">Capteur NPN (Logique Puits / Sink 0V)</text>
        <text x="605" y="42" text-anchor="middle" font-size="12">Com = +24V DC</text>
        <line class="wire" x1="605" y1="48" x2="605" y2="72"/>
        <rect class="box" x="558" y="72" width="95" height="44" rx="8"/>
        <text x="605" y="92" text-anchor="middle" font-size="12" font-weight="600">Entrée Opto</text>
        <text x="605" y="108" text-anchor="middle" font-size="10">TLP290-4 + LED</text>
        <line class="wire-active" x1="455" y1="94" x2="558" y2="94"/>
        <text x="506" y="85" text-anchor="middle" font-size="11">← 0V si actif</text>
        <rect class="box" x="365" y="72" width="90" height="44" rx="8"/>
        <text x="410" y="98" text-anchor="middle" font-size="13" font-weight="600">Capteur NPN</text>
        <line class="wire" x1="410" y1="116" x2="410" y2="144"/>
        <text x="410" y="160" text-anchor="middle" font-size="12">0V (GND)</text>
      </svg>
    `;
  }

  function renderAcademy() {
    const filteredModules = DATA.modules.filter(
      (m) => state.trackFilter === "all" || m.track === state.trackFilter
    );
    const activeMod = DATA.modules[state.currentModuleIndex] || DATA.modules[0];
    const isCompleted = state.completedModules.includes(activeMod.id);
    const noteVal = state.moduleNotes[activeMod.id] || "";

    return `
      <section aria-labelledby="acad-title">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px;">
          <div>
            <span class="pill">🎓 Académie Interactive · 12 Modules Experts</span>
            <h1 id="acad-title" style="margin-top:6px;">Socle de Connaissances & Pédagogie Active</h1>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-secondary btn-sm" data-action="go-view" data-view="evaluation">
              🏆 Passer à l'Examen & Cas Pratiques
            </button>
          </div>
        </div>

        <!-- Filtres par Parcours -->
        <div class="filter-bar" role="toolbar" aria-label="Filtrer les modules par pilier">
          ${DATA.tracks
            .map(
              (t) => `
            <button type="button" class="chip-btn ${state.trackFilter === t.id ? "active" : ""}" data-action="set-track" data-track="${t.id}">
              ${t.icon} ${escapeHtml(t.label)}
            </button>
          `
            )
            .join("")}
        </div>

        <!-- Sélecteur de Modules -->
        <div class="filter-bar" role="navigation" aria-label="Sélection du module">
          ${filteredModules
            .map((m) => {
              const realIdx = DATA.modules.findIndex((x) => x.id === m.id);
              const done = state.completedModules.includes(m.id);
              return `
                <button type="button" class="chip-btn ${realIdx === state.currentModuleIndex ? "active" : ""} ${done ? "done" : ""}" data-action="select-module" data-index="${realIdx}">
                  ${m.icon} ${m.num}. ${escapeHtml(m.title.replace(/^Pilier \d · /, ""))}
                </button>
              `;
            })
            .join("")}
        </div>

        <!-- Carte Principale du Module -->
        <article class="card">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-start; gap:12px;">
            <div>
              <span class="pill">Module ${activeMod.num} / ${DATA.modules.length} · ⏱️ ${activeMod.duration}</span>
              <h2 style="margin-top:8px;">${activeMod.icon} ${escapeHtml(activeMod.title)}</h2>
              <p class="muted" style="margin-top:0;">${escapeHtml(activeMod.subtitle)}</p>
            </div>
            <button type="button" class="btn ${isCompleted ? "btn-secondary" : ""}" data-action="toggle-module-done" data-id="${activeMod.id}">
              ${isCompleted ? "✓ Module validé (cliquer pour rouvrir)" : "✓ Marquer ce module comme acquis"}
            </button>
          </div>

          ${
            activeMod.chain
              ? `
            <div class="flow-chain" aria-label="Chaîne logique du module">
              ${activeMod.chain
                .map(
                  (step, idx) =>
                    `${idx > 0 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ""}
                     <div class="flow-step">${escapeHtml(step[0])}<small>${escapeHtml(step[1])}</small></div>`
                )
                .join("")}
            </div>
          `
              : ""
          }

          ${activeMod.svgDiagram === "pnp_npn" ? renderPnpNpnSvg() : ""}

          <div class="grid-2" style="margin-top:14px;">
            ${activeMod.points
              .map(
                (pt) => `
              <div class="concept-item">
                <strong>${escapeHtml(pt[0])}</strong>
                <span>${escapeHtml(pt[1])}</span>
              </div>
            `
              )
              .join("")}
          </div>

          <div class="callout pedagogy">
            <strong>💡 Synthèse Pédagogique (À retenir absolument) :</strong>
            <div style="margin-top:4px; font-size:0.93rem;">${escapeHtml(activeMod.pedagogyKey)}</div>
          </div>

          <div class="callout marketing">
            <strong>🎯 Conseil Marketing & Psychologie Terrain :</strong>
            <div style="margin-top:4px; font-size:0.93rem;">${escapeHtml(activeMod.marketingTip)}</div>
          </div>

          <!-- Flashcards de mémorisation active -->
          <div style="margin-top:24px;">
            <h3>🧠 Cartes Mémoire (Flashcards — Cliquez pour retourner)</h3>
            <p class="muted" style="font-size:0.86rem; margin-top:0;">Pratiquez le rappel actif avant de répondre au quiz :</p>
            <div class="flashcard-grid">
              ${activeMod.flashcards
                .map(
                  (fc, fci) => `
                <button type="button" class="flashcard" aria-pressed="false" data-action="flip-flashcard" data-q="${escapeHtml(fc.q)}" data-a="${escapeHtml(fc.a)}">
                  <div>
                    <span class="pill" style="margin-bottom:8px;">Question ${fci + 1}</span>
                    <div class="fc-body" style="font-weight:700; font-size:0.93rem; white-space:pre-line;">${escapeHtml(fc.q)}</div>
                  </div>
                  <small class="muted fc-hint" style="margin-top:12px; display:block;">🔄 Cliquer ou appuyer sur Entrée pour voir la réponse</small>
                </button>
              `
                )
                .join("")}
            </div>
          </div>

          <!-- Quiz de vérification immédiate -->
          <div style="margin-top:26px;">
            <h3>🧪 Vérifiez vos connaissances sur ce module</h3>
            ${activeMod.quiz
              .map((q, qi) => {
                const key = `${activeMod.id}_${qi}`;
                const answered = state.quizAnswers[key];
                const hasAnswered = typeof answered === "number";
                return `
                  <div class="quiz-block">
                    <p class="quiz-question">${qi + 1}. ${escapeHtml(q.q)}</p>
                    ${q.options
                      .map((opt, oi) => {
                        let cls = "quiz-option";
                        if (hasAnswered) {
                          if (oi === q.correct) cls += " correct";
                          else if (oi === answered) cls += " wrong";
                        }
                        return `
                          <button type="button" class="${cls}" data-action="answer-module-quiz" data-mod="${activeMod.id}" data-qi="${qi}" data-oi="${oi}">
                            ${escapeHtml(opt)}
                          </button>
                        `;
                      })
                      .join("")}
                    ${
                      hasAnswered
                        ? `<div class="quiz-feedback">
                            <strong>${answered === q.correct ? "✅ Excellente réponse !" : "❌ À corriger :"}</strong>
                            ${escapeHtml(q.explanation)}
                           </div>`
                        : ""
                    }
                  </div>
                `;
              })
              .join("")}
          </div>

          <!-- Notes personnelles du module -->
          <div style="margin-top:24px;">
            <div class="form-group">
              <label for="module-note-input">📝 Vos notes personnelles & idées d'application pour ce module :</label>
              <textarea id="module-note-input" rows="3" class="form-control" placeholder="Notez ici vos idées, contacts locaux à appeler ou points à approfondir..." data-action="save-module-note" data-mod="${activeMod.id}">${escapeHtml(noteVal)}</textarea>
            </div>
          </div>

          <!-- Navigation bas de module -->
          <div class="btn-row" style="justify-content:space-between; margin-top:20px; padding-top:16px; border-top:1px solid var(--border);">
            ${
              state.currentModuleIndex > 0
                ? `<button type="button" class="btn btn-secondary" data-action="select-module" data-index="${state.currentModuleIndex - 1}">← Module précédent</button>`
                : `<span></span>`
            }
            <button type="button" class="btn ${isCompleted ? "btn-secondary" : ""}" data-action="toggle-module-done" data-id="${activeMod.id}">
              ${isCompleted ? "✓ Module terminé" : "✓ Valider ce module"}
            </button>
            ${
              state.currentModuleIndex < DATA.modules.length - 1
                ? `<button type="button" class="btn" data-action="select-module" data-index="${state.currentModuleIndex + 1}">Module suivant →</button>`
                : `<button type="button" class="btn btn-amber" data-action="go-view" data-view="evaluation">Passer l'Examen Global 🏆</button>`
            }
          </div>
        </article>
      </section>
    `;
  }

  /* ==========================================================================
     3. VUE ÉVALUATION, MISES EN SITUATION & CERTIFICATION
     ========================================================================== */
  function renderEvaluation() {
    // Compute score per pillar across all module quizzes
    const trackScores = {
      strategie: { label: "Stratégie, Juridique & Fiscalité (BNC/BIC/Débours)", total: 0, ok: 0 },
      pilier1: { label: "Pilier 1 · Rétro-Ingénierie Électronique & KiCad", total: 0, ok: 0 },
      pilier2: { label: "Pilier 2 · Assistant Devis Vocal IA & Vente Artisan", total: 0, ok: 0 },
      pilier3: { label: "Pilier 3 · Simulateurs Web & Acquisition Inbound", total: 0, ok: 0 }
    };

    DATA.modules.forEach((m) => {
      m.quiz.forEach((q, qi) => {
        const key = `${m.id}_${qi}`;
        trackScores[m.track].total++;
        if (state.quizAnswers[key] === q.correct) {
          trackScores[m.track].ok++;
        }
      });
    });

    const stats = getStats();

    return `
      <section aria-labelledby="eval-title">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px;">
          <div>
            <span class="pill">🏆 Centre de Vérification des Connaissances</span>
            <h1 id="eval-title" style="margin-top:6px;">Diagnostic de Maîtrise & Mises en Situation Terrain</h1>
            <p class="muted" style="margin:0;">Vérifiez votre maîtrise opérationnelle sur les 4 compétences clés et entraînez-vous sur des cas clients réels.</p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn" data-action="open-cert-modal">
              🎓 Voir mon Bilan de Certification
            </button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="reset-quizzes">
              ↺ Réinitialiser les quiz
            </button>
          </div>
        </div>

        <!-- Radar / Jauges de compétences par Pilier -->
        <div class="card">
          <h2>📊 Votre Profil de Maîtrise par Compétence (${stats.correctQuiz} / ${stats.totalQuiz} questions validées)</h2>
          <div class="grid-2" style="margin-top:14px;">
            ${Object.entries(trackScores)
              .map(([k, item]) => {
                const pct = Math.round((item.ok / Math.max(1, item.total)) * 100);
                return `
                  <div class="card-elevated">
                    <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.9rem; margin-bottom:6px;">
                      <span>${escapeHtml(item.label)}</span>
                      <span style="color:var(--brand);">${item.ok}/${item.total} (${pct}%)</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width:${pct}%"></div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>

        <!-- Mises en situation terrain interactives -->
        <div class="card">
          <span class="pill amber">🎭 Simulateur de Cas Pratiques Terrain</span>
          <h2 style="margin-top:8px;">Prenez les bonnes décisions techniques, commerciales et fiscales</h2>
          <p class="muted" style="margin-top:0;">Testez vos réflexes en conditions réelles face à un industriel, un artisan ou un directeur de CFA :</p>

          ${DATA.scenarios
            .map(
              (sc) => `
            <div class="card-elevated" style="margin-top:16px;">
              <span class="pill">${escapeHtml(sc.pillar)}</span>
              <h3 style="margin-top:8px;">${escapeHtml(sc.title)}</h3>
              <p style="font-size:0.9rem; margin:6px 0 14px;" class="muted">${escapeHtml(sc.context)}</p>

              ${sc.steps
                .map((st, si) => {
                  const sKey = `${sc.id}_${si}`;
                  const chosen = state.scenarioProgress[sKey];
                  const hasChosen = typeof chosen === "number";
                  return `
                    <div class="quiz-block" style="background:var(--surface);">
                      <p class="quiz-question">${escapeHtml(st.question)}</p>
                      ${st.choices
                        .map((ch, ci) => {
                          let cls = "quiz-option";
                          if (hasChosen) {
                            if (ch.ok) cls += " correct";
                            else if (ci === chosen) cls += " wrong";
                          }
                          return `
                            <button type="button" class="${cls}" data-action="answer-scenario" data-sc="${sc.id}" data-si="${si}" data-ci="${ci}">
                              ${escapeHtml(ch.text)}
                            </button>
                          `;
                        })
                        .join("")}
                      ${
                        hasChosen
                          ? `<div class="quiz-feedback">
                              <strong>${st.choices[chosen]?.ok ? "✅ Décision d'expert :" : "⚠️ Point de vigilance :"}</strong>
                              ${escapeHtml(st.choices[chosen]?.feedback || "")}
                            </div>`
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")}
            </div>
          `
            )
            .join("")}
        </div>

        <!-- Banque intégrale des 24 questions d'examen -->
        <div class="card">
          <span class="pill indigo">📝 Examen Blanc Intégral (24 Questions Multi-Piliers)</span>
          <h2 style="margin-top:8px;">Validez 100 % des connaissances du dossier stratégique</h2>
          ${DATA.modules
            .map((m) =>
              m.quiz
                .map((q, qi) => {
                  const key = `${m.id}_${qi}`;
                  const answered = state.quizAnswers[key];
                  const hasAnswered = typeof answered === "number";
                  return `
                    <div class="quiz-block">
                      <div style="font-size:0.76rem; font-weight:700; color:var(--brand); margin-bottom:4px;">
                        ${m.icon} Module ${m.num} · ${escapeHtml(m.title)}
                      </div>
                      <p class="quiz-question">${escapeHtml(q.q)}</p>
                      ${q.options
                        .map((opt, oi) => {
                          let cls = "quiz-option";
                          if (hasAnswered) {
                            if (oi === q.correct) cls += " correct";
                            else if (oi === answered) cls += " wrong";
                          }
                          return `
                            <button type="button" class="${cls}" data-action="answer-module-quiz" data-mod="${m.id}" data-qi="${qi}" data-oi="${oi}">
                              ${escapeHtml(opt)}
                            </button>
                          `;
                        })
                        .join("")}
                      ${
                        hasAnswered
                          ? `<div class="quiz-feedback">
                              <strong>${answered === q.correct ? "✅ Validé :" : "❌ Explication :"}</strong>
                              ${escapeHtml(q.explanation)}
                            </div>`
                          : ""
                      }
                    </div>
                  `;
                })
                .join("")
            )
            .join("")}
        </div>
      </section>
    `;
  }

  /* ==========================================================================
     4. VUE FEUILLE DE ROUTE (PLAN 90 JOURS + SPRINTS 30 JOURS)
     ========================================================================== */
  function renderRoadmap() {
    const tab = state.roadmapTab || "master90";

    const masterIds = DATA.roadmap.master90.flatMap((p) => p.tasks.map((t) => t.id));
    const pcbIds = DATA.roadmap.sprintPcb30.map((t) => t.id);
    const vocalIds = DATA.roadmap.sprintVocal30.map((t) => t.id);

    const countDone = (ids) => ids.filter((id) => state.checkedRoadmap.includes(id)).length;

    return `
      <section aria-labelledby="road-title">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px;">
          <div>
            <span class="pill">🗓️ Accompagnement Opérationnel Pas-à-Pas</span>
            <h1 id="road-title" style="margin-top:6px;">Feuille de Route 90 Jours & Sprints 30 Jours</h1>
            <p class="muted" style="margin:0;">Cochez chaque livrable au fur et à mesure de votre avancement jusqu'à la réalisation complète du projet.</p>
          </div>
        </div>

        <div class="filter-bar" role="toolbar" aria-label="Choisir le plan d'action">
          <button type="button" class="chip-btn ${tab === "master90" ? "active" : ""}" data-action="set-roadmap-tab" data-tab="master90">
            🚀 Masterplan 90 Jours (${countDone(masterIds)}/${masterIds.length})
          </button>
          <button type="button" class="chip-btn ${tab === "sprintVocal30" ? "active" : ""}" data-action="set-roadmap-tab" data-tab="sprintVocal30">
            🎙️ Sprint 30 Jours · Devis Vocal (${countDone(vocalIds)}/${vocalIds.length})
          </button>
          <button type="button" class="chip-btn ${tab === "sprintPcb30" ? "active" : ""}" data-action="set-roadmap-tab" data-tab="sprintPcb30">
            🔌 Sprint 30 Jours · Rétro-Ingénierie PCB (${countDone(pcbIds)}/${pcbIds.length})
          </button>
        </div>

        ${
          tab === "master90"
            ? DATA.roadmap.master90
                .map((phase) => {
                  const pIds = phase.tasks.map((t) => t.id);
                  const pDone = countDone(pIds);
                  const pct = Math.round((pDone / pIds.length) * 100);
                  return `
                    <div class="card">
                      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
                        <div>
                          <span class="pill">${escapeHtml(phase.badge)}</span>
                          <h2 style="margin-top:6px; margin-bottom:2px;">${escapeHtml(phase.phase)}</h2>
                          <p class="muted" style="margin:0; font-size:0.88rem;">🎯 Objectif : <strong>${escapeHtml(phase.target)}</strong></p>
                        </div>
                        <span class="pill ok">${pDone} / ${pIds.length} accomplis (${pct}%)</span>
                      </div>
                      <div class="progress-track" style="margin-bottom:14px;">
                        <div class="progress-fill" style="width:${pct}%"></div>
                      </div>
                      <div>
                        ${phase.tasks
                          .map((t) => {
                            const checked = state.checkedRoadmap.includes(t.id);
                            return `
                              <label class="check-row ${checked ? "checked" : ""}">
                                <input type="checkbox" ${checked ? "checked" : ""} data-action="toggle-roadmap-task" data-id="${t.id}">
                                <div>
                                  <span class="task-title" style="font-weight:700; display:block;">${escapeHtml(t.title)}</span>
                                  <span class="muted" style="font-size:0.85rem;">${escapeHtml(t.detail)}</span>
                                </div>
                              </label>
                            `;
                          })
                          .join("")}
                      </div>
                    </div>
                  `;
                })
                .join("")
            : ""
        }

        ${
          tab === "sprintVocal30"
            ? `
          <div class="card">
            <span class="pill amber">🎙️ Plan de Lancement Opérationnel 30 Jours · Assistant Devis Vocal IA</span>
            <h2 style="margin-top:8px;">De la configuration du socle gratuit aux 2 premiers contrats récurrents</h2>
            ${DATA.roadmap.sprintVocal30
              .map((t) => {
                const checked = state.checkedRoadmap.includes(t.id);
                return `
                  <label class="check-row ${checked ? "checked" : ""}">
                    <input type="checkbox" ${checked ? "checked" : ""} data-action="toggle-roadmap-task" data-id="${t.id}">
                    <div>
                      <span class="pill" style="margin-right:6px;">${escapeHtml(t.week)}</span>
                      <span class="task-title" style="font-weight:700;">${escapeHtml(t.title)}</span>
                    </div>
                  </label>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }

        ${
          tab === "sprintPcb30"
            ? `
          <div class="card">
            <span class="pill">🔌 Plan d'Action 30 Jours · Rétro-Ingénierie de Cartes Électroniques</span>
            <h2 style="margin-top:8px;">De votre premier relevé d'audit à la commande de 5 PCBA clé en main</h2>
            ${DATA.roadmap.sprintPcb30
              .map((t) => {
                const checked = state.checkedRoadmap.includes(t.id);
                return `
                  <label class="check-row ${checked ? "checked" : ""}">
                    <input type="checkbox" ${checked ? "checked" : ""} data-action="toggle-roadmap-task" data-id="${t.id}">
                    <div>
                      <span class="pill" style="margin-right:6px;">${escapeHtml(t.week)}</span>
                      <span class="task-title" style="font-weight:700;">${escapeHtml(t.title)}</span>
                    </div>
                  </label>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }
      </section>
    `;
  }

  /* ==========================================================================
     5. VUE OUTILS & SIMULATEURS TECHNIQUES / FINANCIERS
     ========================================================================== */
  function renderTools() {
    const tab = state.toolTab || "circuit";
    return `
      <section aria-labelledby="tools-title">
        <div style="margin-bottom:14px;">
          <span class="pill">🛠️ Laboratoire & Outils d'Exécution Terrain</span>
          <h1 id="tools-title" style="margin-top:6px;">Simulateur Électronique 24V, Grille d'Audit PCB & Calculateur Fiscal</h1>
          <p class="muted" style="margin:0;">Utilisez ces 3 outils sur smartphone, tablette ou PC lors de vos diagnostics clients, chiffrages et formations.</p>
        </div>

        <div class="filter-bar" role="toolbar" aria-label="Sélection de l'outil">
          <button type="button" class="chip-btn ${tab === "circuit" ? "active" : ""}" data-action="set-tool-tab" data-tab="circuit">
            ⚡ 1. Simulateur Interactif Banc 24V (PNP/NPN & Protections)
          </button>
          <button type="button" class="chip-btn ${tab === "audit" ? "active" : ""}" data-action="set-tool-tab" data-tab="audit">
            📋 2. Grille d'Audit Terrain PCB (Export CSV KiCad)
          </button>
          <button type="button" class="chip-btn ${tab === "calc" ? "active" : ""}" data-action="set-tool-tab" data-tab="calc">
            💶 3. Simulateur Financier URSSAF (BNC / BIC / Débours)
          </button>
        </div>

        ${tab === "circuit" ? renderCircuitSimulatorTool() : ""}
        ${tab === "audit" ? renderAuditGridTool() : ""}
        ${tab === "calc" ? renderFinancialCalcTool() : ""}
      </section>
    `;
  }

  function renderCircuitSimulatorTool() {
    const sim = state.circuitSim;
    const isFault = sim.faultMode !== "normal";
    const isOutputActive = sim.sensorActive && !isFault;

    let statusBanner = "";
    if (sim.faultMode === "surge45v") {
      statusBanner = `⚡ SURTENSION 45V SIMULÉE : La diode TVS 600W (SMBJ33CA) écrête immédiatement le pic transitoire vers la masse et le fusible PTC (MF-MSMF) limite le courant. Le bus 5V/3.3V et le STM32 restent 100 % intacts !`;
    } else if (sim.faultMode === "reverse") {
      statusBanner = `🛑 INVERSION DE POLARITÉ (-24V) SIMULÉE : La diode Schottky SS34 bloque instantanément le courant inverse. Aucun composant en aval n'est endommagé.`;
    } else if (sim.faultMode === "watchdog") {
      statusBanner = `🔄 PLANTAGE LOGICIEL (Parasite CEM) SIMULÉ : Le Watchdog matériel indépendant (IWDG) détecte l'absence de rafraîchissement, force un Reset en quelques ms et coupe l'ULN2003A → Relais G5NB mis en ÉTAT SÛR (OFF).`;
    } else if (sim.sensorActive) {
      statusBanner = `✅ CAPTEUR ${sim.sensorType} ACTIF : Courant établi dans l'optocoupleur bidirectionnel TLP290-4 → LED CMS d'entrée allumée → GPIO STM32 à l'état logique actif → ULN2003A sature → Relais Omron G5NB fermé !`;
    } else {
      statusBanner = `⏸️ ÉTAT REPOS (ATTENTE) : Le capteur ${sim.sensorType} est au repos. L'optocoupleur TLP290-4 est bloqué, la LED témoin est éteinte et le relais de puissance est ouvert (état sûr).`;
    }

    const inputVoltageLabel =
      sim.sensorType === "PNP"
        ? sim.sensorActive
          ? "+24V DC (Source active)"
          : "0V (Repos)"
        : sim.sensorType === "NPN"
        ? sim.sensorActive
          ? "0V (Puits actif vers GND)"
          : "+24V DC (Repos)"
        : sim.sensorActive
        ? "Contact fermé (+24V)"
        : "Contact ouvert";

    return `
      <div class="card">
        <span class="pill">⚡ Banc Virtuel d'Architecture Standard Reload Technologies (Pilier 1 & Pilier 3)</span>
        <h2 style="margin-top:8px;">Testez en direct votre chaîne Électronique Industrielle 24V DC</h2>
        <p class="muted" style="margin-top:0;">
          Manipulez le capteur et injectez des défauts électriques pour visualiser le rôle de chaque brique standard (et utilisez ce banc comme démonstrateur pédagogique pour vos clients CFA/IUT !).
        </p>

        <div class="grid-3" style="margin:14px 0;">
          <div class="card-elevated">
            <label for="sim-sensor-type" style="font-weight:700; font-size:0.86rem; display:block; margin-bottom:6px;">1. Type de capteur câblé sur bornier 3,81 mm :</label>
            <select id="sim-sensor-type" class="form-control" style="width:100%;" data-action="sim-sensor-type">
              <option value="PNP" ${sim.sensorType === "PNP" ? "selected" : ""}>Capteur PNP (Logique Source / Push +24V)</option>
              <option value="NPN" ${sim.sensorType === "NPN" ? "selected" : ""}>Capteur NPN (Logique Puits / Sink 0V)</option>
              <option value="SEC" ${sim.sensorType === "SEC" ? "selected" : ""}>Contact Sec (Interrupteur libre de potentiel)</option>
            </select>
          </div>

          <div class="card-elevated">
            <span style="font-weight:700; font-size:0.86rem; display:block; margin-bottom:6px;">2. Actionner le capteur sur la machine :</span>
            <button type="button" class="btn ${sim.sensorActive ? "btn-amber" : ""}" style="width:100%;" data-action="sim-toggle-sensor">
              ${sim.sensorActive ? "🟢 Capteur ACTIF (Détection en cours)" : "⚪ Capteur au REPOS (Cliquer pour activer)"}
            </button>
          </div>

          <div class="card-elevated">
            <label for="sim-fault-mode" style="font-weight:700; font-size:0.86rem; display:block; margin-bottom:6px;">3. Simuler une agression / panne sur banc :</label>
            <select id="sim-fault-mode" class="form-control" style="width:100%;" data-action="sim-fault-mode">
              <option value="normal" ${sim.faultMode === "normal" ? "selected" : ""}>✅ Fonctionnement nominal (24V DC propre)</option>
              <option value="surge45v" ${sim.faultMode === "surge45v" ? "selected" : ""}>⚡ Pic de surtension transitoire 45V (Test PTC + TVS)</option>
              <option value="reverse" ${sim.faultMode === "reverse" ? "selected" : ""}>🛑 Inversion de polarité câblage -24V (Test SS34)</option>
              <option value="watchdog" ${sim.faultMode === "watchdog" ? "selected" : ""}>🔄 Parasite CEM bloquant le code (Test Watchdog IWDG)</option>
            </select>
          </div>
        </div>

        <div class="callout ${isFault ? "marketing" : ""}">
          <strong>Diagnostic en temps réel :</strong> ${escapeHtml(statusBanner)}
        </div>

        <!-- Schéma Synoptique Interactif SVG -->
        <svg class="svg-diagram" viewBox="0 0 820 250" role="img" aria-label="Synoptique interactif de la carte électronique industrielle">
          <!-- Étage Alimentation -->
          <rect class="box" x="15" y="18" width="175" height="75" rx="10"/>
          <text x="102" y="40" text-anchor="middle" font-weight="700" font-size="12">1. Alim 24V (5,08 mm)</text>
          <text x="102" y="58" text-anchor="middle" font-size="11">PTC MF-MSMF + TVS SMBJ33CA</text>
          <text x="102" y="76" text-anchor="middle" font-size="11">
            ${sim.faultMode === "surge45v" ? "⚡ TVS ÉCRÊTE + PTC ACTIF" : sim.faultMode === "reverse" ? "🛑 BLOQUÉ PAR SS34" : "✅ SS34 → Buck 5V → LDO 3.3V"}
          </text>

          <line class="${sim.faultMode === "reverse" ? "wire" : "wire-active"}" x1="190" y1="55" x2="295" y2="55"/>

          <!-- Cœur Logique MCU -->
          <rect class="box" x="295" y="18" width="220" height="75" rx="10"/>
          <text x="405" y="40" text-anchor="middle" font-weight="700" font-size="12">3. Cœur STM32G0 / ESP32</text>
          <text x="405" y="58" text-anchor="middle" font-size="11">Machine à États Finis + IWDG</text>
          <text x="405" y="76" text-anchor="middle" font-weight="700" font-size="11">
            ${sim.faultMode === "watchdog" ? "🔄 RESET IWDG → ÉTAT SÛR" : isOutputActive ? "🟢 ÉTAT : CYCLE ACTIF" : "⏸️ ÉTAT : ATTENTE"}
          </text>

          <!-- Entrée Capteur + Optocoupleur -->
          <rect class="box" x="15" y="140" width="215" height="86" rx="10"/>
          <text x="122" y="162" text-anchor="middle" font-weight="700" font-size="12">2. Entrée (${escapeHtml(sim.sensorType)}) · 3,81 mm</text>
          <text x="122" y="182" text-anchor="middle" font-size="11">Tension borne : ${escapeHtml(inputVoltageLabel)}</text>
          <text x="122" y="202" text-anchor="middle" font-weight="700" font-size="11">
            Opto TLP290-4 : ${sim.sensorActive ? "💡 LED CMS ALLUMÉE" : "⚫ LED CMS ÉTEINTE"}
          </text>

          <line class="${sim.sensorActive ? "wire-active" : "wire"}" x1="230" y1="182" x2="405" y2="93"/>

          <!-- Sortie Puissance ULN2003A + Relais G5NB -->
          <line class="${isOutputActive ? "wire-active" : "wire"}" x1="515" y1="55" x2="575" y2="140"/>
          <rect class="box" x="545" y="140" width="255" height="86" rx="10"/>
          <text x="672" y="162" text-anchor="middle" font-weight="700" font-size="12">4. Sortie ULN2003A + Relais G5NB</text>
          <text x="672" y="182" text-anchor="middle" font-size="11">Diode de roue libre intégrée (Clamp)</text>
          <text x="672" y="204" text-anchor="middle" font-weight="700" font-size="12">
            ${isOutputActive ? "🟢 CONTACT FERMÉ (Actionneur ON)" : "⚪ CONTACT OUVERT (Sécurité OFF)"}
          </text>
        </svg>
      </div>
    `;
  }

  function renderAuditGridTool() {
    const ab = state.auditBoard;
    return `
      <div class="card">
        <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;">
          <div>
            <span class="pill">📋 Outil Terrain Pilier 1 · Standardisation de l'Audit</span>
            <h2 style="margin-top:6px; margin-bottom:2px;">Grille d'Audit Borne par Borne (Compatible KiCad)</h2>
            <p class="muted" style="margin:0; font-size:0.88rem;">Documentez chaque connecteur sur place et exportez votre relevé en CSV ou Rapport Markdown.</p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn-sm" data-action="export-audit-csv">📥 Exporter CSV (KiCad)</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="copy-audit-md">📋 Copier Rapport Markdown</button>
          </div>
        </div>

        <div class="grid-3" style="margin-bottom:14px;">
          <div class="form-group">
            <label for="audit-client">Client / Atelier :</label>
            <input id="audit-client" type="text" class="form-control" value="${escapeHtml(ab.clientName)}" data-action="audit-meta" data-field="clientName">
          </div>
          <div class="form-group">
            <label for="audit-machine">Machine & Année :</label>
            <input id="audit-machine" type="text" class="form-control" value="${escapeHtml(ab.machineName)}" data-action="audit-meta" data-field="machineName">
          </div>
          <div class="form-group">
            <label for="audit-dims">Cotes PCB & Entraxes (mm) :</label>
            <input id="audit-dims" type="text" class="form-control" value="${escapeHtml(ab.pcbDimensions)}" data-action="audit-meta" data-field="pcbDimensions">
          </div>
        </div>

        <div class="table-wrap" style="margin-bottom:14px;">
          <table>
            <caption>Relevé des connecteurs et signaux électriques de la carte</caption>
            <thead>
              <tr>
                <th scope="col">Connecteur</th>
                <th scope="col">Pin</th>
                <th scope="col">Nom Net KiCad</th>
                <th scope="col">Nature Signal</th>
                <th scope="col">Repos</th>
                <th scope="col">Actif</th>
                <th scope="col">Courant</th>
                <th scope="col">Rôle Fonctionnel</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              ${ab.rows
                .map(
                  (r, idx) => `
                <tr>
                  <td><strong>${escapeHtml(r.conn)}</strong></td>
                  <td>${escapeHtml(r.pin)}</td>
                  <td><code>${escapeHtml(r.name)}</code></td>
                  <td><span class="pill">${escapeHtml(r.type)}</span></td>
                  <td>${escapeHtml(r.idle)}</td>
                  <td>${escapeHtml(r.active)}</td>
                  <td>${escapeHtml(r.current)}</td>
                  <td>${escapeHtml(r.role)}</td>
                  <td>
                    <button type="button" class="btn btn-secondary btn-sm" data-action="delete-audit-row" data-idx="${idx}" aria-label="Supprimer la borne ${escapeHtml(r.name)}">🗑️</button>
                  </td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>

        <!-- Formulaire d'ajout de borne -->
        <div class="card-elevated">
          <h3>➕ Ajouter une borne relevée au multimètre / oscilloscope</h3>
          <div class="grid-4" style="margin-top:10px;">
            <div class="form-group">
              <label for="new-conn">Connecteur (ex. J2)</label>
              <input id="new-conn" type="text" class="form-control" value="J2">
            </div>
            <div class="form-group">
              <label for="new-pin">Broche / Pin</label>
              <input id="new-pin" type="text" class="form-control" value="${ab.rows.length + 1}">
            </div>
            <div class="form-group">
              <label for="new-name">Label KiCad (ex. CAP_PORTE)</label>
              <input id="new-name" type="text" class="form-control" placeholder="CAP_PORTE">
            </div>
            <div class="form-group">
              <label for="new-type">Type de signal</label>
              <select id="new-type" class="form-control">
                <option value="Entrée PNP">Entrée PNP (Source +24V)</option>
                <option value="Entrée NPN">Entrée NPN (Puits 0V)</option>
                <option value="Contact sec">Contact sec</option>
                <option value="Sortie Relais">Sortie Relais (Contact sec)</option>
                <option value="Sortie MOSFET PWM">Sortie MOSFET PWM</option>
                <option value="Alim +24V DC">Alim +24V DC</option>
                <option value="Masse 0V">Masse 0V</option>
              </select>
            </div>
            <div class="form-group">
              <label for="new-idle">Tension Repos</label>
              <input id="new-idle" type="text" class="form-control" value="0 V">
            </div>
            <div class="form-group">
              <label for="new-active">Tension Actif</label>
              <input id="new-active" type="text" class="form-control" value="+24 V">
            </div>
            <div class="form-group">
              <label for="new-current">Courant</label>
              <input id="new-current" type="text" class="form-control" value="10 mA">
            </div>
            <div class="form-group">
              <label for="new-role">Rôle sur la machine</label>
              <input id="new-role" type="text" class="form-control" placeholder="Sécurité capot fermé">
            </div>
          </div>
          <button type="button" class="btn btn-sm" data-action="add-audit-row">➕ Ajouter cette borne à la grille</button>
        </div>
      </div>
    `;
  }

  function renderFinancialCalcTool() {
    const c = state.calcSim;

    const caPcbEtude = c.cardsPerMonth * c.cardPriceHT;
    const totalDebours = c.cardsPerMonth * c.cardDebours;
    const caVocalMrr = c.artisansCount * c.artisanMrrPrice;
    const caVocalSetup = c.artisanSetupCount * c.artisanSetupPrice;
    const caSim = c.simLicensesCount * c.simLicensePrice;

    const totalCaBnc = caPcbEtude + caVocalMrr + caVocalSetup + caSim;
    const cotisationsBnc = Math.round(totalCaBnc * 0.231);
    const infraCost = 20;
    const netMonthly = totalCaBnc - cotisationsBnc - infraCost;
    const hourlyNet = Math.round(netMonthly / Math.max(1, c.hoursPerMonth));

    // Comparaison si pas de débours (si les composants étaient intégrés en BNC à 23,1%)
    const economyDebours = Math.round(totalDebours * 0.231 * 100) / 100;

    return `
      <div class="card">
        <span class="pill indigo">💶 Simulateur Économique & Fiscal Micro-Entreprise (BNC 23,1 % · BIC 12,3 % · Débours 0 %)</span>
        <h2 style="margin-top:8px;">Simulez vos revenus mensuels et votre rentabilité horaire</h2>
        <p class="muted" style="margin-top:0;">Ajustez les curseurs pour modéliser votre portefeuille multi-activités :</p>

        <div class="grid-3" style="margin-top:14px;">
          <div class="card-elevated">
            <h3>🔌 Pilier 1 · Rétro-Ingénierie</h3>
            <div class="form-group">
              <label for="calc-cards">Cartes conçues / mois : <strong>${c.cardsPerMonth}</strong></label>
              <input id="calc-cards" type="range" min="0" max="5" step="1" value="${c.cardsPerMonth}" data-action="calc-input" data-field="cardsPerMonth">
            </div>
            <div class="form-group">
              <label for="calc-card-price">Forfait étude HT / carte (€) : <strong>${c.cardPriceHT} €</strong></label>
              <input id="calc-card-price" type="range" min="1200" max="3500" step="100" value="${c.cardPriceHT}" data-action="calc-input" data-field="cardPriceHT">
            </div>
            <div class="form-group">
              <label for="calc-debours">Coût PCBA en Débours 0 % (€) : <strong>${c.cardDebours} €</strong></label>
              <input id="calc-debours" type="range" min="25" max="250" step="5" value="${c.cardDebours}" data-action="calc-input" data-field="cardDebours">
            </div>
          </div>

          <div class="card-elevated">
            <h3>🎙️ Pilier 2 · Devis Vocal IA</h3>
            <div class="form-group">
              <label for="calc-artisans">Artisans abonnés actifs : <strong>${c.artisansCount}</strong></label>
              <input id="calc-artisans" type="range" min="0" max="15" step="1" value="${c.artisansCount}" data-action="calc-input" data-field="artisansCount">
            </div>
            <div class="form-group">
              <label for="calc-mrr">Abonnement mensuel HT (€) : <strong>${c.artisanMrrPrice} €</strong></label>
              <input id="calc-mrr" type="range" min="200" max="350" step="25" value="${c.artisanMrrPrice}" data-action="calc-input" data-field="artisanMrrPrice">
            </div>
            <div class="form-group">
              <label for="calc-setup-count">Nouveaux setups ce mois : <strong>${c.artisanSetupCount}</strong> (à ${c.artisanSetupPrice} €)</label>
              <input id="calc-setup-count" type="range" min="0" max="5" step="1" value="${c.artisanSetupCount}" data-action="calc-input" data-field="artisanSetupCount">
            </div>
          </div>

          <div class="card-elevated">
            <h3>🎬 Pilier 3 & Temps de Travail</h3>
            <div class="form-group">
              <label for="calc-sim-count">Licences CFA / Packs médias : <strong>${c.simLicensesCount}</strong></label>
              <input id="calc-sim-count" type="range" min="0" max="8" step="1" value="${c.simLicensesCount}" data-action="calc-input" data-field="simLicensesCount">
            </div>
            <div class="form-group">
              <label for="calc-sim-price">Tarif moyen licence/pack (€) : <strong>${c.simLicensePrice} €</strong></label>
              <input id="calc-sim-price" type="range" min="300" max="1200" step="50" value="${c.simLicensePrice}" data-action="calc-input" data-field="simLicensePrice">
            </div>
            <div class="form-group">
              <label for="calc-hours">Heures travaillées / mois : <strong>${c.hoursPerMonth} h</strong> (~${Math.round((c.hoursPerMonth / 4.3) * 10) / 10} h/sem)</label>
              <input id="calc-hours" type="range" min="8" max="80" step="2" value="${c.hoursPerMonth}" data-action="calc-input" data-field="hoursPerMonth">
            </div>
          </div>
        </div>

        <div class="grid-4" style="margin-top:16px;">
          <div class="kpi-card">
            <span class="kpi-label">Chiffre d'Affaires Brut HT</span>
            <span class="kpi-value">${totalCaBnc.toLocaleString("fr-FR")} €</span>
            <span class="muted" style="font-size:0.78rem;">+ ${totalDebours} € de débours (hors CA)</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Dont Rente Récurrente (MRR)</span>
            <span class="kpi-value">${caVocalMrr.toLocaleString("fr-FR")} €</span>
            <span class="muted" style="font-size:0.78rem;">${c.artisansCount} artisans × ${c.artisanMrrPrice} €</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Bénéfice NET Mensuel</span>
            <span class="kpi-value" style="color:var(--ok);">${netMonthly.toLocaleString("fr-FR")} €</span>
            <span class="muted" style="font-size:0.78rem;">Après URSSAF (${cotisationsBnc} €) & API (${infraCost} €)</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Rémunération Horaire Nette</span>
            <span class="kpi-value">${hourlyNet} € / h</span>
            <span class="muted" style="font-size:0.78rem;">Économie débours : +${economyDebours} €</span>
          </div>
        </div>
      </div>
    `;
  }

  /* ==========================================================================
     6. VUE STUDIO MARKETING, PITCH CHRONOMÉTRÉ & PROMPTS IA
     ========================================================================== */
  function renderMarketing() {
    return `
      <section aria-labelledby="mkt-title">
        <div style="margin-bottom:14px;">
          <span class="pill amber">🎯 Studio Marketing, Vente Terrain & Prompts IA</span>
          <h1 id="mkt-title" style="margin-top:6px;">Scripts de Démonstration, Prompts Prêts à Copier & Réponses aux Objections</h1>
          <p class="muted" style="margin:0;">Tous les actifs textuels et prompts techniques prêts à être copiés en un clic sur votre téléphone ou PC.</p>
        </div>

        <!-- Entraîneur Chronométré au Pitch 62 secondes -->
        <div class="card" style="border-color:var(--accent);">
          <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px;">
            <div>
              <span class="pill amber">⏱️ Simulateur d'Entraînement au Pitch « Effet Waouh » (62 secondes)</span>
              <h2 style="margin-top:6px; margin-bottom:2px;">Répétez votre démonstration devant l'artisan</h2>
              <p class="muted" style="margin:0; font-size:0.88rem;">Lancez le chronomètre pour vous entraîner à tenir le rythme exact : Accroche (0–30s) → Dictée (30–50s) → Silence magique (50–62s) → Ouverture PDF.</p>
            </div>
            <div class="btn-row">
              <button type="button" class="btn btn-amber" id="btn-pitch-timer" data-action="toggle-pitch-timer">
                ▶️ Lancer le Chrono Démo (62s)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" data-action="reset-pitch-timer">
                ↺ Remettre à 0s
              </button>
            </div>
          </div>
          <div id="pitch-timer-stage" class="card-elevated" style="margin-top:14px; font-weight:700;">
            Prêt : appuyez sur « Lancer le Chrono Démo » et parlez à voix haute comme devant votre client artisan.
          </div>
        </div>

        <!-- Templates & Prompts copiables en 1 clic -->
        <div class="grid-2">
          ${DATA.templates
            .map(
              (tpl) => `
            <div class="card" style="display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <span class="pill">${escapeHtml(tpl.category)}</span>
                <h2 style="margin-top:8px; font-size:1.15rem;">${escapeHtml(tpl.title)}</h2>
                <p class="muted" style="font-size:0.86rem; margin-top:0;">${escapeHtml(tpl.desc)}</p>
                <pre class="code-box">${escapeHtml(tpl.content)}</pre>
              </div>
              <div class="btn-row" style="margin-top:10px;">
                <button type="button" class="btn btn-sm" data-action="copy-template" data-id="${tpl.id}">
                  📋 Copier dans le presse-papiers
                </button>
              </div>
            </div>
          `
            )
            .join("")}
        </div>

        <!-- Guide de traitement des Objections Clients -->
        <div class="card">
          <span class="pill indigo">🛡️ Guide Anti-Objections Terrain</span>
          <h2 style="margin-top:8px;">Répondre avec calme et autorité aux 4 objections les plus fréquentes</h2>
          <div class="grid-2" style="margin-top:12px;">
            <div class="concept-item">
              <strong>1. « 300 € / mois pour les devis, c'est un budget... » (Artisan)</strong>
              <span>« À 75 € HT de l'heure, vous perdez 25h par mois le soir sur vos devis, soit 1 875 € de temps non facturé. Et surtout, envoyer votre devis en 15 secondes depuis le camion vous fait gagner au moins 1 chantier de plus par mois : l'assistant se rembourse dès la première semaine. »</span>
            </div>
            <div class="concept-item">
              <strong>2. « Et si votre IA se trompe dans mes prix ou ma TVA ? » (Artisan)</strong>
              <span>« L'IA n'invente jamais de tarif : elle pioche strictement dans votre catalogue officiel encodé ensemble. Si vous dictez une pièce hors catalogue, un badge orange "Tarif à compléter" vous demande confirmation avant de générer le PDF. »</span>
            </div>
            <div class="concept-item">
              <strong>3. « Votre carte électronique de remplacement est-elle certifiée CE ? » (Industriel)</strong>
              <span>« Notre intervention relève juridiquement de la maintenance par pièce de rechange "drop-in" remettant en état à l'identique votre machine existante, ce qui dispense de refaire un marquage CE machine neuve. De plus, nous concevons en 4 couches avec plan de masse continu, isolation 2 500 Vrms et protection TVS/PTC. »</span>
            </div>
            <div class="concept-item">
              <strong>4. « Nos ordinateurs au CFA sont verrouillés, on ne peut rien installer. » (Formateur)</strong>
              <span>« C'est précisément pour cela que nos simulateurs sont des applications web progressives (PWA) : aucun exécutable à installer, ils s'ouvrent instantanément dans le navigateur des PC, tablettes ou smartphones des apprentis via un simple lien ou QR Code. »</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  /* ==========================================================================
     RENDU PRINCIPAL & RECHERCHE GLOBALE
     ========================================================================== */
  function renderMain() {
    const main = document.getElementById("main-content");
    if (!main) return;

    let html = "";
    switch (state.view) {
      case "dashboard":
        html = renderDashboard();
        break;
      case "academy":
        html = renderAcademy();
        break;
      case "evaluation":
        html = renderEvaluation();
        break;
      case "roadmap":
        html = renderRoadmap();
        break;
      case "tools":
        html = renderTools();
        break;
      case "marketing":
        html = renderMarketing();
        break;
      default:
        html = renderDashboard();
    }

    main.innerHTML = html;
    updateGlobalProgressUI();
  }

  /* ==========================================================================
     MODALE DE CERTIFICATION & SYNCHRONISATION MULTI-APPAREILS
     ========================================================================== */
  function openDialogModal(title, bodyHtml) {
    const dlg = document.getElementById("app-dialog");
    const titleEl = document.getElementById("dialog-title");
    const contentEl = document.getElementById("dialog-body");
    if (!dlg || !titleEl || !contentEl) return;
    titleEl.textContent = title;
    contentEl.innerHTML = bodyHtml;
    dlg.showModal();
  }

  function showCertificationModal() {
    const stats = getStats();
    const level =
      stats.overallPct >= 80
        ? "🏆 Architecte & Entrepreneur Prêt au Déploiement"
        : stats.overallPct >= 50
        ? "⚡ Praticien Avancé en Phase d'Accélération"
        : "🌱 En cours d'acquisition des fondamentaux";

    openDialogModal(
      "Bilan de Maîtrise & Certification Reload Technologies",
      `
        <div class="card-elevated" style="text-align:center; padding:22px;">
          <span class="pill ok" style="font-size:0.85rem;">${level}</span>
          <h3 style="font-size:1.5rem; margin:10px 0 4px;">Score Global : ${stats.overallPct} %</h3>
          <p class="muted" style="margin:0;">
            ${stats.doneModules} / ${stats.totalModules} modules étudiés ·
            ${stats.correctQuiz} / ${stats.totalQuiz} questions de quiz réussies ·
            ${stats.doneRoadmap} / ${stats.totalRoadmap} jalons terrain cochés
          </p>
        </div>
        <div class="callout" style="margin-top:14px;">
          <strong>Prochain cap vers les 2 200 € net/mois :</strong>
          Complétez les modules restants, validez les 3 scénarios terrain et cochez vos jalons du Mois 1 dans l'onglet « Plan 90 Jours ».
        </div>
      `
    );
  }

  function showSyncModal() {
    openDialogModal(
      "Synchronisation Smartphone · Tablette · PC & Thème",
      `
        <div class="form-group">
          <label for="theme-select-control">🎨 Apparence visuelle (Clair / Sombre / Système) :</label>
          <select id="theme-select-control" class="form-control" data-action="change-theme-scheme">
            <option value="light dark">Système automatique (Recommandé)</option>
            <option value="light">Mode Clair forcé</option>
            <option value="dark">Mode Sombre forcé</option>
          </select>
        </div>

        <hr style="border:0; border-top:1px solid var(--border); margin:16px 0;">

        <h3>📲 Transférer votre progression entre PC, Tablette et Smartphone</h3>
        <p class="muted" style="font-size:0.86rem; margin-top:4px;">
          Vos données (modules validés, quiz, notes, grille d'audit PCB, avancement 90 jours) sont enregistrées automatiquement sur cet appareil. Vous pouvez exporter une sauvegarde JSON ou l'importer sur un autre appareil :
        </p>
        <div class="btn-row" style="margin-bottom:14px;">
          <button type="button" class="btn btn-sm" data-action="export-state-json">💾 Télécharger ma sauvegarde (.json)</button>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
            📂 Importer une sauvegarde (.json)
            <input type="file" accept="application/json" style="display:none;" data-action="import-state-json">
          </label>
        </div>
      `
    );

    const meta = document.querySelector('meta[name="color-scheme"]');
    const sel = document.getElementById("theme-select-control");
    if (meta && sel) {
      sel.value = meta.content || "light dark";
    }
  }

  /* ==========================================================================
     GESTIONNAIRES D'ÉVÉNEMENTS DÉLÉGUÉS (CLAVIER, SOURIS, TACTILE)
     ========================================================================== */
  document.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-nav-view]");
    if (navBtn) {
      setView(navBtn.getAttribute("data-nav-view"));
      return;
    }

    const actionEl = e.target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-action");

    if (action === "go-view") {
      setView(actionEl.getAttribute("data-view"));
    } else if (action === "open-module") {
      state.currentModuleIndex = Number(actionEl.getAttribute("data-index")) || 0;
      setView("academy");
    } else if (action === "filter-track") {
      state.trackFilter = actionEl.getAttribute("data-track") || "all";
      const firstIdx = DATA.modules.findIndex(
        (m) => state.trackFilter === "all" || m.track === state.trackFilter
      );
      if (firstIdx >= 0) state.currentModuleIndex = firstIdx;
      setView("academy");
    } else if (action === "set-track") {
      state.trackFilter = actionEl.getAttribute("data-track") || "all";
      const firstIdx = DATA.modules.findIndex(
        (m) => state.trackFilter === "all" || m.track === state.trackFilter
      );
      if (firstIdx >= 0) state.currentModuleIndex = firstIdx;
      saveState();
      renderMain();
    } else if (action === "select-module") {
      state.currentModuleIndex = Number(actionEl.getAttribute("data-index")) || 0;
      saveState();
      renderMain();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (action === "toggle-module-done") {
      const id = actionEl.getAttribute("data-id");
      const idx = state.completedModules.indexOf(id);
      if (idx >= 0) {
        state.completedModules.splice(idx, 1);
        announce("Module rouvert.");
      } else {
        state.completedModules.push(id);
        announce("Bravo ! Module marqué comme acquis.");
      }
      saveState();
      renderMain();
    } else if (action === "flip-flashcard") {
      const pressed = actionEl.getAttribute("aria-pressed") === "true";
      const nextPressed = !pressed;
      actionEl.setAttribute("aria-pressed", String(nextPressed));
      const body = actionEl.querySelector(".fc-body");
      const hint = actionEl.querySelector(".fc-hint");
      const pill = actionEl.querySelector(".pill");
      if (body && hint && pill) {
        if (nextPressed) {
          pill.textContent = "✅ Réponse";
          body.textContent = actionEl.getAttribute("data-a");
          hint.textContent = "🔄 Cliquer pour revenir à la question";
        } else {
          pill.textContent = "❓ Question";
          body.textContent = actionEl.getAttribute("data-q");
          hint.textContent = "🔄 Cliquer pour voir la réponse";
        }
      }
    } else if (action === "answer-module-quiz") {
      const modId = actionEl.getAttribute("data-mod");
      const qi = Number(actionEl.getAttribute("data-qi"));
      const oi = Number(actionEl.getAttribute("data-oi"));
      state.quizAnswers[`${modId}_${qi}`] = oi;
      saveState();
      renderMain();
    } else if (action === "answer-scenario") {
      const scId = actionEl.getAttribute("data-sc");
      const si = Number(actionEl.getAttribute("data-si"));
      const ci = Number(actionEl.getAttribute("data-ci"));
      state.scenarioProgress[`${scId}_${si}`] = ci;
      saveState();
      renderMain();
    } else if (action === "reset-quizzes") {
      state.quizAnswers = {};
      state.scenarioProgress = {};
      saveState();
      renderMain();
      announce("Tous les quiz et cas pratiques ont été réinitialisés.");
    } else if (action === "set-roadmap-tab") {
      state.roadmapTab = actionEl.getAttribute("data-tab");
      saveState();
      renderMain();
    } else if (action === "quick-check-task") {
      const tId = actionEl.getAttribute("data-task-id");
      if (tId && !state.checkedRoadmap.includes(tId)) {
        state.checkedRoadmap.push(tId);
        saveState();
        renderMain();
        announce("Étape validée dans votre plan 90 jours !");
      }
    } else if (action === "kpi-step") {
      const kpi = actionEl.getAttribute("data-kpi");
      const delta = Number(actionEl.getAttribute("data-delta")) || 0;
      if (kpi in state.kpis) {
        state.kpis[kpi] = Math.max(0, (state.kpis[kpi] || 0) + delta);
        saveState();
        renderMain();
      }
    } else if (action === "set-tool-tab") {
      state.toolTab = actionEl.getAttribute("data-tab");
      saveState();
      renderMain();
    } else if (action === "sim-toggle-sensor") {
      state.circuitSim.sensorActive = !state.circuitSim.sensorActive;
      saveState();
      renderMain();
    } else if (action === "add-audit-row") {
      const conn = document.getElementById("new-conn")?.value.trim() || "J1";
      const pin = document.getElementById("new-pin")?.value.trim() || "1";
      const name = document.getElementById("new-name")?.value.trim() || `NET_${state.auditBoard.rows.length + 1}`;
      const type = document.getElementById("new-type")?.value || "Entrée PNP";
      const idle = document.getElementById("new-idle")?.value.trim() || "0 V";
      const active = document.getElementById("new-active")?.value.trim() || "+24 V";
      const current = document.getElementById("new-current")?.value.trim() || "10 mA";
      const role = document.getElementById("new-role")?.value.trim() || "Signal industriel";
      state.auditBoard.rows.push({ conn, pin, name, type, idle, active, current, role });
      saveState();
      renderMain();
      announce(`Borne ${name} ajoutée à la grille d'audit.`);
    } else if (action === "delete-audit-row") {
      const idx = Number(actionEl.getAttribute("data-idx"));
      state.auditBoard.rows.splice(idx, 1);
      saveState();
      renderMain();
    } else if (action === "export-audit-csv") {
      const ab = state.auditBoard;
      const lines = [
        ["Connecteur", "Pin", "Nom_Net_KiCad", "Type_Signal", "Tension_Repos", "Tension_Actif", "Courant", "Role_Fonctionnel"].join(";")
      ];
      ab.rows.forEach((r) => {
        lines.push([r.conn, r.pin, r.name, r.type, r.idle, r.active, r.current, r.role].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";"));
      });
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_pcb_${ab.clientName.replace(/\s+/g, "_").toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      announce("Grille d'audit exportée en CSV pour KiCad !");
    } else if (action === "copy-audit-md") {
      const ab = state.auditBoard;
      let md = `# Rapport d'Audit Rétro-Ingénierie — ${ab.clientName}\n`;
      md += `- **Équipement :** ${ab.machineName}\n- **Cotes & Entraxes :** ${ab.pcbDimensions}\n\n`;
      md += `| Connecteur | Pin | Net KiCad | Type | Repos | Actif | Courant | Rôle |\n|---|---|---|---|---|---|---|---|\n`;
      ab.rows.forEach((r) => {
        md += `| ${r.conn} | ${r.pin} | \`${r.name}\` | ${r.type} | ${r.idle} | ${r.active} | ${r.current} | ${r.role} |\n`;
      });
      navigator.clipboard?.writeText(md);
      announce("Rapport d'audit Markdown copié dans le presse-papiers !");
    } else if (action === "copy-template") {
      const id = actionEl.getAttribute("data-id");
      const tpl = DATA.templates.find((t) => t.id === id);
      if (tpl) {
        navigator.clipboard?.writeText(tpl.content);
        announce(`« ${tpl.title} » copié dans le presse-papiers !`);
      }
    } else if (action === "toggle-pitch-timer") {
      if (pitchTimerInterval) {
        clearInterval(pitchTimerInterval);
        pitchTimerInterval = null;
        const btn = document.getElementById("btn-pitch-timer");
        if (btn) btn.textContent = "▶️ Reprendre le Chrono";
        return;
      }
      const btn = document.getElementById("btn-pitch-timer");
      if (btn) btn.textContent = "⏸️ Pause Chrono";
      pitchTimerInterval = setInterval(() => {
        pitchSeconds++;
        const stage = document.getElementById("pitch-timer-stage");
        if (!stage) return;
        let phaseText = "";
        if (pitchSeconds <= 30) {
          phaseText = `⏱️ ${pitchSeconds}s / 62s — ÉTAPE 1 : L'ACCROCHE (0–30s) : Parlez de la corvée des devis à 20h et sortez votre téléphone.`;
        } else if (pitchSeconds <= 50) {
          phaseText = `🎙️ ${pitchSeconds}s / 62s — ÉTAPE 2 : LA DICTÉE LIVE (30–50s) : Dictez le cas M. Martin (tableau 3 rangées + prise Green'Up + 2h dépannage, TVA 10 %).`;
        } else if (pitchSeconds <= 62) {
          phaseText = `🤫 ${pitchSeconds}s / 62s — ÉTAPE 3 : LE SILENCE MAGIQUE (50–62s) : Posez le téléphone sur la table sans rien toucher. Attendez le « Bip » !`;
        } else {
          phaseText = `💥 ${pitchSeconds}s — ÉTAPE 4 : LE COUP DE GRÂCE : Ouvrez le PDF normé NF C 15-100 devant l'artisan et proposez l'installation pilote !`;
        }
        stage.textContent = phaseText;
      }, 1000);
    } else if (action === "reset-pitch-timer") {
      if (pitchTimerInterval) {
        clearInterval(pitchTimerInterval);
        pitchTimerInterval = null;
      }
      pitchSeconds = 0;
      const stage = document.getElementById("pitch-timer-stage");
      const btn = document.getElementById("btn-pitch-timer");
      if (btn) btn.textContent = "▶️ Lancer le Chrono Démo (62s)";
      if (stage) stage.textContent = "Chrono remis à 0s. Prêt pour une nouvelle répétition !";
    } else if (action === "open-cert-modal") {
      showCertificationModal();
    } else if (action === "open-sync-modal") {
      showSyncModal();
    } else if (action === "export-state-json") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reload-cockpit-sauvegarde.json";
      a.click();
      URL.revokeObjectURL(url);
      announce("Sauvegarde JSON téléchargée !");
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    const action = el.getAttribute("data-action");
    if (!action) return;

    if (action === "toggle-roadmap-task") {
      const id = el.getAttribute("data-id");
      const idx = state.checkedRoadmap.indexOf(id);
      if (el.checked && idx === -1) {
        state.checkedRoadmap.push(id);
        announce("Étape cochée !");
      } else if (!el.checked && idx >= 0) {
        state.checkedRoadmap.splice(idx, 1);
      }
      saveState();
      renderMain();
    } else if (action === "sim-sensor-type") {
      state.circuitSim.sensorType = el.value;
      saveState();
      renderMain();
    } else if (action === "sim-fault-mode") {
      state.circuitSim.faultMode = el.value;
      saveState();
      renderMain();
    } else if (action === "change-theme-scheme") {
      const val = el.value;
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.content = val;
      try {
        if (val === "light dark") localStorage.removeItem("color-scheme");
        else localStorage.setItem("color-scheme", val);
      } catch (err) {}
      announce("Thème visuel mis à jour.");
    } else if (action === "import-state-json") {
      const file = el.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(String(reader.result));
          state = { ...structuredClone(defaultState), ...imported };
          saveState();
          renderNavState();
          renderMain();
          document.getElementById("app-dialog")?.close();
          announce("Progression importée avec succès !");
        } catch (err) {
          announce("Fichier JSON invalide.");
        }
      };
      reader.readAsText(file);
    }
  });

  document.addEventListener("input", (e) => {
    const el = e.target;
    const action = el.getAttribute("data-action");

    if (action === "save-module-note") {
      const modId = el.getAttribute("data-mod");
      state.moduleNotes[modId] = el.value;
      saveState();
    } else if (action === "calc-input") {
      const field = el.getAttribute("data-field");
      state.calcSim[field] = Number(el.value);
      saveState();
      renderMain();
    } else if (action === "audit-meta") {
      const field = el.getAttribute("data-field");
      state.auditBoard[field] = el.value;
      saveState();
    } else if (el.id === "global-search-input") {
      const q = el.value.trim().toLowerCase();
      if (q.length < 2) return;
      const matchIdx = DATA.modules.findIndex(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subtitle.toLowerCase().includes(q) ||
          m.points.some((p) => p[0].toLowerCase().includes(q) || p[1].toLowerCase().includes(q))
      );
      if (matchIdx >= 0) {
        state.trackFilter = "all";
        state.currentModuleIndex = matchIdx;
        state.view = "academy";
        renderNavState();
        renderMain();
      }
    }
  });

  // Fallback mandatory for <dialog closedby="any"> on browsers without native closedBy support
  function setupDialogFallback() {
    const dialog = document.getElementById("app-dialog");
    if (!dialog) return;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      dialog.addEventListener("click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      });
    }
  }

  // Register Service Worker for offline PWA usage on Smartphone/Tablet/PC
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupDialogFallback();
    renderNavState();
    renderMain();
  });
})();
