    <section id="today" class="page-section">
      <div id="homeHero" class="hero card">
        <div class="hero-content">
          <p class="hero-badge">Dashboard 2026 - Vue rapide</p>
          <h2>Suivi intelligent de la journée</h2>
          <p class="hero-subtitle">Visualise en un coup d'oeil les tirages, les biberons et la progression du jour.</p>
          <div class="hero-meta" aria-hidden="true">
            <span class="hero-meta-pill">Suivi en temps reel</span>
            <span class="hero-meta-pill">Mise a jour instantanee</span>
            <span class="hero-meta-pill">Vue ultra rapide</span>
          </div>
        </div>
        <div class="hero-stats">
          <div class="stat-chip stat-chip-neutral">
            <span>Entrées</span>
            <strong id="statEntriesCount">0</strong>
          </div>
          <div class="stat-chip stat-chip-milk">
            <span>Entrées tirage 👩‍🍼</span>
            <strong id="statMilkEntriesCount">0</strong>
          </div>
          <div class="stat-chip stat-chip-bottle">
            <span>Entrées biberon 🍼</span>
            <strong id="statBottleEntriesCount">0</strong>
          </div>
          <div class="stat-chip stat-chip-milk">
            <span>Tire-lait 👩‍🍼</span>
            <strong id="statMilkTotal">0 ml</strong>
          </div>
          <div class="stat-chip stat-chip-bottle">
            <span>Biberon 🍼</span>
            <strong id="statBottleTotal">0 ml</strong>
          </div>
          <div class="stat-chip stat-chip-neutral">
            <span>Total</span>
            <strong id="statGlobalTotal">0 ml</strong>
          </div>
          <div class="stat-chip stat-chip-wide">
            <span>Progression tire-lait du jour 👩‍🍼</span>
            <strong id="statProgressText">0%</strong>
            <div class="progress-track" aria-hidden="true">
              <div id="statProgressBar" class="progress-fill"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-intro">
        <h2>Nouvelle entrée</h2>
        <p>Renseigne rapidement une prise, puis vérifie le récapitulatif juste en dessous.</p>
      </div>
      <form id="entryForm" class="card">
        <div class="grid-2">
          <label>Date
            <input type="date" id="entryDate" required>
          </label>
          <label>Heure
            <input type="time" id="entryTime" required>
          </label>
        </div>

        <div class="grid-2">
          <div class="block mint">
            <h3>Tirage 👩‍🍼</h3>
            <label>Millilitres tirés
              <input type="number" id="milkPumpedMl" min="0" step="10" value="0" required>
            </label>
            <label class="toggle inline-toggle">
              <input type="checkbox" id="breastfedFlag">
              Tétée associée
            </label>
          </div>
          <div class="block sky">
            <h3>Biberon 🍼</h3>
            <label>Millilitres au biberon
              <input type="number" id="bottleMl" min="0" step="10" value="0" required>
            </label>
            <div class="quick-values" data-target="bottleMl">
              <button type="button" class="quick-value-btn" data-value="80">80ml</button>
              <button type="button" class="quick-value-btn" data-value="100">100ml</button>
              <button type="button" class="quick-value-btn" data-value="110">110ml</button>
            </div>
            <label class="toggle inline-toggle">
              <input type="checkbox" id="breastfedFlagBottle">
              Tétée associée
            </label>
          </div>
        </div>

        <div class="block rose">
          <h3>Tétée 🤱</h3>
          <label class="toggle inline-toggle">
            <input type="checkbox" id="breastfedOnlyFlag">
            Ajouter une entrée tétée (sans ml)
          </label>
        </div>

        <label>Note (facultatif)
          <input type="text" id="entryNote" placeholder="Ex: côté gauche, après la sieste...">
        </label>

        <div class="actions">
          <button type="submit" class="btn-primary">Ajouter au tableau</button>
          <button type="reset" class="btn-secondary">Réinitialiser</button>
        </div>
      </form>

      <div class="card">
        <h3>Entrées du jour</h3>
        <div id="todayList" class="list"></div>
      </div>
    </section>
