/**
 * The specimen label preview: a 50 x 25 mm thermal label drawn in SVG (one user unit = 0.1 mm), printed in
 * black on white as a label printer would: patient name in Latin and Sorani script, MRN, date of birth, sex,
 * specimen and tube, priority, collection time and collector, a Code 128 barcode of the specimen id and a
 * small two-dimensional symbol.
 *
 * The Code 128 (code set B) bars are encoded from the specimen id; the square symbol is a SIMULATED
 * DataMatrix-like pattern (not a decodable symbol). The printer is simulated too. Labels are physical
 * objects and lay out left to right in every UI language; the label's printed captions are the laboratory's
 * Latin abbreviations (MRN, DOB, COLL), as analysers and lab staff read them.
 */
import type { ReactNode } from 'react';
import type { Patient, StaffMember } from '../../data/index.ts';
import { TUBE_PRINT, clockTime, type LabSpecimen } from './lab-data.ts';

// Code 128 bar/space widths for values 0 to 106 (103-105: start A/B/C, 106: stop).
const CODE128: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

/** Module widths (bar, space, bar, …) of `text` in Code 128 set B, with check symbol and stop. */
export function code128B(text: string): readonly number[] {
  const values: number[] = [104];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 127) {
      values.push(code - 32);
    }
  }
  let sum = 104;
  values.forEach((value, index) => {
    if (index > 0) {
      sum += value * index;
    }
  });
  values.push(sum % 103, 106);
  return values.flatMap((value) => Array.from(CODE128[value] ?? '').map(Number));
}

/** A deterministic pseudo-random generator seeded from a string (for the simulated 2D symbol). */
function seeded(text: string): () => number {
  let h = 2166136261;
  for (const char of text) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000) / 1000;
  };
}

function Barcode({ text, x, y, width, height }: { readonly text: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number }): ReactNode {
  const widths = code128B(text);
  const quiet = 10;
  const modules = widths.reduce((total, w) => total + w, 0) + quiet * 2;
  const unit = width / modules;
  const bars: ReactNode[] = [];
  let cursor = x + quiet * unit;
  widths.forEach((w, index) => {
    if (index % 2 === 0) {
      bars.push(<rect key={index} x={cursor} y={y} width={w * unit} height={height} className="lab-label__ink" />);
    }
    cursor += w * unit;
  });
  return <g>{bars}</g>;
}

function MatrixSymbol({ text, x, y, size }: { readonly text: string; readonly x: number; readonly y: number; readonly size: number }): ReactNode {
  const n = 16;
  const cell = size / n;
  const random = seeded(text);
  const cells: ReactNode[] = [];
  for (let row = 0; row < n; row += 1) {
    for (let col = 0; col < n; col += 1) {
      const finder = col === 0 || row === n - 1;
      const clock = (row === 0 && col % 2 === 0) || (col === n - 1 && row % 2 === 1);
      const inner = row > 0 && row < n - 1 && col > 0 && col < n - 1;
      if (finder || clock || (inner && random() > 0.52)) {
        cells.push(<rect key={`${String(row)}-${String(col)}`} x={x + col * cell} y={y + row * cell} width={cell} height={cell} className="lab-label__ink" />);
      }
    }
  }
  return <g>{cells}</g>;
}

/** Condense a line that would not fit (the label printer's condensed mode), never cut it. */
function fit(text: string, size: number, max: number): { readonly textLength?: number; readonly lengthAdjust?: 'spacingAndGlyphs' } {
  const estimate = Array.from(text).length * size * 0.56;
  return estimate > max ? { textLength: max, lengthAdjust: 'spacingAndGlyphs' } : {};
}

export interface SpecimenLabelProps {
  readonly specimen: LabSpecimen;
  readonly patient: Patient;
  /** The collection instant printed on the label (the demo clock at collection). */
  readonly collectedIso: string;
  readonly collector: StaffMember | undefined;
  /** The label's accessible name (localised summary of what is printed). */
  readonly label: string;
}

function latinInitials(member: StaffMember | undefined): string {
  if (member === undefined) {
    return '';
  }
  return member.name.latin
    .split(/\s+/u)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function dobPrint(patient: Patient): string {
  if (patient.dobPrecision === 'day') {
    return `${patient.dob.slice(8, 10)}/${patient.dob.slice(5, 7)}/${patient.dob.slice(0, 4)}`;
  }
  return patient.dobApproximate ? `${patient.dob} (APPROX)` : patient.dob;
}

export function SpecimenLabel({ specimen, patient, collectedIso, collector, label }: SpecimenLabelProps): ReactNode {
  const textMax = 352;
  const latin = patient.name.latin.toUpperCase();
  const sorani = patient.name.ckb;
  const date = `${collectedIso.slice(8, 10)}/${collectedIso.slice(5, 7)}/${collectedIso.slice(0, 4)}`;
  const line4 = `${specimen.specimenType.en} · ${specimen.panel.en}`;
  const line3 = `MRN ${patient.mrn}   DOB ${dobPrint(patient)}   ${patient.sex === 'female' ? 'F' : 'M'}`;
  const line5 = `COLL ${date} ${clockTime(collectedIso)}   BY ${latinInitials(collector)}`;
  const urgent = specimen.priority !== 'routine';
  return (
    <svg className="lab-label" viewBox="0 0 500 250" role="img" aria-label={label} dir="ltr">
      <rect x="1" y="1" width="498" height="248" rx="14" className="lab-label__paper" />
      <text x="20" y="38" className="lab-label__text lab-label__text--bold" fontSize="28" {...fit(latin, 28, textMax)}>
        {latin}
      </text>
      <text x="20" y="70" className="lab-label__text" fontSize="25" lang="ckb" {...fit(sorani, 22, textMax)}>
        {sorani}
      </text>
      <text x="20" y="98" className="lab-label__text lab-label__text--bold" fontSize="19" {...fit(line3, 19, textMax)}>
        {line3}
      </text>
      <text x="20" y="124" className="lab-label__text" fontSize="18" {...fit(line4, 18, textMax)}>
        {line4}
      </text>
      <text x="20" y="150" className="lab-label__text" fontSize="18" {...fit(line5, 18, textMax)}>
        {line5}
      </text>
      <MatrixSymbol text={specimen.id} x={392} y={14} size={84} />
      <rect x="392" y="106" width="88" height="26" rx="3" className="lab-label__ink" />
      <text x="436" y="125" textAnchor="middle" className="lab-label__text lab-label__text--inverse lab-label__text--bold" fontSize="15">
        {TUBE_PRINT[specimen.container]}
      </text>
      {urgent ? (
        <>
          <rect x="392" y="137" width="88" height="24" rx="3" className="lab-label__paper lab-label__box" />
          <text x="436" y="155" textAnchor="middle" className="lab-label__text lab-label__text--bold" fontSize="15">
            {specimen.priority.toUpperCase()}
          </text>
        </>
      ) : null}
      <Barcode text={specimen.id} x={14} y={166} width={472} height={54} />
      <text x="250" y="242" textAnchor="middle" className="lab-label__text lab-label__text--mono" fontSize="17">
        {specimen.id}
      </text>
    </svg>
  );
}
