# Tableau recapitulatif Tire-Lait + Biberon

Projet simple en **HTML / CSS / JS / PHP** pour suivre :
- Les entrees quotidiennes (tire-lait + biberon)
- L'historique complet
- Les totaux par jour
- Un graphique d'evolution
- Une page Parametres pour connecter Firebase

## Lancer le projet

Depuis le dossier du projet :

```bash
php -S localhost:8000
```

Puis ouvre : `http://localhost:8000`

## Configurer Firebase Realtime Database

1. Ouvre l'onglet **Parametres**
2. Renseigne :
   - `Code salon` (ex: `famille2026`)
   - `Database URL` (ex: `https://xxx-default-rtdb.europe-west1.firebasedatabase.app`)
   - `Token` (optionnel selon tes regles de securite)
3. Coche **Activer la synchro cloud**
4. Clique **Enregistrer et connecter**

Les entrees seront stockees dans :

`/rooms/<codeSalon>/entries`

## Notes

- Les donnees de configuration sont en local dans `data/settings.json`.
- Si la synchro cloud est inactive, les listes sont vides (pas de stockage local offline dans cette version).

