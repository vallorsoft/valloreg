// jest-dom matcherek (toBeInTheDocument, toHaveTextContent, …) a Vitest expecthez.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Minden teszt után a renderelt DOM takarítása (izoláció a tesztek között).
afterEach(() => {
  cleanup();
});
