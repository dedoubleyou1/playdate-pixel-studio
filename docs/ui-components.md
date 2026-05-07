# UI Component Policy

This project uses shadcn as the source of truth for reusable UI primitives.

## Rules

- Add or refresh primitives with the shadcn CLI:

  ```sh
  npx shadcn@latest add button
  ```

- Keep files in `src/components/ui` close to the shadcn registry output.
- Prefer customization at usage sites with `className`, CSS variables, and app-level composition.
- Avoid one-off local versions of common controls such as buttons, selects, dialogs, popovers, sliders, switches, labels, and text inputs.
- Raw HTML controls are acceptable when they are the actual platform primitive being used directly, such as canvas elements or hidden file inputs.

## Migration Checklist

When touching UI code:

1. Check whether a shadcn primitive already exists in `src/components/ui`.
2. If it does not exist, add it with `npx shadcn@latest add <component>`.
3. Keep registry component changes minimal and easy to re-apply.
4. Move product-specific presentation into app components or `styles.css`.
5. Before committing, run a quick raw-control audit:

   ```sh
   rg -n "<button\\b|<select\\b|<input\\b|<textarea\\b" src/components
   ```

6. Document any intentional exceptions in the commit or nearby code.
