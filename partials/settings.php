    <section id="settings" class="page-section">
      <h2>Paramètres Firebase</h2>
      <form id="settingsForm" class="card">
        <label>Code salon (famille)
          <input type="text" id="roomCode" placeholder="famille2026" required>
        </label>
        <label>Database URL (Firebase Realtime Database)
          <input type="url" id="databaseUrl" placeholder="https://xxx-default-rtdb.europe-west1.firebasedatabase.app" required>
        </label>
        <label>Chemin des données (optionnel)
          <input type="text" id="entriesPath" placeholder="rooms/{roomCode}/entries">
        </label>
        <label class="toggle">
          <input type="checkbox" id="syncEnabled">
          Activer la synchro cloud
        </label>
        <button type="submit" class="btn-primary">Enregistrer et connecter</button>
      </form>
      <p id="syncStatus" class="status"></p>
    </section>
