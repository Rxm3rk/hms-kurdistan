/**
 * The patient wristband, drawn as an SVG at the proportions of a real adult band (25 x 280 mm; one SVG unit
 * is one millimetre). It is a physical label, so its layout does not mirror in right-to-left locales: the
 * strap tail is always at one end and the clasp at the other; the Sorani and Arabic text inside still reads
 * right to left.
 *
 * - Name in the patient's own Arabic-script form (Sorani, or Arabic for Arabic-script patients) and in Latin.
 * - Two identifiers: MRN and date of birth (with age and sex).
 * - A DataMatrix-looking square: a deterministic pseudo-pattern from the MRN (finder L and clock edges, data
 *   modules from a seeded generator). It is labelled "DataMatrix (simulated)" and encodes nothing.
 * - A red allergy band, printed in all three languages, when the patient has recorded allergies.
 */
import type { ReactNode } from 'react';
import { HOSPITAL, SEX_LABEL, type Patient } from '../../data/index.ts';
import { formatDate, useFormat, useT } from '../../i18n/use-t.ts';
import { messages } from './messages.ts';
import { ALLERGY_BAND } from './reference.ts';

const BAND_W = 280;
const BAND_H = 25;
const DM_MODULES = 18;
const DM_SIZE = 16.2;
const DM_X = 224;
const DM_Y = 2.2;

/** FNV-1a hash of a string: the seed of the pseudo-pattern. */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/** mulberry32: a small deterministic generator, so the same MRN always draws the same square. */
function generator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The dark modules of the simulated DataMatrix, as one SVG path in module units. */
export function dataMatrixPath(payload: string, modules = DM_MODULES): string {
  const random = generator(hash(payload));
  const parts: string[] = [];
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      const finder = x === 0 || y === modules - 1;
      const topClock = y === 0 && x % 2 === 0;
      const rightClock = x === modules - 1 && (modules - 1 - y) % 2 === 0;
      const edge = x === 0 || y === 0 || x === modules - 1 || y === modules - 1;
      const dark = finder || topClock || rightClock || (!edge && random() < 0.5);
      if (dark) {
        parts.push(`M${String(x)} ${String(y)}h1v1h-1z`);
      }
    }
  }
  return parts.join('');
}

/** A font size that keeps `text` within `width` mm (never truncated: long names get smaller, not cut). */
function fit(text: string, width: number, base: number): number {
  const estimate = Array.from(text).length * 0.56 * base;
  return estimate <= width ? base : Math.max(1.6, (width / estimate) * base);
}

export function wristbandDob(patient: Patient, locale: 'en' | 'ckb' | 'ar'): string {
  return patient.dobPrecision === 'day' ? formatDate(patient.dob, locale, 'short') : patient.dob;
}

export interface WristbandSvgProps {
  readonly patient: Patient;
}

export function WristbandSvg({ patient }: WristbandSvgProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const allergies = patient.allergies.kind === 'list' ? patient.allergies.items : [];
  const allergic = allergies.length > 0;
  const arabicName = patient.name.ownScript === 'ar' ? patient.name.ar : patient.name.ckb;
  const dob = wristbandDob(patient, f.locale);
  const dobText = patient.dobApproximate ? `${dob} (${t('wbApprox')})` : dob;
  const nameX = allergic ? 88 : 52;
  const nameWidth = DM_X - 5 - nameX;
  const allergenText = allergies.map((item) => item.substance.en).join(', ');
  const payload = `${patient.mrn}|${patient.dob}|${patient.name.latin}`;
  const label = t('wbAria', { name: patient.name.latin, mrn: patient.mrn, dob });
  return (
    <svg
      className="patients-wb__svg"
      viewBox={`0 0 ${String(BAND_W)} ${String(BAND_H)}`}
      role="img"
      aria-label={label}
      data-print="wristband"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{label}</title>
      {/* The band */}
      <rect className="patients-wb__band" x="0.2" y="0.2" width={BAND_W - 0.4} height={BAND_H - 0.4} rx="4" />
      {/* Strap tail: adjustment holes */}
      {[8, 14, 20, 26, 32].map((x) => (
        <circle key={x} className="patients-wb__hole" cx={x} cy={BAND_H / 2} r="1.3" />
      ))}
      <rect className="patients-wb__snap" x="38" y="7.5" width="5" height="10" rx="1.2" />
      {/* Allergy band */}
      {allergic ? (
        <g>
          <rect className="patients-wb__allergy" x="48" y="0.2" width="36" height={BAND_H - 0.4} />
          <text className="patients-wb__allergy-text" x="66" y="6.4" fontSize="3.3" fontWeight="700" textAnchor="middle">
            {ALLERGY_BAND.en}
          </text>
          <text className="patients-wb__allergy-text" x="66" y="10.9" fontSize="3.1" fontWeight="700" textAnchor="middle" direction="rtl">
            {ALLERGY_BAND.ckb}
          </text>
          <text className="patients-wb__allergy-text" x="66" y="15.3" fontSize="3.1" fontWeight="700" textAnchor="middle" direction="rtl">
            {ALLERGY_BAND.ar}
          </text>
          <text className="patients-wb__allergy-text" x="66" y="20.6" fontSize={fit(allergenText, 33, 2.5)} textAnchor="middle">
            {allergenText}
          </text>
        </g>
      ) : null}
      {/* Name, own Arabic-script form then Latin */}
      <text className="patients-wb__text" x={nameX} y="7.2" fontSize={fit(arabicName, nameWidth, 4.4)} fontWeight="700" lang={patient.name.ownScript === 'ar' ? 'ar' : 'ckb'}>
        {arabicName}
      </text>
      <text className="patients-wb__text" x={nameX} y="12.2" fontSize={fit(patient.name.latin, nameWidth, 3.5)} fontWeight="700" lang="ckb-Latn">
        {patient.name.latin}
      </text>
      {/* Two identifiers */}
      <text className="patients-wb__text" x={nameX} y="17.4" fontSize="2.9">
        <tspan className="patients-wb__muted">{t('wbMrn')} </tspan>
        <tspan fontWeight="700">{patient.mrn}</tspan>
      </text>
      <text className="patients-wb__text" x={nameX + 50} y="17.4" fontSize={fit(`${t('wbDob')} ${dobText} · ${f.text(SEX_LABEL[patient.sex])}`, nameWidth - 50, 2.9)}>
        <tspan className="patients-wb__muted">{t('wbDob')} </tspan>
        <tspan fontWeight="700">{dobText}</tspan>
        <tspan className="patients-wb__muted"> · {f.text(SEX_LABEL[patient.sex])} · {f.age(patient.dob)}</tspan>
      </text>
      <text className="patients-wb__muted" x={nameX} y="22.3" fontSize={fit(f.text(HOSPITAL.shortName), nameWidth, 2.1)}>
        {f.text(HOSPITAL.shortName)} · {t('wbSynthetic')}
      </text>
      {/* Simulated DataMatrix */}
      <rect className="patients-wb__band-fill" x={DM_X - 0.8} y={DM_Y - 0.8} width={DM_SIZE + 1.6} height={DM_SIZE + 1.6} />
      <path
        className="patients-wb__dm"
        d={dataMatrixPath(payload)}
        transform={`translate(${String(DM_X)} ${String(DM_Y)}) scale(${String(DM_SIZE / DM_MODULES)})`}
      />
      <text className="patients-wb__muted" x={DM_X + DM_SIZE / 2} y="22.6" fontSize="1.75" textAnchor="middle">
        {t('wbDataMatrix')}
      </text>
      {/* Clasp end */}
      <rect className="patients-wb__snap" x="248" y="7.5" width="5" height="10" rx="1.2" />
      {[260, 267].map((x) => (
        <circle key={x} className="patients-wb__hole" cx={x} cy={BAND_H / 2} r="1.3" />
      ))}
    </svg>
  );
}

export interface WristbandPreviewProps {
  readonly patient: Patient;
  /** Set once "Print wristband (simulated)" was pressed: the time it was "printed". */
  readonly printedIso?: string | null;
}

/** The wristband on a print-preview sheet, with its size and the simulated-printer note. */
export function WristbandPreview({ patient, printedIso }: WristbandPreviewProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <figure className="patients-wb">
      <div className="patients-wb__sheet">
        <WristbandSvg patient={patient} />
      </div>
      <figcaption className="patients-wb__caption">
        <span>{t('wbCaption')}</span>
        {printedIso === undefined || printedIso === null ? null : (
          <span className="patients-wb__printed">{t('wbPrinted', { time: f.time(printedIso) })}</span>
        )}
      </figcaption>
    </figure>
  );
}
