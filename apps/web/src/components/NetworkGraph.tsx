import { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';

type TaxonomyItem = {
  id: string;
  name: string;
};

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
  categories: TaxonomyItem[];
  interests: TaxonomyItem[];
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

  const [selectedNode, setSelectedNode] =
    useState<GraphNode | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let renderer: Sigma | null = null;

    async function loadGraph() {
      try {
        const response = await fetch('/api/v1/graph');

        if (!response.ok) {
          throw new Error(
            `Graph API returned HTTP ${response.status}`,
          );
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
                weight: Math.max(1, edge.strength),
              },
            );
          }
        });

        if (graph.order > 1) {
          forceAtlas2.assign(graph, {
            iterations: 100,
            settings: forceAtlas2.inferSettings(graph),
          });
        }

        if (!containerRef.current) {
          return;
        }

        renderer = new Sigma(graph, containerRef.current, {
          renderEdgeLabels: true,
        });

        renderer.on('clickNode', ({ node }) => {
          const person =
            data.nodes.find((item) => item.id === node) ?? null;

          setSelectedNode(person);
        });

        renderer.on('clickStage', () => {
          setSelectedNode(null);
        });

        renderer.on('enterNode', () => {
          if (containerRef.current) {
            containerRef.current.style.cursor = 'pointer';
          }
        });

        renderer.on('leaveNode', () => {
          if (containerRef.current) {
            containerRef.current.style.cursor = 'default';
          }
        });

        setMeta(data.meta);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unknown graph loading error',
        );
      }
    }

    loadGraph();

    return () => {
      renderer?.kill();
    };
  }, []);

  return (
    <main
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        fontFamily: 'sans-serif',
      }}
    >
      <section
        style={{
          flex: 1,
          minWidth: 0,
        }}
      >
        <header
          style={{
            display: 'flex',
            gap: '24px',
            padding: '14px 18px',
            borderBottom: '1px solid #ddd',
          }}
        >
          <strong>Personal Network Graph</strong>
          <span>People: {meta.nodeCount}</span>
          <span>Relationships: {meta.edgeCount}</span>
        </header>

        {error ? (
          <div style={{ padding: '20px' }}>{error}</div>
        ) : (
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: 'calc(100vh - 50px)',
            }}
          />
        )}
      </section>

      {selectedNode && (
        <aside
          style={{
            width: '320px',
            padding: '24px',
            borderLeft: '1px solid #ddd',
            overflowY: 'auto',
          }}
        >
          <h2>{selectedNode.label}</h2>

          {selectedNode.nickname && (
            <p>Nickname: {selectedNode.nickname}</p>
          )}

          {selectedNode.company && (
            <p>Company: {selectedNode.company}</p>
          )}

          {selectedNode.position && (
            <p>Position: {selectedNode.position}</p>
          )}

          {(selectedNode.city || selectedNode.country) && (
            <p>
              Location:{' '}
              {[selectedNode.city, selectedNode.country]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}

          <p>Importance: {selectedNode.importance}/5</p>

          <h3>Categories</h3>

          {selectedNode.categories.length > 0 ? (
            <ul>
              {selectedNode.categories.map((category) => (
                <li key={category.id}>{category.name}</li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}

          <h3>Interests</h3>

          {selectedNode.interests.length > 0 ? (
            <ul>
              {selectedNode.interests.map((interest) => (
                <li key={interest.id}>{interest.name}</li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}

          <button
            type="button"
            onClick={() => setSelectedNode(null)}
          >
            Close
          </button>
        </aside>
      )}
    </main>
  );
}
