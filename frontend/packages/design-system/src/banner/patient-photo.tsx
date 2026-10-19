/**
 * The registration photo (docs/specs/modules/design-system.md §2.1 "Photo"; CTRL-0016-8).
 *
 * A present photo is shown with "Patient photo" as its alternative text. An absent or invalid photo, and a
 * photo that fails to load, show "No photo" in the photo's place: never an empty frame and never a
 * silhouette that could pass for a photo. The placeholder is at least as wide as the image where there is
 * room, shrinks to the space there is, and wraps its text, so a long translation is never cut and never
 * wider than the identity area (banner.css).
 */
import type { PhotoField } from '@hms/ui-core';
import { useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { messageKey } from '../message-key.ts';
import { BannerStatus } from './banner-status.tsx';

export interface PatientPhotoProps {
  readonly photo: PhotoField;
}

/** The photo's place. Give it `key={src}`, so that a new source starts without the previous load failure. */
export function PatientPhoto({ photo }: PatientPhotoProps): ReactNode {
  const intl = useIntl();
  const [failed, setFailed] = useState(false);
  if (photo.status === 'present' && !failed) {
    return (
      <div className="hms-patient-photo" data-photo="present">
        <img
          className="hms-patient-photo__image"
          src={photo.src}
          alt={intl.formatMessage({ id: messageKey('banner.photo.alt') })}
          onError={() => {
            setFailed(true);
          }}
        />
      </div>
    );
  }
  return (
    <div className="hms-patient-photo hms-patient-photo--missing" data-photo="missing">
      <BannerStatus status="photo.missing" />
    </div>
  );
}
