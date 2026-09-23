import {
  useEffect,
  useState,
  type CSSProperties,
} from 'react';

type AnalyticsNode = {
  id: string;
  label: string;
  communityId: number;
  roles: string[];

  metrics: {
    degree: number;
    weightedDegree: number;
    betweenness: number;
  };

  clusterMetrics: {
    internalDegree: number;
    internalWeightedDegree: number;
    externalDegree: number;
    externalWeightedDegree: number;
    externalCommunityCount: number;
    withinCommunityZScore: number;
    participationCoefficient: number;
  };
};

type AnalyticsResponse = {
  meta: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    communityCount: number;
    modularity: number;
    communityAlgorithm: string;
    analyticalModel: string;
  };

  nodes: AnalyticsNode[];

  rankings: {
    connectors: AnalyticsNode[];
    strongestNetworks: AnalyticsNode[];
    bridges: AnalyticsNode[];
  };
};

type NetworkOverviewProps = {
  refreshKey: number;
};

const cardStyle: CSSProperties = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: '12px',
  padding: '18px',
};

const metricValueStyle: CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  marginTop: '6px',
};

function RankingList({
  title,
  nodes,
  value,
}: {
  title: string;
  nodes: AnalyticsNode[];
  value: (node: AnalyticsNode) => string;
}) {
  return (
    <section style={cardStyle}>
      <h2
        style={{
          marginTop: 0,
          fontSize: '18px',
        }}
      >
        {title}
      </h2>

      {nodes.length === 0 ? (
        <p style={{ color: '#666' }}>
          No data yet.
        </p>
      ) : (
        <ol
          style={{
            marginBottom: 0,
            paddingLeft: '22px',
          }}
        >
          {nodes.map((node) => (
            <li
              key={node.id}
              style={{
                marginBottom: '10px',
              }}
            >
              <strong>{node.label}</strong>

              <div
                style={{
                  color: '#666',
                  fontSize: '13px',
                }}
              >
                {value(node)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function NetworkOverview({
  refreshKey,
}: NetworkOverviewProps) {
  const [analytics, setAnalytics] =
    useState<AnalyticsResponse | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          '/api/v1/analytics/network',
        );

        if (!response.ok) {
          throw new Error(
            `Analytics API returned HTTP ${response.status}`,
          );
        }

        const data: AnalyticsResponse =
          await response.json();

        if (!cancelled) {
          setAnalytics(data);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to load analytics',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div style={{ padding: '24px' }}>
        Loading network analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <h1>Network Overview</h1>

        <p style={{ color: '#b42318' }}>
          {error}
        </p>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const clusterHubs =
    analytics.nodes
      .filter((node) =>
        node.roles.includes('clusterHub'),
      )
      .sort(
        (a, b) =>
          b.clusterMetrics
            .internalWeightedDegree -
          a.clusterMetrics
            .internalWeightedDegree,
      );

  const interClusterBridges =
    analytics.nodes
      .filter((node) =>
        node.roles.includes(
          'interClusterBridge',
        ),
      )
      .sort(
        (a, b) =>
          b.clusterMetrics
            .externalWeightedDegree -
          a.clusterMetrics
            .externalWeightedDegree,
      );

  const overviewMetrics = [
    {
      label: 'People',
      value: analytics.meta.nodeCount,
    },
    {
      label: 'Relationships',
      value: analytics.meta.edgeCount,
    },
    {
      label: 'Density',
      value: analytics.meta.density.toFixed(4),
    },
    {
      label: 'Communities',
      value: analytics.meta.communityCount,
    },
    {
      label: 'Modularity',
      value: analytics.meta.modularity.toFixed(4),
    },
  ];

  return (
    <main
      style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          marginBottom: '24px',
        }}
      >
        <h1 style={{ marginBottom: '6px' }}>
          Network Overview
        </h1>

        <div style={{ color: '#666' }}>
          {analytics.meta.communityAlgorithm}
          {' communities · '}
          {analytics.meta.analyticalModel}
          {' network model'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px',
          marginBottom: '22px',
        }}
      >
        {overviewMetrics.map(
          (metric) => (
            <section
              key={metric.label}
              style={cardStyle}
            >
              <div
                style={{
                  color: '#666',
                  fontSize: '14px',
                }}
              >
                {metric.label}
              </div>

              <div style={metricValueStyle}>
                {metric.value}
              </div>
            </section>
          ),
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        <RankingList
          title="Top Connectors"
          nodes={
            analytics.rankings.connectors
          }
          value={(node) =>
            `Degree: ${node.metrics.degree}`
          }
        />

        <RankingList
          title="Strongest Networks"
          nodes={
            analytics.rankings
              .strongestNetworks
          }
          value={(node) =>
            `Weighted degree: ${node.metrics.weightedDegree}`
          }
        />

        <RankingList
          title="Bridges"
          nodes={
            analytics.rankings.bridges
          }
          value={(node) =>
            `Betweenness: ${node.metrics.betweenness}`
          }
        />

        <RankingList
          title="Cluster Hubs"
          nodes={clusterHubs}
          value={(node) =>
            `Community ${node.communityId} · Internal weighted degree: ${node.clusterMetrics.internalWeightedDegree}`
          }
        />

        <RankingList
          title="Inter-cluster Bridges"
          nodes={interClusterBridges}
          value={(node) =>
            `Community ${node.communityId} · External degree: ${node.clusterMetrics.externalDegree} · External communities: ${node.clusterMetrics.externalCommunityCount}`
          }
        />
      </div>
    </main>
  );
}
