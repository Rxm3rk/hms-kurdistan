/**
 * The web app's entry point (docs/specs/modules/design-system.md §4). The stylesheets are imported once
 * here: the design system's (fonts, tokens, components) and the frame's. The demo module is `null` unless
 * the build sets `VITE_HMS_DEMO=1` (vite.config.ts; OQ-142).
 */
import '@hms/design-system/styles.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app.tsx';
import { createAppServices } from './app/create-services.ts';
import { demoModule } from './demo/selected.ts';
import { createAppRouter } from './routing/route-tree.tsx';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html has no #root element');
}

const services = createAppServices({ demo: demoModule });
const router = createAppRouter({ demo: demoModule });

createRoot(container).render(
  <StrictMode>
    <App services={services} router={router} />
  </StrictMode>,
);
