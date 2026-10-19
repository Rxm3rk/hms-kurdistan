import { hmsVitestConfig } from '../../vitest.shared.ts';

export default hmsVitestConfig('design-system', { environment: 'jsdom', setupFiles: ['test/setup.ts'] });
