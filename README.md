# RCSprints website

A lightweight static website designed for GitHub Pages. No build step or package install is required.

## Publish on GitHub Pages
1. Upload the contents of this folder to the root of your repository (keep `assets/`, `index.html`, `style.css`, and `script.js` together).
2. In the repository, open **Settings → Pages**.
3. Choose **Deploy from a branch**, select your main branch and `/ (root)`, then save.
4. Open the published URL after GitHub Pages finishes deploying.

## Included
- Responsive navigation and page switching
- Print catalog with search and featured items
- Cart with quantity controls and order-request submission
- Print estimate calculator
- Custom model request form
- Browser-local catalog/material editor
- The supplied school photo and shield logo in `assets/` (shield is also the favicon)
- `.nojekyll` so GitHub Pages serves the files as-is

## Important limitations
- Orders/forms use the existing Formspree endpoint in `script.js`. Verify that endpoint is yours and active before launch.
- This site does not collect payment. Cart submissions are order requests only.
- GitHub Pages is static hosting. The admin password is visible in client-side JavaScript, and catalog edits save only in the current browser's local storage; they do not update the live repository. Do not treat this admin screen as secure or use it for private information. Real multi-user administration requires a backend or authenticated service.
- Product designs/prices are starter content carried forward from the supplied page; edit them before representing them as confirmed inventory.
- Google Fonts is optional. If unavailable, the page uses fallback fonts.
