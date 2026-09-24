import {
  useEffect,
  useState,
} from 'react';

export type GraphStyleSettings = {
  innerRingColor: string;
  innerRingOpacity: number;
  innerRingWidth: number;

  middleRingColor: string;
  middleRingOpacity: number;
  middleRingWidth: number;

  outerRingColor: string;
  outerRingOpacity: number;
  outerRingWidth: number;

  innerEgoColor: string;
  innerEgoOpacity: number;
  innerEgoWidth: number;

  middleEgoColor: string;
  middleEgoOpacity: number;
  middleEgoWidth: number;

  outerEgoColor: string;
  outerEgoOpacity: number;
  outerEgoWidth: number;

  relationshipDefaultColor: string;
  relationshipDefaultOpacity: number;
  relationshipDefaultWidthScale: number;

  relationshipFocusColor: string;
  relationshipFocusOpacity: number;
  relationshipFocusWidthScale: number;

  relationshipInactiveColor: string;
  relationshipInactiveOpacity: number;
  relationshipInactiveWidth: number;
};

export const DEFAULT_GRAPH_STYLES:
  GraphStyleSettings = {
    innerRingColor: '#7dd3fc',
    innerRingOpacity: 0.42,
    innerRingWidth: 1.4,

    middleRingColor: '#7dd3fc',
    middleRingOpacity: 0.30,
    middleRingWidth: 1.2,

    outerRingColor: '#7dd3fc',
    outerRingOpacity: 0.20,
    outerRingWidth: 1.0,

    innerEgoColor: '#9bded9',
    innerEgoOpacity: 0.72,
    innerEgoWidth: 0.85,

    middleEgoColor: '#c7e0e8',
    middleEgoOpacity: 0.64,
    middleEgoWidth: 0.60,

    outerEgoColor: '#e1ebef',
    outerEgoOpacity: 0.75,
    outerEgoWidth: 0.40,

    relationshipDefaultColor: '#bfd6e3',
    relationshipDefaultOpacity: 0.55,
    relationshipDefaultWidthScale: 1.0,

    relationshipFocusColor: '#65b7e8',
    relationshipFocusOpacity: 0.92,
    relationshipFocusWidthScale: 1.0,

    relationshipInactiveColor: '#e4ecef',
    relationshipInactiveOpacity: 0.65,
    relationshipInactiveWidth: 0.45,
  };

const GRAPH_STYLE_KEYS = [
  'innerRingColor',
  'innerRingOpacity',
  'innerRingWidth',
  'middleRingColor',
  'middleRingOpacity',
  'middleRingWidth',
  'outerRingColor',
  'outerRingOpacity',
  'outerRingWidth',

  'innerEgoColor',
  'innerEgoOpacity',
  'innerEgoWidth',
  'middleEgoColor',
  'middleEgoOpacity',
  'middleEgoWidth',
  'outerEgoColor',
  'outerEgoOpacity',
  'outerEgoWidth',

  'relationshipDefaultColor',
  'relationshipDefaultOpacity',
  'relationshipDefaultWidthScale',
  'relationshipFocusColor',
  'relationshipFocusOpacity',
  'relationshipFocusWidthScale',
  'relationshipInactiveColor',
  'relationshipInactiveOpacity',
  'relationshipInactiveWidth',
] as const;

function sanitizeGraphStyles(
  source: Record<string, unknown>,
): GraphStyleSettings {
  const result = {
    ...DEFAULT_GRAPH_STYLES,
  };

  for (const key of GRAPH_STYLE_KEYS) {
    if (source[key] !== undefined) {
      (
        result as Record<string, unknown>
      )[key] = source[key];
    }
  }

  return result;
}

type GraphStyleManagerProps = {
  onChanged: () => void;
};

type LineEditorProps = {
  title: string;
  description?: string;
  color: string;
  opacity: number;
  width: number;
  widthLabel?: string;
  onColor: (value: string) => void;
  onOpacity: (value: number) => void;
  onWidth: (value: number) => void;
};

function LineEditor({
  title,
  description,
  color,
  opacity,
  width,
  widthLabel = 'Width',
  onColor,
  onOpacity,
  onWidth,
}: LineEditorProps) {
  return (
    <section
      style={{
        border: '1px solid #e4edf1',
        borderRadius: '14px',
        padding: '18px',
        background: '#fff',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: '4px',
        }}
      >
        {title}
      </div>

      {description && (
        <div
          style={{
            color: '#63758a',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {description}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(180px, 1fr) minmax(180px, 1fr) minmax(150px, 1fr)',
          gap: '16px',
          alignItems: 'end',
        }}
      >
        <label>
          Color
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '6px',
            }}
          >
            <input
              type="color"
              value={color}
              onChange={(event) =>
                onColor(
                  event.target.value,
                )
              }
            />

            <input
              value={color}
              onChange={(event) =>
                onColor(
                  event.target.value,
                )
              }
              style={{
                width: '100%',
              }}
            />
          </div>
        </label>

        <label>
          Opacity: {opacity.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={opacity}
            onChange={(event) =>
              onOpacity(
                Number(
                  event.target.value,
                ),
              )
            }
            style={{
              display: 'block',
              width: '100%',
              marginTop: '10px',
            }}
          />
        </label>

        <label>
          {widthLabel}
          <input
            type="number"
            min={0.1}
            max={10}
            step={0.05}
            value={width}
            onChange={(event) =>
              onWidth(
                Number(
                  event.target.value,
                ),
              )
            }
            style={{
              display: 'block',
              width: '100%',
              marginTop: '6px',
            }}
          />
        </label>
      </div>

      <div
        style={{
          height: '28px',
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height:
              `${Math.max(
                1,
                Math.min(
                  8,
                  width,
                ),
              )}px`,
            borderRadius: '999px',
            background: color,
            opacity,
          }}
        />
      </div>
    </section>
  );
}

export function GraphStyleManager({
  onChanged,
}: GraphStyleManagerProps) {
  const [
    styles,
    setStyles,
  ] = useState<GraphStyleSettings>(
    DEFAULT_GRAPH_STYLES,
  );

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  async function loadStyles() {
    setLoading(true);
    setError(null);

    try {
      const response =
        await fetch(
          '/api/v1/graph-styles',
        );

      if (!response.ok) {
        throw new Error(
          `Graph Styles API returned HTTP ${response.status}`,
        );
      }

      const data =
        await response.json();

      setStyles(
        sanitizeGraphStyles(
          data as Record<string, unknown>,
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to load graph styles',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStyles();
  }, []);

  function update<
    K extends keyof GraphStyleSettings
  >(
    key: K,
    value: GraphStyleSettings[K],
  ) {
    setStyles((current) => ({
      ...current,
      [key]: value,
    }));

    setMessage(null);
  }

  async function persist(
    next: GraphStyleSettings,
  ) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response =
        await fetch(
          '/api/v1/graph-styles',
          {
            method: 'PATCH',
            headers: {
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify(
                sanitizeGraphStyles(
                  next as unknown as
                    Record<string, unknown>,
                ),
              ),
          },
        );

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `Graph Styles API returned HTTP ${response.status}: ${body}`,
        );
      }

      const saved =
        await response.json();

      setStyles(
        sanitizeGraphStyles(
          saved as Record<string, unknown>,
        ),
      );

      onChanged();
      setMessage(
        'Graph styles saved.',
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to save graph styles',
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    setStyles(
      DEFAULT_GRAPH_STYLES,
    );

    await persist(
      DEFAULT_GRAPH_STYLES,
    );
  }

  if (loading) {
    return (
      <main
        style={{
          padding: '24px',
          fontFamily: 'sans-serif',
        }}
      >
        Loading graph styles...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: '1180px',
        margin: '0 auto',
        padding: '28px',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, sans-serif',
        color: '#17233d',
      }}
    >
      <h1
        style={{
          marginBottom: '6px',
        }}
      >
        Graph Styles
      </h1>

      <p
        style={{
          marginTop: 0,
          color: '#63758a',
          maxWidth: '760px',
        }}
      >
        Global persistent styling for
        network circles, ego connections
        and relationship lines.
        Individual Edge Styles remain
        available as per-relationship
        overrides.
      </p>

      {error && (
        <p style={{ color: '#b42318' }}>
          {error}
        </p>
      )}

      {message && (
        <p style={{ color: '#0f766e' }}>
          {message}
        </p>
      )}

      <h2>Relationship circles</h2>

      <div
        style={{
          display: 'grid',
          gap: '14px',
        }}
      >
        <LineEditor
          title="Inner circle"
          description="Closest relationship sphere."
          color={styles.innerRingColor}
          opacity={styles.innerRingOpacity}
          width={styles.innerRingWidth}
          onColor={(value) =>
            update(
              'innerRingColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'innerRingOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'innerRingWidth',
              value,
            )
          }
        />

        <LineEditor
          title="Middle circle"
          description="Regular relationship sphere."
          color={styles.middleRingColor}
          opacity={styles.middleRingOpacity}
          width={styles.middleRingWidth}
          onColor={(value) =>
            update(
              'middleRingColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'middleRingOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'middleRingWidth',
              value,
            )
          }
        />

        <LineEditor
          title="Outer circle"
          description="Distant relationship sphere."
          color={styles.outerRingColor}
          opacity={styles.outerRingOpacity}
          width={styles.outerRingWidth}
          onColor={(value) =>
            update(
              'outerRingColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'outerRingOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'outerRingWidth',
              value,
            )
          }
        />
      </div>

      <h2
        style={{
          marginTop: '32px',
        }}
      >
        Me → contact lines
      </h2>

      <div
        style={{
          display: 'grid',
          gap: '14px',
        }}
      >
        <LineEditor
          title="Inner ego lines"
          color={styles.innerEgoColor}
          opacity={styles.innerEgoOpacity}
          width={styles.innerEgoWidth}
          onColor={(value) =>
            update(
              'innerEgoColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'innerEgoOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'innerEgoWidth',
              value,
            )
          }
        />

        <LineEditor
          title="Middle ego lines"
          color={styles.middleEgoColor}
          opacity={styles.middleEgoOpacity}
          width={styles.middleEgoWidth}
          onColor={(value) =>
            update(
              'middleEgoColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'middleEgoOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'middleEgoWidth',
              value,
            )
          }
        />

        <LineEditor
          title="Outer ego lines"
          color={styles.outerEgoColor}
          opacity={styles.outerEgoOpacity}
          width={styles.outerEgoWidth}
          onColor={(value) =>
            update(
              'outerEgoColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'outerEgoOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'outerEgoWidth',
              value,
            )
          }
        />
      </div>

      <h2
        style={{
          marginTop: '32px',
        }}
      >
        Relationship lines
      </h2>

      <div
        style={{
          display: 'grid',
          gap: '14px',
        }}
      >
        <LineEditor
          title="Overview relationships"
          description="Default graph view."
          color={
            styles.relationshipDefaultColor
          }
          opacity={
            styles.relationshipDefaultOpacity
          }
          width={
            styles.relationshipDefaultWidthScale
          }
          widthLabel="Width scale"
          onColor={(value) =>
            update(
              'relationshipDefaultColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'relationshipDefaultOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'relationshipDefaultWidthScale',
              value,
            )
          }
        />

        <LineEditor
          title="Focused relationships"
          description="Direct links of the selected contact."
          color={
            styles.relationshipFocusColor
          }
          opacity={
            styles.relationshipFocusOpacity
          }
          width={
            styles.relationshipFocusWidthScale
          }
          widthLabel="Width scale"
          onColor={(value) =>
            update(
              'relationshipFocusColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'relationshipFocusOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'relationshipFocusWidthScale',
              value,
            )
          }
        />

        <LineEditor
          title="Inactive relationships"
          description="Background topology while a contact is selected."
          color={
            styles.relationshipInactiveColor
          }
          opacity={
            styles.relationshipInactiveOpacity
          }
          width={
            styles.relationshipInactiveWidth
          }
          onColor={(value) =>
            update(
              'relationshipInactiveColor',
              value,
            )
          }
          onOpacity={(value) =>
            update(
              'relationshipInactiveOpacity',
              value,
            )
          }
          onWidth={(value) =>
            update(
              'relationshipInactiveWidth',
              value,
            )
          }
        />
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: '28px',
          padding: '16px 0',
          display: 'flex',
          gap: '12px',
          background:
            'rgba(248,251,252,0.94)',
          backdropFilter:
            'blur(10px)',
        }}
      >
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void persist(styles)
          }
        >
          {saving
            ? 'Saving...'
            : 'Save Graph Styles'}
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void resetDefaults()
          }
        >
          Reset defaults
        </button>
      </div>
    </main>
  );
}
