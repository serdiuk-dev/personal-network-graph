import { FormEvent, useEffect, useState } from 'react';

type TaxonomyItem = {
  id: string;
  name: string;
};

type TaxonomyType = 'categories' | 'interests';

type TaxonomySectionProps = {
  title: string;
  type: TaxonomyType;
  items: TaxonomyItem[];
  onReload: () => Promise<void>;
  onChanged: () => void;
};

function TaxonomySection({
  title,
  type,
  items,
  onReload,
  onChanged,
}: TaxonomySectionProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function createItem(event: FormEvent) {
    event.preventDefault();

    const name = newName.trim();

    if (!name) return;

    try {
      const response = await fetch(`/api/v1/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setNewName('');
      setError(null);

      await onReload();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to create ${type}`,
      );
    }
  }

  function startEdit(item: TaxonomyItem) {
    setEditingId(item.id);
    setEditingName(item.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function saveEdit(id: string) {
    const name = editingName.trim();

    if (!name) return;

    try {
      const response = await fetch(`/api/v1/${type}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      cancelEdit();
      setError(null);

      await onReload();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to update ${type}`,
      );
    }
  }

  async function removeItem(item: TaxonomyItem) {
    const confirmed = window.confirm(
      `Delete "${item.name}"?\n\nThis will also remove this assignment from all people.`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/v1/${type}/${item.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (editingId === item.id) {
        cancelEdit();
      }

      setError(null);

      await onReload();
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to delete ${type}`,
      );
    }
  }

  return (
    <section
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
      }}
    >
      <h2>{title}</h2>

      <form
        onSubmit={createItem}
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
        }}
      >
        <input
          value={newName}
          onChange={(event) =>
            setNewName(event.target.value)
          }
          placeholder={`New ${title.toLowerCase().replace(/s$/, '')}`}
          style={{
            flex: 1,
            padding: '8px',
          }}
        />

        <button type="submit">
          Add
        </button>
      </form>

      {error && (
        <div
          style={{
            marginBottom: '16px',
            padding: '10px',
            border: '1px solid #c00',
          }}
        >
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <div>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 0',
                borderTop: '1px solid #eee',
              }}
            >
              {editingId === item.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(event) =>
                      setEditingName(event.target.value)
                    }
                    style={{ flex: 1 }}
                  />

                  <button
                    type="button"
                    onClick={() => saveEdit(item.id)}
                  >
                    Save
                  </button>

                  <button
                    type="button"
                    onClick={cancelEdit}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1 }}>
                    {item.name}
                  </span>

                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type TaxonomyManagerProps = {
  onChanged: () => void;
};

export function TaxonomyManager({
  onChanged,
}: TaxonomyManagerProps) {
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [interests, setInterests] = useState<TaxonomyItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [categoriesResponse, interestsResponse] =
        await Promise.all([
          fetch('/api/v1/categories'),
          fetch('/api/v1/interests'),
        ]);

      if (!categoriesResponse.ok) {
        throw new Error(
          `Categories API returned HTTP ${categoriesResponse.status}`,
        );
      }

      if (!interestsResponse.ok) {
        throw new Error(
          `Interests API returned HTTP ${interestsResponse.status}`,
        );
      }

      setCategories(await categoriesResponse.json());
      setInterests(await interestsResponse.json());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load taxonomy',
      );
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <main
      style={{
        padding: '24px',
        maxWidth: '1000px',
        margin: '0 auto',
        fontFamily: 'sans-serif',
      }}
    >
      <h1>Categories & Interests</h1>

      <p>
        Manage the shared classification system used by people in the network.
      </p>

      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px',
            border: '1px solid #c00',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '24px',
        }}
      >
        <TaxonomySection
          title="Categories"
          type="categories"
          items={categories}
          onReload={loadData}
          onChanged={onChanged}
        />

        <TaxonomySection
          title="Interests"
          type="interests"
          items={interests}
          onReload={loadData}
          onChanged={onChanged}
        />
      </div>
    </main>
  );
}
