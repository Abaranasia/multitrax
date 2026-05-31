# Testing Conventions

### Structure

```
src/__tests__/

```

### Custom Hook Testing Policy

**Presentation logic hooks (`use{ComponentName}`) are not tested in isolation.** They are an implementation detail of their owning component and are covered by that component's tests.

- **Test the component, not the hook.** Write tests against the rendered `.tsx` file and assert user-visible outcomes: what appears on screen, what happens when the user clicks/types/scrolls.
- **Every user action should have a test.** If a user can trigger it (click, scroll, input, keyboard), there must be a test for it at the component level.
- **Do not write dedicated hook test files** for component-scoped hooks (e.g., `usePortalApp`, `useScrollButton`). These tests are tightly coupled to internal implementation and become fragile when refactoring.
- **Exception — reusable hooks.** If a hook lives outside a single component context and is shared across features (e.g., a generic `usePagination`, `useDebounce`), it may have its own test file using `RenderHook`.
- **Rationale.** Testing from the user's perspective (what is rendered and what actions do) makes tests resilient to internal refactors. Swapping a hook's internals should never break a test as long as the UI behaviour is unchanged.