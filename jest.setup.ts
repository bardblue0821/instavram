// Extend Jest with Testing Library's custom matchers
import '@testing-library/jest-dom';

// Minimal mocks for Next.js App Router hooks when components import them
jest.mock('next/navigation', () => {
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(''),
    useParams: () => ({}),
  };
});
