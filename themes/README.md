# Example themes

Custom themes are single CSS files. Import one in the app under **Settings › Darstellung › Eigenes Theme › Datei importieren**.

| File | What it does |
| --- | --- |
| `mitternacht.css` | Dark blue, always dark |
| `kompakt.css` | Less spacing, more fits on screen |
| `kontrast.css` | High contrast in light and dark mode |
| `pastell.css` | Soft colours and round corners |

The full guide (header, variables, selectors, rules) is on the website: https://stundenplan.severinwehrle.dev/#docs/themes

Quick rules:

- The first comment is the header: `@name`, `@author`, `@version`, `@base` (a built-in style) and `@mode` (`light`, `dark` or `auto`).
- No `@import` and no links to the internet. Images and fonts only as `data:` URIs.
- At most 200 KB. Up to 60 KB the active theme syncs to your other devices.
- If a theme breaks the app, open it with `?safe` (for example `popup.html?full&safe`) to start without it.
