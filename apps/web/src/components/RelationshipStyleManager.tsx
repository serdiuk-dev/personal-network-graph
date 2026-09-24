import {
  useEffect,
  useMemo,
  useState,
} from 'react';

type Person = {
  id: string;
  firstName: string | null;
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
  visualColor: string | null;
  visualWidth: number | null;
};

type RelationshipStyleManagerProps = {
  onChanged: () => void;
};

const DEFAULT_PREVIEW_COLOR =
  '#65b7e8';

const DEFAULT_PREVIEW_WIDTH = 1;

export function RelationshipStyleManager({
  onChanged,
}: RelationshipStyleManagerProps) {
  const [people, setPeople] =
    useState<Person[]>([]);

  const [
    relationships,
    setRelationships,
  ] = useState<Relationship[]>([]);

  const [
    selectedId,
    setSelectedId,
  ] = useState('');

  const [
    useCustomColor,
    setUseCustomColor,
  ] = useState(false);

  const [color, setColor] =
    useState(DEFAULT_PREVIEW_COLOR);

  const [
    useCustomWidth,
    setUseCustomWidth,
  ] = useState(false);

  const [width, setWidth] =
    useState(DEFAULT_PREVIEW_WIDTH);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const peopleById = useMemo(
    () =>
      new Map(
        people.map(
          (person) => [
            person.id,
            person,
          ],
        ),
      ),
    [people],
  );

  function personName(id: string) {
    const person =
      peopleById.get(id);

    if (!person) {
      return id;
    }

    return (
      [
        person.firstName,
        person.lastName,
      ]
        .filter(Boolean)
        .join(' ') ||
      person.nickname ||
      person.id
    );
  }

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [
        peopleResponse,
        relationshipsResponse,
      ] = await Promise.all([
        fetch('/api/v1/people'),
        fetch(
          '/api/v1/relationships',
        ),
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

      const peopleData: Person[] =
        await peopleResponse.json();

      const relationshipData:
        Relationship[] =
        await relationshipsResponse.json();

      setPeople(peopleData);
      setRelationships(
        relationshipData,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load edge styles',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selected =
    relationships.find(
      (relationship) =>
        relationship.id ===
        selectedId,
    ) ?? null;

  useEffect(() => {
    if (!selected) {
      setUseCustomColor(false);
      setColor(
        DEFAULT_PREVIEW_COLOR,
      );

      setUseCustomWidth(false);
      setWidth(
        DEFAULT_PREVIEW_WIDTH,
      );

      return;
    }

    setUseCustomColor(
      selected.visualColor !== null,
    );

    setColor(
      selected.visualColor ??
        DEFAULT_PREVIEW_COLOR,
    );

    setUseCustomWidth(
      selected.visualWidth !== null,
    );

    setWidth(
      selected.visualWidth ??
        DEFAULT_PREVIEW_WIDTH,
    );

    setMessage(null);
  }, [
    selectedId,
    selected?.visualColor,
    selected?.visualWidth,
  ]);

  async function persistStyle(
    visualColor: string | null,
    visualWidth: number | null,
  ) {
    if (!selected) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/v1/relationships/${selected.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify({
            visualColor,
            visualWidth,
          }),
        },
      );

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `Relationship API returned HTTP ${response.status}: ${body}`,
        );
      }

      const updated:
        Relationship =
        await response.json();

      setRelationships(
        (current) =>
          current.map(
            (relationship) =>
              relationship.id ===
              updated.id
                ? updated
                : relationship,
          ),
      );

      onChanged();

      return updated;
    } finally {
      setSaving(false);
    }
  }

  async function saveStyle() {
    try {
      await persistStyle(
        useCustomColor
          ? color
          : null,

        useCustomWidth
          ? width
          : null,
      );

      setMessage(
        'Edge style saved.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save edge style',
      );
    }
  }

  async function resetStyle() {
    try {
      const updated =
        await persistStyle(
          null,
          null,
        );

      if (updated) {
        setUseCustomColor(false);
        setColor(
          DEFAULT_PREVIEW_COLOR,
        );

        setUseCustomWidth(false);
        setWidth(
          DEFAULT_PREVIEW_WIDTH,
        );

        setMessage(
          'Edge style reset to graph defaults.',
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to reset edge style',
      );
    }
  }

  if (loading) {
    return (
      <main
        style={{
          padding: '24px',
          fontFamily: 'sans-serif',
        }}
      >
        Loading edge styles...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <h1
        style={{
          marginBottom: '6px',
        }}
      >
        Edge Styles
      </h1>

      <p
        style={{
          marginTop: 0,
          marginBottom: '24px',
          color: '#63758a',
        }}
      >
        Persistent visual overrides
        for individual relationships.
      </p>

      {error && (
        <div
          style={{
            marginBottom: '18px',
            color: '#b42318',
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            marginBottom: '18px',
            color: '#0f766e',
          }}
        >
          {message}
        </div>
      )}

      <section
        style={{
          padding: '20px',
          border:
            '1px solid #e4edf1',
          borderRadius: '14px',
          background: '#fff',
        }}
      >
        <label
          style={{
            display: 'block',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Relationship
          </div>

          <select
            value={selectedId}
            onChange={(event) =>
              setSelectedId(
                event.target.value,
              )
            }
            style={{
              width: '100%',
              padding: '10px',
            }}
          >
            <option value="">
              Select relationship
            </option>

            {relationships.map(
              (relationship) => (
                <option
                  key={
                    relationship.id
                  }
                  value={
                    relationship.id
                  }
                >
                  {personName(
                    relationship.fromId,
                  )}
                  {' → '}
                  {personName(
                    relationship.toId,
                  )}
                  {relationship.type
                    ? ` · ${relationship.type}`
                    : ''}
                </option>
              ),
            )}
          </select>
        </label>

        {selected && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '22px',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: '8px',
                    marginBottom:
                      '10px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      useCustomColor
                    }
                    onChange={(
                      event,
                    ) =>
                      setUseCustomColor(
                        event.target
                          .checked,
                      )
                    }
                  />

                  Custom color
                </label>

                <input
                  type="color"
                  value={color}
                  disabled={
                    !useCustomColor
                  }
                  onChange={(
                    event,
                  ) =>
                    setColor(
                      event.target
                        .value,
                    )
                  }
                  style={{
                    width: '100%',
                    height: '44px',
                  }}
                />

                <div
                  style={{
                    marginTop: '8px',
                    color: '#63758a',
                    fontSize: '13px',
                  }}
                >
                  {useCustomColor
                    ? color
                    : 'Automatic graph color'}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems:
                      'center',
                    gap: '8px',
                    marginBottom:
                      '10px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      useCustomWidth
                    }
                    onChange={(
                      event,
                    ) =>
                      setUseCustomWidth(
                        event.target
                          .checked,
                      )
                    }
                  />

                  Custom width
                </label>

                <input
                  type="number"
                  min="0.25"
                  max="8"
                  step="0.25"
                  value={width}
                  disabled={
                    !useCustomWidth
                  }
                  onChange={(
                    event,
                  ) =>
                    setWidth(
                      Number(
                        event.target
                          .value,
                      ),
                    )
                  }
                  style={{
                    width: '100%',
                    boxSizing:
                      'border-box',
                    padding: '10px',
                  }}
                />

                <div
                  style={{
                    marginTop: '8px',
                    color: '#63758a',
                    fontSize: '13px',
                  }}
                >
                  {useCustomWidth
                    ? `${width}px`
                    : 'Automatic graph width'}
                </div>
              </div>
            </div>

            <div
              style={{
                marginBottom: '22px',
                padding: '18px',
                borderRadius:
                  '12px',
                background:
                  '#f8fbfc',
              }}
            >
              <div
                style={{
                  marginBottom:
                    '12px',
                  color: '#63758a',
                  fontSize: '13px',
                }}
              >
                Preview
              </div>

              <div
                style={{
                  height: `${
                    useCustomWidth
                      ? Math.max(
                          1,
                          width,
                        )
                      : 1
                  }px`,
                  borderRadius:
                    '999px',
                  background:
                    useCustomColor
                      ? color
                      : DEFAULT_PREVIEW_COLOR,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <button
                type="button"
                disabled={saving}
                onClick={saveStyle}
              >
                {saving
                  ? 'Saving...'
                  : 'Save edge style'}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={resetStyle}
              >
                Reset to defaults
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
