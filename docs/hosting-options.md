# Hosting Options

Firebase Hosting is the default choice for this project because the app is a static Vite SPA and Firebase matches the preferred ecosystem.

| Option | Fit | Pros | Tradeoffs |
| --- | --- | --- | --- |
| Firebase Hosting | Best fit | Firebase ecosystem, CDN, SSL, custom domains, PR previews, rollbacks | More setup than Vercel or Netlify |
| Vercel | Strong alternative | Excellent previews, frontend DX, rollbacks, observability | Less aligned with Firebase projects |
| Netlify | Strong alternative | Atomic deploys, branch deploys, simple redirects and headers | Another platform to manage |
| Cloudflare Pages | Good DNS/CDN option | Fast global network, Git deploys, rollbacks | Less Firebase-native |
| GitHub Pages | Lowest complexity | Simple static hosting | Weaker previews, deploy controls, and observability |
| Squarespace Hosting | Not recommended | Useful for CMS and marketing pages | Brittle for SPA routing, CI/CD, previews, and asset delivery |

Use Squarespace for DNS only unless the project intentionally becomes a Squarespace CMS site.
