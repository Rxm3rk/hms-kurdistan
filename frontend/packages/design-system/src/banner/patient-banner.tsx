/**
 * `PatientBanner`: the one patient banner (BUILD-PROMPT.md §2.1 SI-16 and SI-01, §9.1, §9.4, §14.2;
 * docs/specs/modules/design-system.md §2.1; CTRL-0016-3, CTRL-0016-4, CTRL-0001-4, CTRL-0005-3).
 *
 * Never a per-screen implementation: the `_clinical` route layout renders this component on every clinical
 * route (CTRL-0016-5). It is a landmark region (`<section>` named "Patient banner"), not an ARIA `banner`
 * landmark, which means the page header.
 *
 * It renders a `BannerModel` that ui-core's parseBannerData built from untrusted data field by field, in
 * reading order from the start edge (mirrored in right-to-left locales by logical layout): the identity
 * (PatientIdentity: the error state, photo, every name form, MRN, date of birth), then allergies, code
 * status, isolation and the dated weight. Every field shows its own missing or unavailable state:
 *
 * - **Allergies** (CTRL-0016-4): "No known allergies (NKA)", "Allergies not assessed", "Allergy status
 *   unavailable", or every allergy, each substance whole with its reaction and severity where recorded,
 *   wrapping onto more lines, never collapsed behind a "more" control.
 * - **Code status** and **isolation**: governed labels (rule 6), "not documented" or "none recorded", or
 *   unavailable.
 * - **Weight** (SI-05, CTRL-0005-3, CTRL-0005-17): the weight in kilograms through `ClinicalNumber`, with
 *   its source and the date measured; "No dated weight" or "Weight unavailable".
 *
 * The section carries `data-error-state` and `data-signing-blocked` from the model, so the `_clinical`
 * layout's tests can see the state that disables the route's clinical actions (rule 4; DN-032). The layout
 * itself disables them from the same model; the banner holds no action of its own apart from `actions`.
 */
import {
  GROUP_SEPARATOR,
  type AllergiesField,
  type BannerModel,
  type CodeStatusField,
  type IsolationField,
  type UnitDisplayMap,
  type WeightField,
} from '@hms/ui-core';
import type { ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { Bdi } from '../bdi/bdi.tsx';
import { ClinicalNumber } from '../clinical-number/clinical-number.tsx';
import { Message } from '../message/message.tsx';
import { messageKey } from '../message-key.ts';
import { BannerStatus } from './banner-status.tsx';
import { GovernedLabel } from './governed-label.tsx';
import { PatientIdentity } from './patient-identity.tsx';

const WEIGHT_SOURCE_KEYS = {
  measured: 'banner.weight.source.measured',
  stated: 'banner.weight.source.stated',
  estimated: 'banner.weight.source.estimated',
} as const;

/**
 * The weight's unit display map. ui-core's banner model accepts only `kg` and shows it as `kg`; the model
 * passes on the display form, so the map is keyed by that form. A display form outside it (a later change in
 * ui-core) makes ClinicalNumber show "Invalid value", never a guessed unit.
 */
const WEIGHT_DISPLAY_UNITS: UnitDisplayMap = new Map([['kg', 'kg']]);

/**
 * The decimal string ClinicalNumber takes, from the display form the banner model keeps: the display form
 * without its U+202F group separators (DN-031). A display form has a leading zero, no trailing zero and no
 * redundant leading zero, so ClinicalNumber shows exactly the model's text again (checked by
 * UnitTest:banner-renders-every-field). Characters only: no numeric conversion, no arithmetic (SI-05) [P]
 * (OQ-161).
 */
function decimalOf(displayNumber: string): string {
  return displayNumber.replaceAll(GROUP_SEPARATOR, '');
}

function Allergies({ allergies }: { readonly allergies: AllergiesField }): ReactNode {
  switch (allergies.status) {
    case 'nka':
      return <BannerStatus status="allergies.nka" />;
    case 'not-assessed':
      return <BannerStatus status="allergies.notAssessed" />;
    case 'unavailable':
      return <BannerStatus status="allergies.unavailable" />;
    case 'list':
      return (
        <>
          <BannerStatus status="allergies.list">
            <Message id="banner.allergies.count" values={{ count: allergies.items.length }} />
          </BannerStatus>
          <ul className="hms-banner__list hms-banner__allergy-list">
            {allergies.items.map((item, index) => (
              // The list is never reordered or filtered, so the position is a stable key; two items may share
              // a substance code (two reactions recorded), so the code alone is not unique.
              <li key={`${String(index)}:${item.substance.code}`} className="hms-banner__allergy">
                <span className="hms-banner__allergy-substance">
                  <GovernedLabel concept={item.substance} />
                </span>
                {item.reaction === undefined ? null : (
                  <span className="hms-banner__allergy-detail" data-detail="reaction">
                    <GovernedLabel concept={item.reaction} />
                  </span>
                )}
                {item.severity === undefined ? null : (
                  <span className="hms-banner__allergy-detail" data-detail="severity">
                    <GovernedLabel concept={item.severity} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      );
  }
}

function CodeStatus({ codeStatus }: { readonly codeStatus: CodeStatusField }): ReactNode {
  switch (codeStatus.status) {
    case 'documented':
      return (
        <BannerStatus status="codeStatus.documented">
          <Message
            id="banner.codeStatus.recordedOn"
            values={{
              status: <GovernedLabel concept={codeStatus.concept} />,
              date: <Bdi dir="ltr">{codeStatus.recordedOn}</Bdi>,
            }}
          />
        </BannerStatus>
      );
    case 'not-documented':
      return <BannerStatus status="codeStatus.notDocumented" />;
    case 'unavailable':
      return <BannerStatus status="codeStatus.unavailable" />;
  }
}

function Isolation({ isolation }: { readonly isolation: IsolationField }): ReactNode {
  switch (isolation.status) {
    case 'active':
      return (
        <BannerStatus status="isolation.active">
          <span role="list" className="hms-banner__list">
            {isolation.precautions.map((precaution, index) => (
              <span
                role="listitem"
                key={`${String(index)}:${precaution.code}`}
                className="hms-banner__list-item"
              >
                <GovernedLabel concept={precaution} />
              </span>
            ))}
          </span>
        </BannerStatus>
      );
    case 'none-recorded':
      return <BannerStatus status="isolation.noneRecorded" />;
    case 'unavailable':
      return <BannerStatus status="isolation.unavailable" />;
  }
}

function Weight({ weight }: { readonly weight: WeightField }): ReactNode {
  switch (weight.status) {
    case 'recorded':
      return (
        <span className="hms-banner__weight" data-status="weight.recorded">
          <Message
            id="banner.weight.value"
            values={{
              // Through ClinicalNumber (§2.1 "Weight"), so its display rules, its isolation and its invalid
              // state reach the banner unchanged.
              weight: (
                <ClinicalNumber
                  value={decimalOf(weight.quantity.number)}
                  unit={weight.quantity.unit}
                  unitDisplayMap={WEIGHT_DISPLAY_UNITS}
                />
              ),
              source: <Message id={WEIGHT_SOURCE_KEYS[weight.source]} />,
              date: <Bdi dir="ltr">{weight.measuredOn}</Bdi>,
            }}
          />
        </span>
      );
    case 'none-recorded':
      return <BannerStatus status="weight.missing" />;
    case 'unavailable':
      return <BannerStatus status="weight.unavailable" />;
  }
}

export interface PatientBannerProps {
  /** The banner data as ui-core's parseBannerData returns it. */
  readonly model: BannerModel;
  /** The layout's patient controls (close, change), shown at the end of the banner. */
  readonly actions?: ReactNode;
}

export function PatientBanner({ model, actions }: PatientBannerProps): ReactNode {
  const intl = useIntl();
  return (
    <section
      className="hms-banner"
      aria-label={intl.formatMessage({ id: messageKey('banner.region.label') })}
      data-error-state={model.errorState}
      data-signing-blocked={model.signingBlocked}
      data-identity-incomplete={model.identityIncomplete}
    >
      <PatientIdentity model={model} />
      <dl className="hms-banner__fields hms-banner__clinical">
        <div className="hms-banner__field" data-field="allergies">
          <dt className="hms-banner__label">
            <Message id="banner.allergies.label" />
          </dt>
          <dd className="hms-banner__value">
            <Allergies allergies={model.allergies} />
          </dd>
        </div>
        <div className="hms-banner__field" data-field="codeStatus">
          <dt className="hms-banner__label">
            <Message id="banner.codeStatus.label" />
          </dt>
          <dd className="hms-banner__value">
            <CodeStatus codeStatus={model.codeStatus} />
          </dd>
        </div>
        <div className="hms-banner__field" data-field="isolation">
          <dt className="hms-banner__label">
            <Message id="banner.isolation.label" />
          </dt>
          <dd className="hms-banner__value">
            <Isolation isolation={model.isolation} />
          </dd>
        </div>
        <div className="hms-banner__field" data-field="weight">
          <dt className="hms-banner__label">
            <Message id="banner.weight.label" />
          </dt>
          <dd className="hms-banner__value">
            <Weight weight={model.weight} />
          </dd>
        </div>
      </dl>
      {actions === undefined ? null : <div className="hms-banner__actions">{actions}</div>}
    </section>
  );
}
