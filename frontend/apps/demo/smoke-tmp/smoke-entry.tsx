/**
 * TEMPORARY smoke harness (deleted after the integration pass): renders the real prototype app in jsdom for
 * every screen, locale and role and reports render crashes. Not part of the app.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createAppServices } from '../src/app/create-services.ts';
import { ProtoApp } from '../src/proto/shell/app.tsx';
import { protoModule } from '../src/proto/shell/proto-module.ts';
import { createProtoRouter } from '../src/proto/shell/routes.tsx';

export interface Scenario {
  readonly url: string;
  readonly role: string;
}

export interface Outcome {
  readonly url: string;
  readonly role: string;
  readonly errors: readonly string[];
  readonly textLength: number;
  readonly h1: string;
  readonly hasBanner: boolean;
  readonly hasRibbon: boolean;
  readonly dir: string;
  readonly snippet: string;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function runScenario(scenario: Scenario, errors: string[]): Promise<Outcome> {
  window.localStorage.setItem('hms-proto.role', scenario.role);
  window.history.replaceState(null, '', scenario.url);
  document.getElementById('root')?.remove();
  const container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  const services = createAppServices({ demo: protoModule });
  const router = createProtoRouter();
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(<ProtoApp services={services} router={router} />);
    await sleep(30);
  });
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await sleep(60);
    });
  }
  const main = document.querySelector('main') ?? container;
  const text = main.textContent ?? '';
  const outcome: Outcome = {
    url: scenario.url,
    role: scenario.role,
    errors: [...errors],
    textLength: text.length,
    h1: Array.from(document.querySelectorAll('h1'), (h) => h.textContent ?? '').join(' | ').slice(0, 120),
    hasBanner: document.querySelector('.shell-clinical__banner') !== null,
    hasRibbon: document.querySelector('[data-testid="prototype-ribbon"]') !== null,
    dir: document.documentElement.getAttribute('dir') ?? (document.querySelector('[dir]')?.getAttribute('dir') ?? ''),
    snippet: /Something went wrong|Error:|undefined|NaN|\[object Object\]/.test(text)
      ? (text.match(/.{0,80}(Something went wrong|Error:|undefined|NaN|\[object Object\]).{0,80}/)?.[0] ?? '')
      : '',
  };
  await act(async () => {
    root?.unmount();
    await sleep(10);
  });
  container.innerHTML = '';
  return outcome;
}
