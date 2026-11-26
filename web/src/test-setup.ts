import '@testing-library/jest-dom/vitest'

// jsdom has no scrolling; React Router's ScrollRestoration calls it on navigation.
window.scrollTo = () => {}
