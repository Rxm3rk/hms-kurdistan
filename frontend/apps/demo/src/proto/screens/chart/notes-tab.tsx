/**
 * Notes tab: the timeline of admission, progress, nursing and clinic notes, ordered by clinical time (when the
 * care happened) or by the time written. A note written more than an hour after the event is marked as a late
 * entry: "Documented 11:40 for observation at 08:00". Drafts are marked clearly; the author signs them with
 * the design system's sign pattern.
 *
 * "New note" opens an editor with templates (SOAP progress note, nursing shift note, admission note,
 * discharge plan) that can insert the latest observations. "Save as draft" keeps it as a draft; "Sign" opens
 * the sign dialog and files it as signed. New notes live in the screen's state only.
 */
import { Bdi } from '@hms/design-system';
import { useRef, useState, type ReactNode } from 'react';
import { Label, TextArea, TextField } from 'react-aria-components';
import { DEMO_NOW_ISO, NOTE_KIND_LABEL, ROLE_LABEL, findStaff, todayAt, type NoteKind, type Patient, type StaffMember } from '../../data/index.ts';
import { useFormat, useT } from '../../i18n/use-t.ts';
import { SignAction, useRole } from '../../shell/index.ts';
import { Badge, Button, Callout, Card, EmptyState, Icon, Segmented, SelectField, StaffName, TextInput, Toolbar, useToast } from '../../ui/index.ts';
import { LATE_ENTRY_MINUTES, minutesLate, type ChartNote, type ChartVitals } from './chart-data.ts';
import { oxygenPlain, type ChartMessageKey, type NewsView } from './chart-shared.tsx';
import { messages } from './messages.ts';

export type TemplateId = 'progress' | 'nursing' | 'admission' | 'discharge';

const TEMPLATES: readonly TemplateId[] = ['progress', 'nursing', 'admission', 'discharge'];
const TEMPLATE_KIND: Readonly<Record<TemplateId, NoteKind>> = {
  progress: 'progress',
  nursing: 'nursing',
  admission: 'admission',
  discharge: 'discharge-plan',
};

/** The times a new note can be written for (today); `now` is the demo clock. */
const CLINICAL_TIMES = ['now', '09:00', '08:00', '07:00', '06:00', '03:00'] as const;
type ClinicalTime = (typeof CLINICAL_TIMES)[number];

export interface EditorState {
  readonly template: TemplateId;
  readonly title: string;
  readonly body: string;
  readonly clinicalTime: ClinicalTime;
}

/** Notes written in this window carry this id prefix (their text is free text in any language). */
export const LOCAL_NOTE_PREFIX = 'SYN-NOTE-LOCAL-';

export interface NotesTabProps {
  readonly patient: Patient;
  readonly notes: readonly ChartNote[];
  readonly vitals: readonly ChartVitals[];
  readonly news: NewsView;
  readonly editor: EditorState | null;
  readonly onEditorChange: (editor: EditorState | null) => void;
  readonly onAdd: (note: ChartNote) => void;
  readonly onSignExisting: (noteId: string) => void;
}

type SortBy = 'clinical' | 'recorded';
type Filter = 'all' | 'doctors' | 'nursing';

export function NotesTab({ patient, notes, vitals, news, editor, onEditorChange, onAdd, onSignExisting }: NotesTabProps): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const { roleId, user } = useRole();
  const [sortBy, setSortBy] = useState<SortBy>('clinical');
  const [filter, setFilter] = useState<Filter>('all');
  const canWrite = roleId === 'physician' || roleId === 'nurse';

  const obsText = (): string => {
    const latest = vitals.at(-1);
    if (latest === undefined) {
      return t('obsNone');
    }
    return t('obsLine', {
      time: f.time(latest.iso),
      bp: `${latest.systolic}/${latest.diastolic}`,
      hr: latest.heartRate,
      spo2: latest.spo2,
      oxygen: oxygenPlain(latest.oxygen, t),
      temp: latest.tempC,
      rr: latest.respRate,
      news: news.latest === null ? t('notApplicableShort') : String(news.latest.total),
    });
  };
  const fresh = (template: TemplateId): EditorState => ({
    template,
    title: t(`defaultTitle_${template}` as ChartMessageKey),
    body: t(`body_${template}` as ChartMessageKey, { obs: obsText() }),
    clinicalTime: 'now',
  });

  const key = (note: ChartNote): string => (sortBy === 'clinical' ? note.clinicalIso : note.recordedIso);
  const visible = notes
    .filter((note) => filter === 'all' || (filter === 'nursing' ? note.kind === 'nursing' : note.kind !== 'nursing'))
    .toSorted((a, b) => key(b).localeCompare(key(a)));
  let currentDay = '';

  return (
    <div className="chart-notes">
      <Card
        title={t('notesTitle')}
        subtitle={t('notesCount', { count: notes.length })}
        icon="pen"
        actions={
          <Button
            variant="primary"
            icon="plus"
            isDisabled={!canWrite || editor !== null}
            onPress={() => {
              onEditorChange(fresh(roleId === 'nurse' ? 'nursing' : 'progress'));
            }}
          >
            {t('newNote')}
          </Button>
        }
      >
        <Stacked>
          {canWrite ? null : <Callout tone="info">{t('readOnlyRole', { role: f.text(ROLE_LABEL[roleId]) })}</Callout>}
          <Toolbar label={t('notesTitle')}>
            <Segmented
              label={t('sortLabel')}
              value={sortBy}
              onChange={(value) => {
                setSortBy(value === 'recorded' ? 'recorded' : 'clinical');
              }}
              options={[
                { id: 'clinical', label: t('sortClinical') },
                { id: 'recorded', label: t('sortRecorded') },
              ]}
            />
            <Segmented
              label={t('filterLabel')}
              value={filter}
              onChange={(value) => {
                setFilter(value === 'doctors' || value === 'nursing' ? value : 'all');
              }}
              options={[
                { id: 'all', label: t('filterAll') },
                { id: 'doctors', label: t('filterDoctors') },
                { id: 'nursing', label: t('filterNursing') },
              ]}
            />
          </Toolbar>
        </Stacked>
      </Card>

      {editor === null || !canWrite ? null : (
        <NoteEditor
          patient={patient}
          user={user}
          editor={editor}
          onChange={onEditorChange}
          onTemplate={(template) => {
            onEditorChange({ ...fresh(template), clinicalTime: editor.clinicalTime });
          }}
          obsText={obsText}
          onFile={(note) => {
            onAdd(note);
            onEditorChange(null);
          }}
        />
      )}

      {notes.length === 0 ? (
        <Card>
          <EmptyState icon="pen" title={t('noNotes')} body={t('noNotesBody')} />
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <EmptyState compact icon="filter" title={t('noNotesFilter')} />
        </Card>
      ) : (
        <ol className="chart-note-list">
          {visible.map((note) => {
            const day = key(note).slice(0, 10);
            const showDay = day !== currentDay;
            currentDay = day;
            return (
              <li key={note.id} className="chart-note-list__item">
                {showDay ? <h3 className="chart-day-heading">{f.date(key(note), 'long')}</h3> : null}
                <NoteCard
                  note={note}
                  userId={user.id}
                  onSign={() => {
                    onSignExisting(note.id);
                  }}
                />
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Stacked({ children }: { readonly children: ReactNode }): ReactNode {
  return <div className="chart-stack">{children}</div>;
}

// ---------------------------------------------------------------------------------------------------------
// One note
// ---------------------------------------------------------------------------------------------------------

function LateEntry({ note }: { readonly note: Pick<ChartNote, 'clinicalIso' | 'recordedIso'> }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const late = minutesLate(note);
  if (late <= LATE_ENTRY_MINUTES) {
    return null;
  }
  const sameDay = note.clinicalIso.slice(0, 10) === note.recordedIso.slice(0, 10);
  return (
    <p className="chart-late">
      <Icon name="clock" className="chart-late__icon" />
      <strong>{t('lateEntry')}</strong>
      <span>
        {t.rich('lateBody', {
          recorded: <Bdi dir={f.locale === 'en' ? 'ltr' : 'rtl'}>{sameDay ? f.time(note.recordedIso) : f.dateTime(note.recordedIso)}</Bdi>,
          clinical: <Bdi dir="ltr">{f.time(note.clinicalIso)}</Bdi>,
        })}
      </span>
      <span className="chart-late__delay">({t('lateDelay', { hours: Math.floor(late / 60), minutes: late % 60 })})</span>
    </p>
  );
}

function NoteCard({ note, userId, onSign }: { readonly note: ChartNote; readonly userId: string; readonly onSign: () => void }): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const author = findStaff(note.authorId);
  const local = note.id.startsWith(LOCAL_NOTE_PREFIX);
  return (
    <article className={note.signed ? 'chart-note' : 'chart-note chart-note--draft'}>
      <header className="chart-note__header">
        <div className="chart-note__badges">
          <Badge tone={note.kind === 'nursing' ? 'info' : 'neutral'} size="sm">
            {f.text(NOTE_KIND_LABEL[note.kind])}
          </Badge>
          {note.signed ? (
            <Badge tone="success" icon="check" size="sm">
              {t('signed')}
            </Badge>
          ) : (
            <Badge tone="warning" icon="pen" strong size="sm">
              {t('draft')}
            </Badge>
          )}
          {local ? (
            <Badge tone="accent" size="sm">
              {t('newBadge')}
            </Badge>
          ) : null}
        </div>
        <h4 className="chart-note__title" {...(local ? { dir: 'auto' } : {})}>
          {f.text(note.title)}
        </h4>
        <p className="chart-note__meta">
          <Bdi dir={f.locale === 'en' ? 'ltr' : 'rtl'}>{f.dateTime(note.clinicalIso)}</Bdi>
          {author === undefined ? null : (
            <>
              <span aria-hidden="true"> · </span>
              {t.rich('byAuthor', { name: <StaffName member={author} /> })}
              <span className="chart-note__role"> ({f.text(author.title)})</span>
            </>
          )}
        </p>
      </header>
      <LateEntry note={note} />
      <p className={local ? 'chart-note__body chart-note__body--free' : 'chart-note__body'} {...(local ? { dir: 'auto' } : {})}>
        {f.text(note.body)}
      </p>
      {note.signed ? null : (
        <footer className="chart-note__footer">
          <span className="chart-note__draft-hint">
            <Icon name="info" size="1em" /> {t('draftHint')}
          </span>
          {note.authorId === userId ? (
            <SignAction size="sm" label={t('signNote')} review={<NoteReview title={f.text(note.title)} body={f.text(note.body)} clinicalIso={note.clinicalIso} recordedIso={note.recordedIso} free={local} />} onSigned={onSign} />
          ) : author === undefined ? null : (
            <span className="chart-note__awaiting">{t.rich('awaitingSignature', { name: <StaffName member={author} /> })}</span>
          )}
        </footer>
      )}
    </article>
  );
}

/** What the sign dialog shows in its review step. */
function NoteReview({
  title,
  body,
  clinicalIso,
  recordedIso,
  free,
}: {
  readonly title: string;
  readonly body: string;
  readonly clinicalIso: string;
  readonly recordedIso: string;
  readonly free: boolean;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  return (
    <div className="chart-review">
      <p className="chart-review__label">{t('reviewHeading')}</p>
      <p className="chart-review__title" {...(free ? { dir: 'auto' } : {})}>
        {title}
      </p>
      <p className="chart-review__meta">
        <Bdi dir={f.locale === 'en' ? 'ltr' : 'rtl'}>{f.dateTime(clinicalIso)}</Bdi>
      </p>
      <LateEntry note={{ clinicalIso, recordedIso }} />
      <p className="chart-review__body" {...(free ? { dir: 'auto' } : {})}>
        {body}
      </p>
      <p className="chart-review__hint">{t('signHint')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------------------------------------

function clinicalIsoOf(time: ClinicalTime): string {
  return time === 'now' ? DEMO_NOW_ISO : todayAt(time);
}

function NoteEditor({
  patient,
  user,
  editor,
  onChange,
  onTemplate,
  obsText,
  onFile,
}: {
  readonly patient: Patient;
  readonly user: StaffMember;
  readonly editor: EditorState;
  readonly onChange: (editor: EditorState | null) => void;
  readonly onTemplate: (template: TemplateId) => void;
  readonly obsText: () => string;
  readonly onFile: (note: ChartNote) => void;
}): ReactNode {
  const t = useT(messages);
  const f = useFormat();
  const toast = useToast();
  const seq = useRef(0);
  const clinicalIso = clinicalIsoOf(editor.clinicalTime);
  const late = minutesLate({ clinicalIso, recordedIso: DEMO_NOW_ISO }) > LATE_ENTRY_MINUTES;
  const empty = editor.body.trim() === '' || editor.title.trim() === '';

  const build = (signed: boolean): ChartNote => {
    seq.current += 1;
    return {
      id: `${LOCAL_NOTE_PREFIX}${patient.id.slice(-4)}-${String(Date.parse(clinicalIso) % 100000)}-${String(seq.current)}`,
      patientId: patient.id,
      kind: TEMPLATE_KIND[editor.template],
      clinicalIso,
      recordedIso: DEMO_NOW_ISO,
      authorId: user.id,
      title: { en: editor.title, ckb: editor.title, ar: editor.title },
      body: { en: editor.body, ckb: editor.body, ar: editor.body },
      signed,
    };
  };

  return (
    <Card
      title={t('editorTitle')}
      subtitle={t.rich('editorSubtitle', { name: <StaffName member={user} />, time: f.time(DEMO_NOW_ISO) })}
      icon="pen"
      tone="accent"
      className="chart-editor"
    >
      <div className="chart-editor__body">
      <div className="chart-editor__grid">
        <SelectField
          label={t('templateLabel')}
          selectedKey={editor.template}
          onSelectionChange={(id) => {
            const next = TEMPLATES.find((template) => template === id);
            if (next !== undefined) {
              onTemplate(next);
            }
          }}
          options={TEMPLATES.map((template) => ({ id: template, label: t(`template_${template}` as ChartMessageKey) }))}
        />
        <SelectField
          label={t('clinicalTimeLabel')}
          selectedKey={editor.clinicalTime}
          onSelectionChange={(id) => {
            const next = CLINICAL_TIMES.find((time) => time === id);
            if (next !== undefined) {
              onChange({ ...editor, clinicalTime: next });
            }
          }}
          options={CLINICAL_TIMES.map((time) => ({
            id: time,
            label: time === 'now' ? t('clinicalNow', { time: f.time(DEMO_NOW_ISO) }) : t('clinicalToday', { time }),
          }))}
        />
      </div>
      <p className="chart-footnote">{t('templateHint')}</p>
      <TextInput
        label={t('noteTitleLabel')}
        value={editor.title}
        dir="auto"
        isRequired
        onChange={(title) => {
          onChange({ ...editor, title });
        }}
      />
      <TextField
        className="chart-editor__field"
        value={editor.body}
        isRequired
        onChange={(body) => {
          onChange({ ...editor, body });
        }}
      >
        <Label className="chart-editor__label">{t('noteBodyLabel')}</Label>
        <TextArea className="chart-editor__textarea" rows={12} dir="auto" spellCheck />
        <span className="chart-editor__count">{t('charCount', { count: editor.body.length })}</span>
      </TextField>
      {late ? (
        <Callout tone="warning" icon="clock" title={t('lateEntry')}>
          {t.rich('lateWarning', {
            recorded: <Bdi dir="ltr">{f.time(DEMO_NOW_ISO)}</Bdi>,
            clinical: <Bdi dir="ltr">{f.time(clinicalIso)}</Bdi>,
          })}
        </Callout>
      ) : null}
      <p className="chart-footnote">{empty ? t('emptyBody') : t('signHint')}</p>
      <div className="chart-editor__actions">
        <Button
          variant="ghost"
          icon="x"
          onPress={() => {
            onChange(null);
          }}
        >
          {t('discard')}
        </Button>
        <Button
          variant="secondary"
          icon="activity"
          onPress={() => {
            onChange({ ...editor, body: `${editor.body.trimEnd()}\n${obsText()}\n` });
          }}
        >
          {t('insertObs')}
        </Button>
        <Button
          variant="secondary"
          icon="check"
          isDisabled={empty}
          onPress={() => {
            onFile(build(false));
            toast({ tone: 'info', title: t('draftSaved'), body: t('draftSavedBody') });
          }}
        >
          {t('saveDraft')}
        </Button>
        <SignAction
          isDisabled={empty}
          review={<NoteReview title={editor.title} body={editor.body} clinicalIso={clinicalIso} recordedIso={DEMO_NOW_ISO} free />}
          onSigned={() => {
            onFile(build(true));
          }}
        />
      </div>
      </div>
    </Card>
  );
}
