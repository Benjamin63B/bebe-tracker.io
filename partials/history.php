    <section id="history" class="page-section">
      <h2>Historique</h2>
      <div class="card history-toolbar">
        <label>Recherche
          <input type="text" id="historySearch" placeholder="Ex: tétée, 90, 31 mars...">
        </label>
        <label>Tri par
          <select id="historySortBy">
            <option value="dateTime">Date puis heure</option>
            <option value="milkPumpedMl">Tire-lait (ml) dans la journée</option>
            <option value="bottleMl">Biberon (ml) dans la journée</option>
          </select>
        </label>
        <label>Ordre
          <select id="historySortOrder">
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </label>
      </div>
      <div class="card history-date-range">
        <p class="history-date-range-title">Filtrer par période</p>
        <div class="history-date-range-inner">
          <label>Du
            <input type="date" id="historyDateFrom" autocomplete="off">
          </label>
          <label>Au
            <input type="date" id="historyDateTo" autocomplete="off">
          </label>
          <button type="button" id="historyDateClear" class="btn-secondary history-date-clear">Effacer les dates</button>
        </div>
      </div>
      <div class="card history-quick-filters">
        <button type="button" class="history-chip" data-filter-group="type" data-filter-value="bottle">🍼 Biberon</button>
        <button type="button" class="history-chip" data-filter-group="type" data-filter-value="milk">👩‍🍼 Tirage</button>
        <button type="button" class="history-chip" data-filter-group="period" data-filter-value="1">📅 Aujourd'hui</button>
        <button type="button" class="history-chip" data-filter-group="period" data-filter-value="7">📅 7 jours</button>
        <button type="button" class="history-chip" data-filter-group="period" data-filter-value="30">📅 30 jours</button>
        <button type="button" class="history-chip" data-filter-group="volume" data-filter-value="gt100">🔢 &gt;100ml</button>
        <button type="button" class="history-chip" data-filter-group="volume" data-filter-value="lt100">🔢 &lt;100ml</button>
      </div>
      <div class="grid-2 history-split">
        <div class="card table-wrap">
          <h3>Historique Biberon</h3>
          <table id="historyBottleTable">
            <thead>
              <tr>
                <th class="history-col-date"></th>
                <th scope="col">Heure</th>
                <th scope="col" aria-label="Biberon en millilitres">
                  <span class="history-th-long">Biberon (ml)</span>
                  <span class="history-th-short">Ml</span>
                </th>
                <th scope="col">Note</th>
                <th scope="col" aria-label="Actions">
                  <span class="history-th-long">Actions</span>
                  <span class="history-th-short">Act.</span>
                </th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="card table-wrap">
          <h3>Historique Tirage</h3>
          <table id="historyMilkTable">
            <thead>
              <tr>
                <th class="history-col-date"></th>
                <th scope="col">Heure</th>
                <th scope="col" aria-label="Tire-lait en millilitres">
                  <span class="history-th-long">Tire-lait (ml)</span>
                  <span class="history-th-short">Ml</span>
                </th>
                <th scope="col">Note</th>
                <th scope="col" aria-label="Actions">
                  <span class="history-th-long">Actions</span>
                  <span class="history-th-short">Act.</span>
                </th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </section>
