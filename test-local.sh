export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/metardu"
export AUTH_SECRET="super-secret-key-for-testing"
npx playwright test e2e/landing.spec.ts e2e/responsive-a11y.spec.ts
