This src/ tree hosts the layered architecture:

- app/ (Next.js App Router: views + controllers via route handlers/server actions)
- components/ (UI components: common + feature-sliced)
- constants/ (global constants)
- libs/ (library initializations/config, e.g., Firebase)
- models/ (domain models and view models)
- repositories/ (infrastructure adapters to DB/SaaS)
- services/ (application/use-case layer)
- utils/ (shared utility functions)

Migration will proceed feature-by-feature to avoid breaking changes.