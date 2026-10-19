import { hmsVitestConfig } from '../../vitest.shared.ts';

export default hmsVitestConfig('web', { environment: 'jsdom', setupFiles: ['test/setup.ts'] });
