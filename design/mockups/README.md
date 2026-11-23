# Approved mockups (reference for implementation)

Static HTML exports of the approved design canvas. Open them in a browser and match them.

- Dash-*.html / .png: internal dashboard retheme (sidebar, Home light/dark, Campaigns light, Reports dark).
  The <style> block in each Dash file is the reference CSS: tokens (.light/.dark), sidebar, glass (.g), KPI tiles,
  stage tiles, workflow steps, tabs, segmented control, badges, empty state, help button.
- Main, Industries, Industry-*, Region-*, Product-*, Compare-*, About, Contact (.html): marketing pages with section colours and glass.
- marketing-glass.css: the exact glass block to append to apps/web/src/components/marketing/site/site.css.

These are references only. Do not import them into the app.
