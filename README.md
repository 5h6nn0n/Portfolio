# Project Portfolio Archive

A responsive web portfolio and searchable project archive hosted on GitHub Pages.

**Live Site:** https://5h6nn0n.github.io

## Key Features

* **Interactive Project Archive (`archive.html`):** Experience search and category filtering, case studies, AI/analytics projects, and research papers, with a persistent light/dark setting toggle.
* **Inline PDF Document Viewer (`docpage.html`):** Renders academic papers onto an HTML canvas using **Mozilla PDF.js**, backed by **Cloudflare R2** storage and a **Cloudflare Worker** enforcing CORS and hotlink protection.
* **Serverless Contact (`contact.html`):** A custom validated contact form routed through the **EmailJS** REST API via Gmail OAuth to a single **Proton Mail** inbox, with honeypot spam filtering and zero URL query leaks.

## Tech Stack

* **Frontend:** HTML5, CSS3, SVG, Vanilla JavaScript (ES6+), Tailwind CSS
* **Infrastructure / APIs:** GitHub Pages, Cloudflare Workers & R2, Mozilla PDF.js, EmailJS

## Local Development

```bash
## Copyright

© 2026 5h6nn0n. All rights reserved. The source code, visual design, and written content in this repository are proprietary and may not be copied, reproduced, or distributed without permission.
