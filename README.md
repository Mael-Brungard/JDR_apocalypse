# Bienvenue chez les fous

Site vitrine du JDR en trois pages :

- `index.html` : accueil (ambiance, contexte, aperçu des 6 classes)
- `histoire.html` : l'histoire, à lire scène par scène
- `personnage.html` : les fiches de classe, le test pour choisir et le lien vers la feuille de personnage

Site statique, sans build ni dépendance (seule la police vient de Google Fonts).
Fichiers partagés : `style.css` (toute la mise en forme), `histoire.js` (lecture scène par scène), `perso.js` (test de classe et choix).

## Avant de publier : le lien du Google Sheets

Dans `personnage.html`, remplacez `VOTRE_ID_ICI` par l'identifiant de votre feuille (2 occurrences : la barre du haut et l'appel final).

Le lien doit ressembler à :

```
https://docs.google.com/spreadsheets/d/VOTRE_ID_ICI/copy
```

Finir par `/copy` oblige chaque joueur à créer sa propre copie de la feuille au lieu de modifier l'originale.

## Publier sur GitHub

```bash
git init
git add .
git commit -m "Site vitrine du JDR"
git branch -M main
git remote add origin https://github.com/VOTRE_COMPTE/VOTRE_DEPOT.git
git push -u origin main
```

## Déployer sur Cloudflare Pages

1. Cloudflare > Workers & Pages > Create > Pages > Connect to Git.
2. Choisissez le dépôt.
3. Framework preset : `None`. Build command : laissez vide. Build output directory : `/` (la racine).
4. Save and Deploy.

Chaque `git push` redéploie le site automatiquement.

## Modifier le contenu

- Textes de l'histoire : `histoire.html`, une balise `<article class="scene">` par scène.
- Fiches de classe et questions du test : `personnage.html`.
- Couleurs : bloc `:root` en haut de `style.css`.
