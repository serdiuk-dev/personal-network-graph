import { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';

type GraphNode = {
  id: string;
  label: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  company: string | null;
  position: string | null;
  city: string | null;
  country: string | null;
  importance: number;
  categories: {
    id: string;
    name: string;
  }[];
  interests: {
    id: string;
    name: string;
  }[];
};

type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string | null;
  strength: number;
  notes: string | null;
};

type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    nodeCount: number;
    edgeCount: number;
  };
};

export function NetworkGraph() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [meta, setMeta] = useState({
    nodeCount: 0,
    edgeCount: 0,
  });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let renderer: Sigma | null = null;

    async function loadGraph() {
      try {
        const response = await fetch('/api/v1/graph');

        if (!response.ok) {
          throw new Error(`Graph API returned HTTP ${response.status}`);
        }

        const data: GraphResponse = await response.json();

        const graph = new Graph({
          type: 'directed',
          multi: false,
        });

        const total = Math.max(data.nodes.length, 1);

        data.nodes.forEach((node, index) => {
          const angle = (index / total) * Math.PI * 2;

          graph.addNode(node.id, {
            label: node.label,
            x: Math.cos(angle),
            y: Math.sin(angle),
            size: 6 + node.importance * 2,
            importance: node.importance,
            company: node.company,
            city: node.city,
          });
        });

        data.edges.forEach((edge) => {
          if (
            graph.hasNode(edge.source) &&
            graph.hasNode(edge.target)
          ) {
            graph.addDirectedEdgeWithKey(
              edge.id,
              edge.source,
              edge.target,
              {
                label: edge.type ?? undefined,
                size: Math.max(1, edge.strength),
              },
            );
          }
        });

        if (!containerRef.current) {
          return;
        }

        renderer = new Sigma(graph, containerRef.current, {
          renderEdgeLabels: true,
        });

        setMeta(data.meta);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Unknown graph loading error';

        setError(message);
      }
    }

    loadGraph();

    return () => {
      renderer?.kill();
    };
  }, []);

  return (
    <section style={{ width: '100%', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: '24px',
          padding: '12px 16px',
          fontFamily: 'sans-serif',
        }}
      >
        <span>People: {meta.nodeCount}</span>
        <span>Relationships: {meta.edgeCount}</span>
      </div>

      {error ? (
        <div
          style={{
            padding: '20px',
            color: 'crimson',
            fontFamily: 'sans-serif',
          }}
        >
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: 'calc(100vh - 60px)',
          }}
        />
      )}
    </section>
  );
}
