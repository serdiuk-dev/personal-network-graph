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
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const dataRef = useRef<GraphNode[]>([]);

  const [meta, setMeta] = useState({
    nodeCount: 0,
    edgeCount: 0,
  });

  const [selectedNode, setSelectedNode] =
    useState<GraphNode | null>(null);

  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  function selectNode(nodeId: string | null) {
    const renderer = sigmaRef.current;
    const graph = graphRef.current;

    if (!renderer || !graph) {
      return;
    }

    if (!nodeId) {
      setSelectedNode(null);

      renderer.setSetting('nodeReducer', null);
      renderer.setSetting('edgeReducer', null);
      renderer.refresh();

      return;
    }

    const person =
      dataRef.current.find((item) => item.id === nodeId) ?? null;

    setSelectedNode(person);

    const neighbors = new Set(graph.neighbors(nodeId));

    renderer.setSetting('nodeReducer', (node, data) => {
      if (node === nodeId) {
        return {
          ...data,
          highlighted: true,
          size: Math.max(data.size ?? 8, 14),
          zIndex: 2,
        };
      }

      if (neighbors.has(node)) {
        return {
          ...data,
          highlighted: true,
          zIndex: 1,
        };
      }

      return {
        ...data,
        color: '#d6d6d6',
        label: '',
        zIndex: 0,
      };
    });

    renderer.setSetting('edgeReducer', (edge, data) => {
      const source = graph.source(edge);
      const target = graph.target(edge);

      if (
        source === nodeId ||
        target === nodeId
      ) {
        return {
          ...data,
          hidden: false,
          size: Math.max(data.size ?? 1, 2),
          zIndex: 1,
        };
      }

      return {
        ...data,
        hidden: true,
      };
    });

    renderer.refresh();

    const position = renderer.getNodeDisplayData(nodeId);

    if (position) {
      renderer.getCamera().animate(
        {
          x: position.x,
          y: position.y,
          ratio: 0.35,
        },
        {
          duration: 500,
        },
      );
    }
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();

    const query = search.trim().toLowerCase();

    if (!query) {
      selectNode(null);
      return;
    }

    const person = dataRef.current.find((node) => {
      const haystack = [
        node.label,
        node.nickname,
        node.company,
        node.position,
        node.city,
        node.country,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });

    if (person) {
      selectNode(person.id);
    }
  }

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

        dataRef.current = data.nodes;

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

        graphRef.current = graph;

        if (!containerRef.current) {
          return;
        }

        renderer = new Sigma(graph, containerRef.current, {
          renderEdgeLabels: true,
          zIndex: true,
        });

        sigmaRef.current = renderer;

        renderer.on('clickNode', ({ node }) => {
          selectNode(node);
        });

        renderer.on('clickStage', () => {
          selectNode(null);
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
      sigmaRef.current = null;
      graphRef.current = null;
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
            alignItems: 'center',
            gap: '20px',
            padding: '12px 18px',
            borderBottom: '1px solid #ddd',
          }}
        >
          <strong>Personal Network Graph</strong>

          <span>People: {meta.nodeCount}</span>
          <span>Relationships: {meta.edgeCount}</span>

          <form
            onSubmit={handleSearchSubmit}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search person..."
              style={{
                width: '240px',
                padding: '8px 10px',
              }}
            />

            <button type="submit">
              Find
            </button>

            <button
              type="button"
              onClick={() => {
                setSearch('');
                selectNode(null);
              }}
            >
              Reset
            </button>
          </form>
        </header>

        {error ? (
          <div style={{ padding: '20px' }}>
            {error}
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              width: '100%',
              height: 'calc(100vh - 58px)',
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

          <p>
            Importance: {selectedNode.importance}/5
          </p>

          <h3>Categories</h3>

          {selectedNode.categories.length ? (
            <ul>
              {selectedNode.categories.map((category) => (
                <li key={category.id}>
                  {category.name}
                </li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}

          <h3>Interests</h3>

          {selectedNode.interests.length ? (
            <ul>
              {selectedNode.interests.map((interest) => (
                <li key={interest.id}>
                  {interest.name}
                </li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}

          <button
            type="button"
            onClick={() => selectNode(null)}
          >
            Close
          </button>
        </aside>
      )}
    </main>
  );
}
