# Bienvenue chez les fous

Site immersif de la campagne de JDR (apocalypse zombie, 2039), en trois pages :

- `index.html` : l'accueil. Écran d'avertissement (maintenir pour entrer), rue en 3D éclairée à la lampe torche, fragments d'ambiance, puis les deux portes.
- `histoire.html` : le synopsis complet, à lire d'une traite. La caméra suit le récit : la rue, la foule, les portiques, l'héliport, le décollage.
- `personnage.html` : les six classes (dossiers interactifs), l'interrogatoire pour choisir et l'inscription sur le Google Sheet.

Site statique, sans étape de build. Les bibliothèques viennent d'un CDN : Three.js (3D), GSAP + ScrollTrigger (animations), Lenis (défilement doux). Tous les sons sont synthétisés dans le navigateur (Web Audio), sans fichier audio.

## Le lien du Google Sheet

Dans `assets/js/perso.js`, renseignez la constante en haut du fichier :

```js
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/.../edit';
```

Tant qu'elle est vide, le bouton affiche « Inscriptions bientôt ouvertes » et reste désactivé.

## Modifier le contenu

- Texte de l'histoire : `histoire.html`, un paragraphe par balise `<p class="s-p">`.
- Classes et questions de l'interrogatoire : tableaux `CLASSES` et `QUESTIONS` dans `assets/js/perso.js`.
- Couleurs et polices : bloc `:root` en haut de `assets/css/main.css`.
- La ville 3D (points de vue, lumières, foule) : `assets/js/world.js`.

## Tester en local

Les modules JavaScript ne se chargent pas en ouvrant le fichier directement : il faut un petit serveur.

```bash
npx http-server -p 8080 -c-1
```

Puis ouvrez http://localhost:8080.

## Déploiement

Cloudflare Workers (fichiers statiques), configuré dans `wrangler.jsonc`. Chaque `git push` sur `main` relance le déploiement. `.assetsignore` liste les fichiers qui ne sont pas publiés.
