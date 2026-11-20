# Example themes

Custom themes are single CSS files. Import one in the app under **Settings › Darstellung › Eigenes Theme › Datei importieren**.

| File | What it does |
| --- | --- |
| `mitternacht.css` | Night blue with glass and stars, always dark. Centred header, tabs as a floating dock at the bottom, side column on the right |
| `kompakt.css` | Dense and flat. Sidebar with vertical tabs in the big view, segmented tabs in the popup, lessons as table rows |
| `kontrast.css` | High contrast in light and dark mode, bigger text, no animations. Big tab tiles with icons, one wide column |
| `pastell.css` | Candy colours and round shapes. Centred notebook layout, pill tabs, exams as tilted sticky notes in a grid |

The full guide (header, variables, selectors, rules) is on the website: https://stundenplan.severinwehrle.dev/#docs/themes

Quick rules:

- The first comment is the header: `@name`, `@author`, `@version`, `@base` (a built-in style) and `@mode` (`light`, `dark` or `auto`).
- No `@import` and no links to the internet. Images and fonts only as `data:` URIs.
- Your rules win over the built-in styles automatically, no `!important` needed. Layout changes work too (see the examples).
- At most 200 KB. Up to 60 KB the active theme syncs to your other devices.
- If a theme breaks the app, open it with `?safe` (for example `popup.html?full&safe`) to start without it.
