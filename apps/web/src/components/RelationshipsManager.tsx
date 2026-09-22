import { FormEvent, useEffect, useState } from 'react';

type Person = {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
};

type Relationship = {
  id: string;
  fromId: string;
  toId: string;
  type: string | null;
  strength: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type RelationshipForm = {
  fromId: string;
  toId: string;
  type: string;
  strength: number;
  notes: string;
};

const emptyForm: RelationshipForm = {
  fromId: '',
  toId: '',
  type: '',
  strength: 1,
  notes: '',
};

export function RelationshipsManager() {
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] =
    useState<Relationship[]>([]);

  const [form, setForm] =
    useState<RelationshipForm>(emptyForm);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  async function loadData() {
    try {
      const [peopleResponse, relationshipsResponse] =
        await Promise.all([
          fetch('/api/v1/people'),
          fetch('/api/v1/relationships'),
        ]);

      if (!peopleResponse.ok) {
        throw new Error(
          `People API returned HTTP ${peopleResponse.status}`,
        );
      }

      if (!relationshipsResponse.ok) {
        throw new Error(
          `Relationships API returned HTTP ${relationshipsResponse.status}`,
        );
      }

      setPeople(await peopleResponse.json());
      setRelationships(await relationshipsResponse.json());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load relationships',
      );
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function personName(id: string) {
    const person = people.find(
      (item) => item.id === id,
    );

    if (!person) {
      return id;
    }

    return (
      [person.firstName, person.lastName]
        .filter(Boolean)
        .join(' ') ||
      person.nickname ||
      id
    );
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(
    relationship: Relationship,
  ) {
    setEditingId(relationship.id);

    setForm({
      fromId: relationship.fromId,
      toId: relationship.toId,
      type: relationship.type ?? '',
      strength: relationship.strength,
      notes: relationship.notes ?? '',
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!form.fromId || !form.toId) {
      setError(
        'Both people must be selected',
      );
      return;
    }

    const payload = {
      fromId: form.fromId,
      toId: form.toId,
      ...(form.type.trim()
        ? { type: form.type.trim() }
        : {}),
      strength: Number(form.strength),
      ...(form.notes.trim()
        ? { notes: form.notes.trim() }
        : {}),
    };

    try {
      const response = await fetch(
        editingId
          ? `/api/v1/relationships/${editingId}`
          : '/api/v1/relationships',
        {
          method: editingId
            ? 'PATCH'
            : 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `HTTP ${response.status}: ${body}`,
        );
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save relationship',
      );
    }
  }

  async function removeRelationship(
    relationship: Relationship,
  ) {
    const confirmed =
      window.confirm(
        `Delete relationship ${personName(
          relationship.fromId,
        )} → ${personName(
          relationship.toId,
        )}?`,
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/relationships/${relationship.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error(
          `Delete returned HTTP ${response.status}`,
        );
      }

      if (
        editingId === relationship.id
      ) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete relationship',
      );
    }
  }

  return (
    <main
      style={{
        padding: '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'sans-serif',
      }}
    >
      <h1>Relationships</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          padding: '20px',
          marginBottom: '28px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <label>
          From
          <select
            required
            value={form.fromId}
            onChange={(event) =>
              setForm({
                ...form,
                fromId:
                  event.target.value,
              })
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            <option value="">
              Select person
            </option>

            {people.map((person) => (
              <option
                key={person.id}
                value={person.id}
              >
                {personName(person.id)}
              </option>
            ))}
          </select>
        </label>

        <label>
          To
          <select
            required
            value={form.toId}
            onChange={(event) =>
              setForm({
                ...form,
                toId:
                  event.target.value,
              })
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            <option value="">
              Select person
            </option>

            {people.map((person) => (
              <option
                key={person.id}
                value={person.id}
              >
                {personName(person.id)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Type
          <input
            value={form.type}
            onChange={(event) =>
              setForm({
                ...form,
                type:
                  event.target.value,
              })
            }
            placeholder="friend, colleague..."
            style={{
              display: 'block',
              width: '100%',
            }}
          />
        </label>

        <label>
          Strength
          <select
            value={form.strength}
            onChange={(event) =>
              setForm({
                ...form,
                strength:
                  Number(
                    event.target.value,
                  ),
              })
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
          value={form.notes}
          onChange={(event) =>
            setForm({
              ...form,
              notes:
                event.target.value,
            })
          }
          placeholder="Relationship notes"
          style={{
            gridColumn: '1 / -1',
            minHeight: '80px',
          }}
        />

        <div
          style={{
            display: 'flex',
            gap: '10px',
          }}
        >
          <button type="submit">
            {editingId
              ? 'Save changes'
              : 'Add relationship'}
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
            border:
              '1px solid #c00',
          }}
        >
          {error}
        </div>
      )}

      {relationships.length === 0 ? (
        <p>No relationships yet.</p>
      ) : (
        <div
          style={{
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse:
                'collapse',
            }}
          >
            <thead>
              <tr>
                <th align="left">
                  From
                </th>
                <th align="left">
                  To
                </th>
                <th align="left">
                  Type
                </th>
                <th align="left">
                  Strength
                </th>
                <th align="left">
                  Notes
                </th>
                <th align="left">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {relationships.map(
                (relationship) => (
                  <tr
                    key={
                      relationship.id
                    }
                    style={{
                      borderTop:
                        '1px solid #ddd',
                    }}
                  >
                    <td
                      style={{
                        padding:
                          '12px 4px',
                      }}
                    >
                      {personName(
                        relationship.fromId,
                      )}
                    </td>

                    <td>
                      {personName(
                        relationship.toId,
                      )}
                    </td>

                    <td>
                      {relationship.type ??
                        '—'}
                    </td>

                    <td>
                      {
                        relationship.strength
                      }
                      /5
                    </td>

                    <td>
                      {relationship.notes ??
                        '—'}
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          startEdit(
                            relationship,
                          )
                        }
                      >
                        Edit
                      </button>

                      {' '}

                      <button
                        type="button"
                        onClick={() =>
                          removeRelationship(
                            relationship,
                          )
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
