/**
 * Entry point of the HMS Kurdistan clickable prototype (throwaway demo, SYNTHETIC DATA, NOT FOR CLINICAL
 * USE). The design system's stylesheet is imported once here, then the frame's; the prototype's own
 * stylesheets come with its modules (src/proto/ui/ui.css, src/proto/shell/shell.css, one per screen).
 */
import '@hms/design-system/styles.css';
import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAppServices } from './app/create-services.ts';
import { ProtoApp } from './proto/shell/app.tsx';
import { protoModule } from './proto/shell/proto-module.ts';
import { createProtoRouter } from './proto/shell/routes.tsx';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('index.html has no #root element');
}

const services = createAppServices({ demo: protoModule });
const router = createProtoRouter();

createRoot(container).render(
  <StrictMode>
    <ProtoApp services={services} router={router} />
  </StrictMode>,
);
