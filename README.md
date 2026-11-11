# Portfolio

The personal site of Ramudzuli Ricardo Ralejiba: about, experience, skills, projects, and
NdalamoPDF to download.

Plain HTML, CSS and JavaScript, no build step. Everything you read on the site comes from
`content/site.json`; pictures, videos and the CV live in `media/` and `cv/`. The admin site edits
those, so the pages themselves rarely change.

- `index.html`: the home page. `project.html?p=<slug>`: one project.
- `assets/css/site.css`: styles, light and dark. `assets/js/site.js`: fills the pages.

Preview locally: `python -m http.server 8765`, then open http://127.0.0.1:8765.
