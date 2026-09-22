import { useEffect, useState } from 'react';

type TaxonomyItem = {
  id: string;
  name: string;
};

type PersonDetail = {
  id: string;
  firstName: string;
  lastName: string | null;
  categories: TaxonomyItem[];
  interests: TaxonomyItem[];
};

type Props = {
  personId: string;
  onClose: () => void;
};

export function PersonTaxonomyManager({
  personId,
  onClose,
}: Props) {
  const [person, setPerson] = useState<PersonDetail | null>(null);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [interests, setInterests] = useState<TaxonomyItem[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [personResponse, categoriesResponse, interestsResponse] =
        await Promise.all([
          fetch(`/api/v1/people/${personId}`),
          fetch('/api/v1/categories'),
          fetch('/api/v1/interests'),
        ]);

      if (
        !personResponse.ok ||
        !categoriesResponse.ok ||
        !interestsResponse.ok
      ) {
        throw new Error('Unable to load taxonomy data');
      }

      setPerson(await personResponse.json());
      setCategories(await categoriesResponse.json());
      setInterests(await interestsResponse.json());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load taxonomy data',
      );
    }
  }

  useEffect(() => {
    loadData();
  }, [personId]);

  async function createCategory() {
    const name = newCategory.trim();

    if (!name) return;

    const response = await fetch('/api/v1/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      setError(await response.text());
      return;
    }

    setNewCategory('');
    await loadData();
  }

  async function createInterest() {
    const name = newInterest.trim();

    if (!name) return;

    const response = await fetch('/api/v1/interests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      setError(await response.text());
      return;
    }

    setNewInterest('');
    await loadData();
  }

  async function toggleCategory(category: TaxonomyItem) {
    if (!person) return;

    const assigned = person.categories.some(
      (item) => item.id === category.id,
    );

    const response = await fetch(
      `/api/v1/people/${person.id}/categories/${category.id}`,
      {
        method: assigned ? 'DELETE' : 'POST',
      },
    );

    if (!response.ok) {
      setError(await response.text());
      return;
    }

    await loadData();
  }

  async function toggleInterest(interest: TaxonomyItem) {
    if (!person) return;

    const assigned = person.interests.some(
      (item) => item.id === interest.id,
    );

    const response = await fetch(
      `/api/v1/people/${person.id}/interests/${interest.id}`,
      {
        method: assigned ? 'DELETE' : 'POST',
      },
    );

    if (!response.ok) {
      setError(await response.text());
      return;
    }

    await loadData();
  }

  if (!person) {
    return (
      <div style={{ padding: '24px' }}>
        {error ?? 'Loading...'}
      </div>
    );
  }

  return (
    <section
      style={{
        marginTop: '24px',
        padding: '20px',
        border: '1px solid #bbb',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h2>
          Categories & Interests — {person.firstName}{' '}
          {person.lastName ?? ''}
        </h2>

        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '30px',
        }}
      >
        <div>
          <h3>Categories</h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newCategory}
              onChange={(event) =>
                setNewCategory(event.target.value)
              }
              placeholder="New category"
            />

            <button
              type="button"
              onClick={createCategory}
            >
              Create
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            {categories.map((category) => {
              const assigned = person.categories.some(
                (item) => item.id === category.id,
              );

              return (
                <label
                  key={category.id}
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() =>
                      toggleCategory(category)
                    }
                  />{' '}
                  {category.name}
                </label>
              );
            })}
          </div>
        </div>

        <div>
          <h3>Interests</h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newInterest}
              onChange={(event) =>
                setNewInterest(event.target.value)
              }
              placeholder="New interest"
            />

            <button
              type="button"
              onClick={createInterest}
            >
              Create
            </button>
          </div>

          <div style={{ marginTop: '16px' }}>
            {interests.map((interest) => {
              const assigned = person.interests.some(
                (item) => item.id === interest.id,
              );

              return (
                <label
                  key={interest.id}
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() =>
                      toggleInterest(interest)
                    }
                  />{' '}
                  {interest.name}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
