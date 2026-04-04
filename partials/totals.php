    <section id="totals" class="page-section">
      <h2>Totaux par jour</h2>
      <div class="card totals-toolbar">
        <label>Tri par
          <select id="totalsSortBy">
            <option value="dateIso">Date</option>
            <option value="countMilkEntries">Nb tirages</option>
            <option value="totalMilkPumped">Total tire-lait</option>
            <option value="countBottleEntries">Nb biberons</option>
            <option value="totalBottle">Total biberon</option>
          </select>
        </label>
        <label>Ordre
          <select id="totalsSortOrder">
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </select>
        </label>
        <label>Période
          <select id="totalsPeriod">
            <option value="all">Toutes les dates</option>
            <option value="30">30 derniers jours</option>
            <option value="7">7 derniers jours</option>
          </select>
        </label>
      </div>
      <div class="card table-wrap">
        <table id="totalsTable">
          <thead>
            <tr>
              <th>Date</th>
              <th>Nb tirages</th>
              <th>Total tire-lait (ml)</th>
              <th>Nb biberons</th>
              <th>Total biberon (ml)</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
