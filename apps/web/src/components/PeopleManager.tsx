import { PersonMediaManager } from './PersonMediaManager';
import { apiFetch } from '../auth/client';
import { focusFirstField, FocusPanel } from './FocusPanel';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { ContactChannelsManager } from './ContactChannelsManager';
import { ContactEventsManager } from './ContactEventsManager';
import { PersonTaxonomyManager } from './PersonTaxonomyManager';

type Person = {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  importance: number;
  networkCircle: 'INNER' | 'MIDDLE' | 'OUTER';
  primaryTag: string | null;
  createdAt: string;
  updatedAt: string;
};

type PersonForm = {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  city: string;
  country: string;
  notes: string;
  importance: number;
  networkCircle: 'INNER' | 'MIDDLE' | 'OUTER';
  primaryTag: string;
};

const emptyForm: PersonForm = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  phone: '',
  company: '',
  position: '',
  city: '',
  country: '',
  notes: '',
  importance: 1,
  networkCircle: 'MIDDLE',
  primaryTag: '',
};

export type ContactDraft = Pick<PersonForm, 'firstName' | 'lastName' | 'nickname' | 'importance' | 'networkCircle' | 'primaryTag'> & { id: string | null };

type PeopleManagerProps = {
  onPreview?: (draft: ContactDraft | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onChanged: () => void;
  focusPersonId?: string | null;
  onFocusConsumed?: () => void;
};

export function PeopleManager({
  onChanged, onPreview, onDirtyChange,
  focusPersonId,
  onFocusConsumed,
}: PeopleManagerProps) {
  const edited = useRef(false);
  const [mediaPersonId, setMediaPersonId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taxonomyPersonId, setTaxonomyPersonId] = useState<string | null>(null);
  const [contactChannelsPersonId, setContactChannelsPersonId] = useState<string | null>(null);
  const [contactEventsPersonId, setContactEventsPersonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onPreview?.(form.firstName.trim() ? { id: editingId, firstName: form.firstName,
      lastName: form.lastName, nickname: form.nickname, importance: form.importance,
      networkCircle: form.networkCircle, primaryTag: form.primaryTag } : null);
  }, [form, editingId, onPreview]);
  useEffect(() => () => onPreview?.(null), [onPreview]);

  async function loadPeople() {
    try {
      setLoading(true);

      const response = await apiFetch('/api/v1/people');

      if (!response.ok) {
        throw new Error(`People API returned HTTP ${response.status}`);
      }

      const data: Person[] = await response.json();

      setPeople(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load people',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    if (!focusPersonId || loading) {
      return;
    }

    const person = people.find(
      (item) => item.id === focusPersonId,
    );

    if (!person) {
      setError(`Person ${focusPersonId} not found`);
      onFocusConsumed?.();
      return;
    }

    setContactEventsPersonId(person.id);
    onFocusConsumed?.();

    // FocusPanel focuses and reveals the opened events panel.
  }, [
    focusPersonId,
    loading,
    people,
    onFocusConsumed,
  ]);

  function updateField<K extends keyof PersonForm>(
    field: K,
    value: PersonForm[K],
  ) {
    edited.current = true;
    onDirtyChange?.(true);
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEdit(person: Person) {
    if (edited.current && !window.confirm('Discard unsaved contact edits?')) return;
    edited.current = false;
    onDirtyChange?.(false);
    setEditingId(person.id);

    setForm({
      firstName: person.firstName,
      lastName: person.lastName ?? '',
      nickname: person.nickname ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      company: person.company ?? '',
      position: person.position ?? '',
      city: person.city ?? '',
      country: person.country ?? '',
      notes: person.notes ?? '',
      importance: person.importance,
      networkCircle: person.networkCircle ?? 'MIDDLE',
      primaryTag: person.primaryTag ?? '',
    });

    focusFirstField(formRef.current);
  }

  function resetForm() {
    edited.current = false;
    onDirtyChange?.(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload = {
      firstName: form.firstName.trim(),
      ...(form.lastName.trim()
        ? { lastName: form.lastName.trim() }
        : {}),
      ...(form.nickname.trim()
        ? { nickname: form.nickname.trim() }
        : {}),
      ...(form.email.trim()
        ? { email: form.email.trim() }
        : {}),
      ...(form.phone.trim()
        ? { phone: form.phone.trim() }
        : {}),
      ...(form.company.trim()
        ? { company: form.company.trim() }
        : {}),
      ...(form.position.trim()
        ? { position: form.position.trim() }
        : {}),
      ...(form.city.trim()
        ? { city: form.city.trim() }
        : {}),
      ...(form.country.trim()
        ? { country: form.country.trim() }
        : {}),
      ...(form.notes.trim()
        ? { notes: form.notes.trim() }
        : {}),
      importance: Number(form.importance),
      networkCircle: form.networkCircle,
      primaryTag: form.primaryTag.trim() || null,
    };

    try {
      const response = await apiFetch(
        editingId
          ? `/api/v1/people/${editingId}`
          : '/api/v1/people',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          `HTTP ${response.status}: ${body}`,
        );
      }

      resetForm();
      await loadPeople();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save person',
      );
    }
  }

  async function removePerson(person: Person) {
    const confirmed = window.confirm(
      `Delete ${person.firstName} ${person.lastName ?? ''}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await apiFetch(
        `/api/v1/people/${person.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error(
          `Delete returned HTTP ${response.status}`,
        );
      }

      if (editingId === person.id) {
        resetForm();
      }
      if (mediaPersonId === person.id) setMediaPersonId(null);

      await loadPeople();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete person',
      );
    }
  }

  return (
    <div className="pnet-page">
      <h1>People</h1>

      <p className="pnet-draft-help">Name, importance and circle preview on the graph. Save to keep contact changes.</p>
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: '12px',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '28px',
        }}
      >
        <label className="pnet-field">
          <span>First name *</span>
          <input
            required
            placeholder="First name *"
            value={form.firstName}
            onChange={(event) =>
              updateField('firstName', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Last name</span>
          <input
            placeholder="Last name"
            value={form.lastName}
            onChange={(event) =>
              updateField('lastName', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Nickname</span>
          <input
            placeholder="Nickname"
            value={form.nickname}
            onChange={(event) =>
              updateField('nickname', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Email</span>
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(event) =>
              updateField('email', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Phone</span>
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(event) =>
              updateField('phone', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Company</span>
          <input
            placeholder="Company"
            value={form.company}
            onChange={(event) =>
              updateField('company', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Position</span>
          <input
            placeholder="Position"
            value={form.position}
            onChange={(event) =>
              updateField('position', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>City</span>
          <input
            placeholder="City"
            value={form.city}
            onChange={(event) =>
              updateField('city', event.target.value)
            }
          />
        </label>

        <label className="pnet-field">
          <span>Country</span>
          <input
            placeholder="Country"
            value={form.country}
            onChange={(event) =>
              updateField('country', event.target.value)
            }
          />
        </label>

        <label>
          Importance
          <select
            value={form.importance}
            onChange={(event) =>
              updateField(
                'importance',
                Number(event.target.value),
              )
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </label>

        <label>
          Network circle
          <select
            value={form.networkCircle}
            onChange={(event) =>
              updateField(
                'networkCircle',
                event.target.value as
                  | 'INNER'
                  | 'MIDDLE'
                  | 'OUTER',
              )
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            <option value="INNER">
              Inner — close circle
            </option>
            <option value="MIDDLE">
              Middle — regular circle
            </option>
            <option value="OUTER">
              Outer — distant circle
            </option>
          </select>
        </label>

        <label>
          Primary tag
          <input
            value={form.primaryTag}
            maxLength={80}
            placeholder="Family / Art / Cybersecurity"
            onChange={(event) =>
              updateField(
                'primaryTag',
                event.target.value,
              )
            }
          />
        </label>

        <label className="pnet-field pnet-field-full">
          <span>Notes</span>
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) =>
              updateField('notes', event.target.value)
            }
            style={{
              minHeight: '90px',
            }}
          />
        </label>

        <div
          style={{
            display: 'flex', flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <button type="submit">
            {editingId ? 'Save changes' : 'Add person'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={() => { if (!edited.current || window.confirm('Discard unsaved contact edits?')) resetForm(); }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="pnet-error" role="alert"
          style={{
            padding: '12px',
            marginBottom: '18px',
            border: '1px solid #c00',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="pnet-state" role="status">Loading...</p>
      ) : people.length === 0 ? (
        <p className="pnet-state">No people yet.</p>
      ) : (
        <ul className="pnet-contact-list" aria-label="Contacts">
          {people.map((person) => (
            <li className="pnet-contact-card" key={person.id}>
              <h3>{[person.firstName, person.lastName].filter(Boolean).join(' ')}</h3>
              <div className="pnet-contact-actions" role="group" aria-label={`Actions for ${person.firstName} ${person.lastName ?? ''}`}>
                    <button type="button" onClick={() => setMediaPersonId(person.id)}>
                      Photo / Icon
                    </button>
                    {' '}
                    <button
                      type="button"
                      onClick={() => startEdit(person)}
                    >
                      Edit
                    </button>

                    {' '}

                    <button
                      type="button"
                      onClick={() => removePerson(person)}
                    >
                      Delete
                    </button>

                    {' '}

                    <button
                      type="button"
                      onClick={() =>
                        setContactChannelsPersonId(person.id)
                      }
                    >
                      Contact Channels
                    </button>

                    {' '}

                    <button
                      type="button"
                      onClick={() => setContactEventsPersonId(person.id)}
                    >
                      Events / Reminders
                    </button>

                    {' '}

                    <button
                      type="button"
                      onClick={() => setTaxonomyPersonId(person.id)}
                    >
                      Categories / Interests
                    </button>

              </div>
              <dl className="pnet-contact-facts">
                <div><dt>Company</dt><dd>{person.company || '—'}</dd></div>
                <div><dt>Position</dt><dd>{person.position || '—'}</dd></div>
                <div><dt>Location</dt><dd>{[person.city, person.country].filter(Boolean).join(', ') || '—'}</dd></div>
                <div><dt>Importance</dt><dd>{person.importance}/5</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {mediaPersonId && (
        <FocusPanel personId={mediaPersonId} label="Photo / Icon">
          <PersonMediaManager
            key={mediaPersonId}
            personId={mediaPersonId}
            personName={people.filter(person => person.id === mediaPersonId).map(person => [person.firstName, person.lastName].filter(Boolean).join(' '))[0] || 'Contact'}
            onClose={() => setMediaPersonId(null)}
          />
        </FocusPanel>
      )}

      {contactChannelsPersonId && (
        <FocusPanel personId={contactChannelsPersonId} label="Contact Channels">
          <ContactChannelsManager
            personId={contactChannelsPersonId}
            onClose={() =>
              setContactChannelsPersonId(null)
            }
          />
        </FocusPanel>
      )}

      {contactEventsPersonId && (
        <FocusPanel personId={contactEventsPersonId} label="Events / Reminders">
          <ContactEventsManager
            personId={contactEventsPersonId}
            onClose={() => setContactEventsPersonId(null)}
          />
        </FocusPanel>
      )}

      {taxonomyPersonId && (
        <FocusPanel personId={taxonomyPersonId} label="Categories / Interests">
          <PersonTaxonomyManager
            personId={taxonomyPersonId}
            onClose={() => setTaxonomyPersonId(null)}
            onChanged={onChanged}
          />
        </FocusPanel>
      )}
    </div>
  );
}
