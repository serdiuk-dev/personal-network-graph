import { FormEvent, useEffect, useState } from 'react';
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
};

export function PeopleManager() {
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [taxonomyPersonId, setTaxonomyPersonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPeople() {
    try {
      setLoading(true);

      const response = await fetch('/api/v1/people');

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

  function updateField<K extends keyof PersonForm>(
    field: K,
    value: PersonForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEdit(person: Person) {
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
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function resetForm() {
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
    };

    try {
      const response = await fetch(
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
      const response = await fetch(
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

      await loadPeople();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete person',
      );
    }
  }

  return (
    <main
      style={{
        padding: '24px',
        fontFamily: 'sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <h1>People</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          padding: '20px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '28px',
        }}
      >
        <input
          required
          placeholder="First name *"
          value={form.firstName}
          onChange={(event) =>
            updateField('firstName', event.target.value)
          }
        />

        <input
          placeholder="Last name"
          value={form.lastName}
          onChange={(event) =>
            updateField('lastName', event.target.value)
          }
        />

        <input
          placeholder="Nickname"
          value={form.nickname}
          onChange={(event) =>
            updateField('nickname', event.target.value)
          }
        />

        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(event) =>
            updateField('email', event.target.value)
          }
        />

        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(event) =>
            updateField('phone', event.target.value)
          }
        />

        <input
          placeholder="Company"
          value={form.company}
          onChange={(event) =>
            updateField('company', event.target.value)
          }
        />

        <input
          placeholder="Position"
          value={form.position}
          onChange={(event) =>
            updateField('position', event.target.value)
          }
        />

        <input
          placeholder="City"
          value={form.city}
          onChange={(event) =>
            updateField('city', event.target.value)
          }
        />

        <input
          placeholder="Country"
          value={form.country}
          onChange={(event) =>
            updateField('country', event.target.value)
          }
        />

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

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(event) =>
            updateField('notes', event.target.value)
          }
          style={{
            gridColumn: '1 / -1',
            minHeight: '90px',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: '10px',
          }}
        >
          <button type="submit">
            {editingId ? 'Save changes' : 'Add person'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {error && (
        <div
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
        <p>Loading...</p>
      ) : people.length === 0 ? (
        <p>No people yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                <th align="left">Name</th>
                <th align="left">Company</th>
                <th align="left">Position</th>
                <th align="left">Location</th>
                <th align="left">Importance</th>
                <th align="left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {people.map((person) => (
                <tr
                  key={person.id}
                  style={{
                    borderTop: '1px solid #ddd',
                  }}
                >
                  <td style={{ padding: '12px 4px' }}>
                    {[
                      person.firstName,
                      person.lastName,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </td>

                  <td>{person.company ?? '—'}</td>

                  <td>{person.position ?? '—'}</td>

                  <td>
                    {[person.city, person.country]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>

                  <td>{person.importance}/5</td>

                  <td>
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
                      onClick={() => setTaxonomyPersonId(person.id)}
                    >
                      Categories / Interests
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {taxonomyPersonId && (
        <PersonTaxonomyManager
          personId={taxonomyPersonId}
          onClose={() => setTaxonomyPersonId(null)}
        />
      )}
    </main>
  );
}
