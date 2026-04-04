    <section id="stock-history" class="page-section">
      <h2>Historique de stocks</h2>
      <div class="card totals-toolbar">
        <label>Trier par
          <select id="stockHistorySortBy">
            <option value="movement">Date du mouvement</option>
            <option value="pump">Date du tirage</option>
            <option value="expiry">Péremption</option>
          </select>
        </label>
        <label>Ordre
          <select id="stockHistorySortOrder">
            <option value="desc">Plus récent d'abord</option>
            <option value="asc">Plus ancien d'abord</option>
          </select>
        </label>
      </div>
      <div class="card history-date-range">
        <p class="history-date-range-title">Filtrer par période (date du mouvement)</p>
        <div class="history-date-range-inner">
          <label>Du
            <input type="date" id="stockHistoryDateFrom" autocomplete="off">
          </label>
          <label>Au
            <input type="date" id="stockHistoryDateTo" autocomplete="off">
          </label>
          <button type="button" id="stockHistoryDateClear" class="btn-secondary history-date-clear">Effacer les dates</button>
        </div>
      </div>
      <div class="card table-wrap">
        <table id="stocksHistoryTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Date tirage</th>
              <th>Péremption</th>
              <th>Mouvement</th>
              <th>Volume (ml)</th>
              <th>FIFO</th>
              <th scope="col" aria-label="Actions">Actions</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
