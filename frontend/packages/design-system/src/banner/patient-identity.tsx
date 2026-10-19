/**
 * `PatientIdentity`: who the patient is (BUILD-PROMPT.md §2.1 SI-01, SI-16; docs/specs/modules/
 * design-system.md §2.1 "Fields" and rules 1, 3, 4 and 5; CTRL-0001-4, CTRL-0001-6, CTRL-0001-7,
 * CTRL-0016-3).
 *
 * The banner's identity part: the error state, the photo, every name form, the MRN and the date of birth
 * with the approximate-DOB flag, and "Identity incomplete". The same component serves every place where a
 * patient is shown to be chosen or confirmed (the switch confirmation, the re-verification step, the
 * palette's patient results, a patient chooser), so the identity looks and wraps the same everywhere.
 *
 * - **Identifiers are never room or bed** (rule 1): it reads only the banner model, which has no location
 *   field.
 * - **Every name form, each labelled, in its own script** (DN-029): the form in the patient's own script
 *   first. A missing or invalid form shows "<form> name missing" in its place.
 * - **Fail visibly** (rule 4): a missing or invalid MRN, or no valid name form, shows the error state,
 *   "Patient banner data unavailable"; a missing or invalid date of birth shows its own text; each with
 *   "Identity incomplete" where the model says so.
 * - **Bidi isolation** (rule 5): names in `Bdi` with their own `dir` and `lang`; the MRN and dates in
 *   `<bdi dir="ltr">`.
 * - **Wraps, never truncates** (rule 3): banner.css sets no ellipsis, line clamp, fixed height or hidden
 *   overflow on identity text.
 */
import type { MessageKey } from '@hms/i18n';
import { NAME_FORM_TEXT, type BannerModel, type DobField, type NameForm } from '@hms/ui-core';
import type { ReactNode } from 'react';
import { Bdi } from '../bdi/bdi.tsx';
import { Message } from '../message/message.tsx';
import { BannerStatus, type BannerStatusId } from './banner-status.tsx';
import { PatientPhoto } from './patient-photo.tsx';

/** The label and the missing status of each name form. */
const NAME_FORM_DISPLAY: Readonly<
  Record<NameForm, { readonly label: MessageKey; readonly missing: BannerStatusId }>
> = {
  ckb: { label: 'banner.name.kurdish.label', missing: 'name.ckb.missing' },
  ar: { label: 'banner.name.arabic.label', missing: 'name.ar.missing' },
  latin: { label: 'banner.name.latin.label', missing: 'name.latin.missing' },
};

/** The identity part of the model; PatientIdentity reads nothing else. */
export type PatientIdentityModel = Pick<
  BannerModel,
  'photo' | 'name' | 'mrn' | 'dob' | 'errorState' | 'identityIncomplete'
>;

export interface PatientIdentityProps {
  readonly model: PatientIdentityModel;
}

function DateOfBirth({ dob }: { readonly dob: DobField }): ReactNode {
  switch (dob.status) {
    case 'valid':
      return (
        <>
          <Bdi dir="ltr" className="hms-patient-identity__date">
            {dob.value}
          </Bdi>
          {dob.showApproximateFlag ? <BannerStatus status="dob.approximate" /> : null}
        </>
      );
    case 'missing':
      return <BannerStatus status="dob.missing" />;
    case 'unavailable':
      return <BannerStatus status="dob.unavailable" />;
  }
}

export function PatientIdentity({ model }: PatientIdentityProps): ReactNode {
  const { name, mrn, dob, photo } = model;
  return (
    <div
      className="hms-patient-identity"
      data-error-state={model.errorState}
      data-identity-incomplete={model.identityIncomplete}
    >
      {model.errorState ? (
        <p className="hms-patient-identity__marker">
          <BannerStatus status="banner.dataUnavailable" />
        </p>
      ) : null}
      <PatientPhoto key={photo.status === 'present' ? photo.src : photo.status} photo={photo} />
      <dl className="hms-banner__fields hms-patient-identity__fields">
        {name.order.map((form, index) => {
          const field = name.forms[form];
          const display = NAME_FORM_DISPLAY[form];
          const text = NAME_FORM_TEXT[form];
          return (
            <div
              key={form}
              className={
                index === 0
                  ? 'hms-banner__field hms-patient-name hms-patient-name--first'
                  : 'hms-banner__field hms-patient-name'
              }
              data-field={`name.${form}`}
            >
              <dt className="hms-banner__label">
                <Message id={display.label} />
              </dt>
              <dd className="hms-banner__value">
                {field.status === 'valid' ? (
                  <Bdi dir={text.dir} lang={text.lang} className="hms-patient-name__text">
                    {field.text}
                  </Bdi>
                ) : (
                  <BannerStatus status={display.missing} />
                )}
              </dd>
            </div>
          );
        })}
        <div className="hms-banner__field" data-field="mrn">
          <dt className="hms-banner__label">
            <Message id="banner.mrn.label" />
          </dt>
          <dd className="hms-banner__value">
            {mrn.status === 'valid' ? (
              <Bdi dir="ltr" className="hms-patient-identity__mrn">
                {mrn.value}
              </Bdi>
            ) : (
              <BannerStatus status="mrn.unavailable" />
            )}
          </dd>
        </div>
        <div className="hms-banner__field" data-field="dob">
          <dt className="hms-banner__label">
            <Message id="banner.dob.label" />
          </dt>
          <dd className="hms-banner__value">
            <DateOfBirth dob={dob} />
          </dd>
        </div>
      </dl>
      {model.identityIncomplete ? (
        <p className="hms-patient-identity__marker">
          <BannerStatus status="identity.incomplete" />
        </p>
      ) : null}
    </div>
  );
}
