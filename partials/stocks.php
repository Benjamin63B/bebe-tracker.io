    <section id="stocks" class="page-section">
      <h2>Stocks lait congelé / avancé</h2>
      <div class="card stock-kpis">
        <div class="stat-chip">
          <span>Stock congelé total</span>
          <strong id="stockFrozenMl">0 ml</strong>
        </div>
        <div class="stat-chip">
          <span>Sorties FIFO (congelé)</span>
          <strong id="stockFifoOutMl">0 ml</strong>
        </div>
      </div>

      <form id="stockForm" class="card">
        <div class="grid-2">
          <label>Date
            <input type="date" id="stockDate" required>
          </label>
          <label>Heure
            <input type="time" id="stockTime" required>
          </label>
        </div>
        <div class="grid-2">
          <label>Date du tirage
            <input type="date" id="stockPumpDate" required>
          </label>
          <label>Péremption estimée
            <input type="date" id="stockExpiryDate" required>
          </label>
        </div>
        <label>Type de mouvement
          <select id="stockDirection">
            <option value="in">Entrée (+)</option>
            <option value="out">Sortie (-)</option>
          </select>
        </label>
        <label>Volume (ml)
          <input type="number" id="stockAmountMl" min="0" step="10" value="0" required>
        </label>
        <label>Note (facultatif)
          <input type="text" id="stockNote" placeholder="Ex: sachet 120ml, décongelé pour biberon...">
        </label>
        <div class="actions">
          <button type="submit" class="btn-primary">Ajouter mouvement</button>
        </div>
        <p id="stockFifoHint" class="status"></p>
      </form>

      <div class="card table-wrap">
        <table id="stocksTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Heure</th>
              <th>Date tirage</th>
              <th>Péremption</th>
              <th>Mouvement</th>
              <th>Volume (ml)</th>
              <th>FIFO</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
