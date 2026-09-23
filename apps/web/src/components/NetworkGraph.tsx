import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

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

type AnalyticsNode = {
  id: string;
  communityId: number;
  roles: string[];
};

type AnalyticsResponse = {
  nodes: AnalyticsNode[];
};

type ColorMode =
  | 'category'
  | 'community';

type NetworkGraphProps = {
  refreshKey: number;
};

const CATEGORY_COLORS = [
  '#2563eb',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#be123c',
  '#4f46e5',
  '#65a30d',
  '#c026d3',
  '#0f766e',
];

const COMMUNITY_COLORS = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#be123c',
  '#4f46e5',
  '#65a30d',
  '#c026d3',
  '#0f766e',
  '#ca8a04',
];

function communityColor(
  communityId: number | undefined,
) {
  if (communityId === undefined) {
    return '#64748b';
  }

  return COMMUNITY_COLORS[
    Math.abs(communityId) %
      COMMUNITY_COLORS.length
  ];
}

function categoryColor(name: string | null) {
  if (!name) {
    return '#64748b';
  }

  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash =
      (hash * 31 + name.charCodeAt(index)) >>> 0;
  }

  return CATEGORY_COLORS[
    hash % CATEGORY_COLORS.length
  ];
}

function primaryCategory(node: GraphNode) {
  if (node.categories.length === 0) {
    return null;
  }

  return [...node.categories].sort((a, b) =>
    a.name.localeCompare(b.name),
  )[0].name;
}

export function NetworkGraph({
  refreshKey,
}: NetworkGraphProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const sigmaRef =
    useRef<Sigma | null>(null);

  const graphRef =
    useRef<Graph | null>(null);

  const dataRef =
    useRef<GraphNode[]>([]);

  const analyticsRef =
    useRef<
      Map<string, AnalyticsNode>
    >(new Map());

  const [meta, setMeta] = useState({
    nodeCount: 0,
    edgeCount: 0,
  });

  const [visibleCount, setVisibleCount] =
    useState(0);

  const [selectedNode, setSelectedNode] =
    useState<GraphNode | null>(null);

  const [search, setSearch] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('');

  const [interestFilter, setInterestFilter] =
    useState('');

  const [minImportance, setMinImportance] =
    useState(1);

  const [categories, setCategories] =
    useState<TaxonomyItem[]>([]);

  const [interests, setInterests] =
    useState<TaxonomyItem[]>([]);

  const [reloadKey, setReloadKey] =
    useState(0);

  const [colorMode, setColorMode] =
    useState<ColorMode>('category');

  const [communityIds, setCommunityIds] =
    useState<number[]>([]);

  const [error, setError] =
    useState<string | null>(null);

  function passesFilters(node: GraphNode) {
    if (node.importance < minImportance) {
      return false;
    }

    if (
      categoryFilter &&
      !node.categories.some(
        (category) =>
          category.id === categoryFilter,
      )
    ) {
      return false;
    }

    if (
      interestFilter &&
      !node.interests.some(
        (interest) =>
          interest.id === interestFilter,
      )
    ) {
      return false;
    }

    return true;
  }

  function applyGraphView(
    selectedId: string | null,
  ) {
    const renderer = sigmaRef.current;
    const graph = graphRef.current;

    if (!renderer || !graph) {
      return;
    }

    const visibleIds = new Set(
      dataRef.current
        .filter(passesFilters)
        .map((node) => node.id),
    );

    setVisibleCount(visibleIds.size);

    const neighbors =
      selectedId &&
      graph.hasNode(selectedId)
        ? new Set(graph.neighbors(selectedId))
        : new Set<string>();

    renderer.setSetting(
      'nodeReducer',
      (node, data) => {
        const person =
          dataRef.current.find(
            (item) => item.id === node,
          );

        if (
          !person ||
          !visibleIds.has(node)
        ) {
          return {
            ...data,
            hidden: true,
          };
        }

        const analytics =
          analyticsRef.current.get(
            node,
          );

        const color =
          colorMode === 'community'
            ? communityColor(
                analytics?.communityId,
              )
            : categoryColor(
                primaryCategory(
                  person,
                ),
              );

        const isClusterHub =
          analytics?.roles.includes(
            'clusterHub',
          ) ?? false;

        const isInterClusterBridge =
          analytics?.roles.includes(
            'interClusterBridge',
          ) ?? false;

        const specialRole =
          colorMode === 'community' &&
          (
            isClusterHub ||
            isInterClusterBridge
          );

        const roleSizeBonus =
          colorMode === 'community'
            ? (
                (isClusterHub ? 4 : 0) +
                (
                  isInterClusterBridge
                    ? 2
                    : 0
                )
              )
            : 0;

        const nodeSize =
          6 +
          person.importance * 2 +
          roleSizeBonus;

        if (!selectedId) {
          return {
            ...data,
            hidden: false,
            color,
            size: nodeSize,
            highlighted:
              specialRole,
            zIndex:
              specialRole
                ? 2
                : 0,
          };
        }

        if (node === selectedId) {
          return {
            ...data,
            hidden: false,
            color,
            highlighted: true,
            size: Math.max(
              16,
              nodeSize,
            ),
            zIndex: 3,
          };
        }

        if (neighbors.has(node)) {
          return {
            ...data,
            hidden: false,
            color,
            highlighted: true,
            size: nodeSize,
            zIndex:
              specialRole
                ? 2
                : 1,
          };
        }

        return {
          ...data,
          hidden: false,
          color: '#d1d5db',
          label: '',
          zIndex: 0,
        };
      },
    );

    renderer.setSetting(
      'edgeReducer',
      (edge, data) => {
        const source =
          graph.source(edge);

        const target =
          graph.target(edge);

        if (
          !visibleIds.has(source) ||
          !visibleIds.has(target)
        ) {
          return {
            ...data,
            hidden: true,
          };
        }

        if (
          selectedId &&
          source !== selectedId &&
          target !== selectedId
        ) {
          return {
            ...data,
            hidden: true,
          };
        }

        return {
          ...data,
          hidden: false,
          size: selectedId
            ? Math.max(
                data.size ?? 1,
                2,
              )
            : data.size,
          zIndex: selectedId
            ? 1
            : 0,
        };
      },
    );

    renderer.refresh();
  }

  function selectNode(
    nodeId: string | null,
  ) {
    const renderer = sigmaRef.current;

    if (!renderer) {
      return;
    }

    if (!nodeId) {
      setSelectedNode(null);
      applyGraphView(null);
      return;
    }

    const person =
      dataRef.current.find(
        (item) =>
          item.id === nodeId,
      ) ?? null;

    if (
      !person ||
      !passesFilters(person)
    ) {
      return;
    }

    setSelectedNode(person);
    applyGraphView(nodeId);

    const position =
      renderer.getNodeDisplayData(
        nodeId,
      );

    if (position) {
      renderer
        .getCamera()
        .animate(
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

  function handleSearchSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    const query =
      search
        .trim()
        .toLowerCase();

    if (!query) {
      selectNode(null);
      return;
    }

    const person =
      dataRef.current.find(
        (node) => {
          if (
            !passesFilters(node)
          ) {
            return false;
          }

          const haystack = [
            node.label,
            node.nickname,
            node.company,
            node.position,
            node.city,
            node.country,
            ...node.categories.map(
              (item) => item.name,
            ),
            ...node.interests.map(
              (item) => item.name,
            ),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(
            query,
          );
        },
      );

    if (person) {
      selectNode(person.id);
    }
  }

  function resetFilters() {
    setCategoryFilter('');
    setInterestFilter('');
    setMinImportance(1);
    setSearch('');
    setSelectedNode(null);
  }

  useEffect(() => {
    let renderer: Sigma | null =
      null;

    async function loadGraph() {
      try {
        const [
          response,
          analyticsResponse,
        ] = await Promise.all([
          fetch('/api/v1/graph'),
          fetch(
            '/api/v1/analytics/network',
          ),
        ]);

        if (!response.ok) {
          throw new Error(
            `Graph API returned HTTP ${response.status}`,
          );
        }

        const data: GraphResponse =
          await response.json();

        const analytics:
          AnalyticsResponse =
          analyticsResponse.ok
            ? await analyticsResponse.json()
            : {
                nodes: [],
              };

        dataRef.current =
          data.nodes;

        analyticsRef.current =
          new Map(
            analytics.nodes.map(
              (node) => [
                node.id,
                node,
              ],
            ),
          );

        setCommunityIds(
          [
            ...new Set(
              analytics.nodes.map(
                (node) =>
                  node.communityId,
              ),
            ),
          ].sort(
            (a, b) =>
              a - b,
          ),
        );

        const categoryMap =
          new Map<
            string,
            TaxonomyItem
          >();

        const interestMap =
          new Map<
            string,
            TaxonomyItem
          >();

        data.nodes.forEach(
          (node) => {
            node.categories.forEach(
              (category) =>
                categoryMap.set(
                  category.id,
                  category,
                ),
            );

            node.interests.forEach(
              (interest) =>
                interestMap.set(
                  interest.id,
                  interest,
                ),
            );
          },
        );

        setCategories(
          [...categoryMap.values()].sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
              ),
          ),
        );

        setInterests(
          [...interestMap.values()].sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
              ),
          ),
        );

        const graph =
          new Graph({
            type: 'directed',
            multi: false,
          });

        const total =
          Math.max(
            data.nodes.length,
            1,
          );

        data.nodes.forEach(
          (node, index) => {
            const angle =
              (index / total) *
              Math.PI *
              2;

            graph.addNode(
              node.id,
              {
                label:
                  node.label,
                x: Math.cos(
                  angle,
                ),
                y: Math.sin(
                  angle,
                ),
                size:
                  6 +
                  node.importance *
                    2,
                color:
                  categoryColor(
                    primaryCategory(
                      node,
                    ),
                  ),
                importance:
                  node.importance,
              },
            );
          },
        );

        data.edges.forEach(
          (edge) => {
            if (
              graph.hasNode(
                edge.source,
              ) &&
              graph.hasNode(
                edge.target,
              )
            ) {
              graph.addDirectedEdgeWithKey(
                edge.id,
                edge.source,
                edge.target,
                {
                  label:
                    edge.type ??
                    undefined,
                  size:
                    Math.max(
                      1,
                      edge.strength,
                    ),
                  weight:
                    Math.max(
                      1,
                      edge.strength,
                    ),
                },
              );
            }
          },
        );

        if (graph.order > 1) {
          forceAtlas2.assign(
            graph,
            {
              iterations: 100,
              settings:
                forceAtlas2.inferSettings(
                  graph,
                ),
            },
          );
        }

        graphRef.current =
          graph;

        if (
          !containerRef.current
        ) {
          return;
        }

        renderer = new Sigma(
          graph,
          containerRef.current,
          {
            renderEdgeLabels:
              true,
            zIndex: true,
          },
        );

        sigmaRef.current =
          renderer;

        renderer.on(
          'clickNode',
          ({ node }) => {
            selectNode(node);
          },
        );

        renderer.on(
          'clickStage',
          () => {
            selectNode(null);
          },
        );

        renderer.on(
          'enterNode',
          () => {
            if (
              containerRef.current
            ) {
              containerRef.current.style.cursor =
                'pointer';
            }
          },
        );

        renderer.on(
          'leaveNode',
          () => {
            if (
              containerRef.current
            ) {
              containerRef.current.style.cursor =
                'default';
            }
          },
        );

        setMeta(data.meta);
        setError(null);

        setTimeout(
          () =>
            applyGraphView(
              null,
            ),
          0,
        );
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

      sigmaRef.current =
        null;

      graphRef.current =
        null;
    };
  }, [
    refreshKey,
    reloadKey,
    colorMode,
    categoryFilter,
    interestFilter,
    minImportance,
  ]);

  return (
    <main
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        fontFamily: 'sans-serif',
      }}
    >
      <section
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 18px',
            borderBottom:
              '1px solid #ddd',
          }}
        >
          <strong>
            Personal Network Graph
          </strong>

          <span>
            People: {meta.nodeCount}
          </span>

          <span>
            Visible: {visibleCount}
          </span>

          <span>
            Relationships:{' '}
            {meta.edgeCount}
          </span>

          <button
            type="button"
            onClick={() =>
              setReloadKey(
                (value) =>
                  value + 1,
              )
            }
          >
            Refresh
          </button>

          <label>
            Color:{' '}
            <select
              value={colorMode}
              onChange={(event) => {
                setSelectedNode(null);

                setColorMode(
                  event.target
                    .value as ColorMode,
                );
              }}
            >
              <option value="category">
                Category
              </option>

              <option value="community">
                Community
              </option>
            </select>
          </label>

          <select
            value={categoryFilter}
            onChange={(event) => {
              setSelectedNode(null);
              setCategoryFilter(
                event.target.value,
              );
            }}
          >
            <option value="">
              All categories
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ),
            )}
          </select>

          <select
            value={interestFilter}
            onChange={(event) => {
              setSelectedNode(null);
              setInterestFilter(
                event.target.value,
              );
            }}
          >
            <option value="">
              All interests
            </option>

            {interests.map(
              (interest) => (
                <option
                  key={interest.id}
                  value={interest.id}
                >
                  {interest.name}
                </option>
              ),
            )}
          </select>

          <label>
            Importance ≥{' '}
            <select
              value={minImportance}
              onChange={(event) => {
                setSelectedNode(
                  null,
                );

                setMinImportance(
                  Number(
                    event.target
                      .value,
                  ),
                );
              }}
            >
              <option value={1}>
                1
              </option>
              <option value={2}>
                2
              </option>
              <option value={3}>
                3
              </option>
              <option value={4}>
                4
              </option>
              <option value={5}>
                5
              </option>
            </select>
          </label>

          <button
            type="button"
            onClick={resetFilters}
          >
            Reset filters
          </button>

          <form
            onSubmit={
              handleSearchSubmit
            }
            style={{
              marginLeft: 'auto',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search person..."
              style={{
                width: '220px',
                padding: '7px',
              }}
            />

            <button type="submit">
              Find
            </button>
          </form>
        </header>

        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            padding: '8px 18px',
            borderBottom:
              '1px solid #eee',
            fontSize: '13px',
          }}
        >
          <strong>
            {colorMode === 'category'
              ? 'Category legend:'
              : 'Community legend:'}
          </strong>

          {colorMode === 'category' ? (
            <>
              <span>
                <span
                  style={{
                    display:
                      'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius:
                      '50%',
                    background:
                      '#64748b',
                    marginRight:
                      '5px',
                  }}
                />
                No category
              </span>

              {categories.map(
                (category) => (
                  <span
                    key={category.id}
                  >
                    <span
                      style={{
                        display:
                          'inline-block',
                        width:
                          '10px',
                        height:
                          '10px',
                        borderRadius:
                          '50%',
                        background:
                          categoryColor(
                            category.name,
                          ),
                        marginRight:
                          '5px',
                      }}
                    />

                    {category.name}
                  </span>
                ),
              )}
            </>
          ) : (
            <>
              {communityIds.length ? (
                communityIds.map(
                  (communityId) => (
                    <span
                      key={
                        communityId
                      }
                    >
                      <span
                        style={{
                          display:
                            'inline-block',
                          width:
                            '10px',
                          height:
                            '10px',
                          borderRadius:
                            '50%',
                          background:
                            communityColor(
                              communityId,
                            ),
                          marginRight:
                            '5px',
                        }}
                      />

                      Community{' '}
                      {communityId}
                    </span>
                  ),
                )
              ) : (
                <span>
                  No community data
                </span>
              )}

              <span>
                Cluster hub =
                +4 node size
              </span>

              <span>
                Inter-cluster bridge =
                +2 node size
              </span>
            </>
          )}

          <span>
            Node size =
            importance
            {colorMode ===
              'community'
              ? ' + analytics role'
              : ''}
          </span>        </div>

        {error ? (
          <div
            style={{
              padding: '20px',
            }}
          >
            {error}
          </div>
        ) : (
          <div
            ref={containerRef}
            style={{
              flex: 1,
              minHeight: 0,
              width: '100%',
            }}
          />
        )}
      </section>

      {selectedNode && (
        <aside
          style={{
            width: '320px',
            flexShrink: 0,
            padding: '24px',
            borderLeft:
              '1px solid #ddd',
            overflowY: 'auto',
          }}
        >
          <h2>
            {selectedNode.label}
          </h2>

          {selectedNode.nickname && (
            <p>
              Nickname:{' '}
              {
                selectedNode.nickname
              }
            </p>
          )}

          {selectedNode.company && (
            <p>
              Company:{' '}
              {
                selectedNode.company
              }
            </p>
          )}

          {selectedNode.position && (
            <p>
              Position:{' '}
              {
                selectedNode.position
              }
            </p>
          )}

          {(
            selectedNode.city ||
            selectedNode.country
          ) && (
            <p>
              Location:{' '}
              {[
                selectedNode.city,
                selectedNode.country,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}

          <p>
            Importance:{' '}
            {
              selectedNode.importance
            }
            /5
          </p>

          <h3>Categories</h3>

          {selectedNode
            .categories.length ? (
            <ul>
              {selectedNode.categories.map(
                (category) => (
                  <li
                    key={
                      category.id
                    }
                  >
                    {
                      category.name
                    }
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p>None</p>
          )}

          <h3>Interests</h3>

          {selectedNode
            .interests.length ? (
            <ul>
              {selectedNode.interests.map(
                (interest) => (
                  <li
                    key={
                      interest.id
                    }
                  >
                    {
                      interest.name
                    }
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p>None</p>
          )}

          <button
            type="button"
            onClick={() =>
              selectNode(null)
            }
          >
            Close
          </button>
        </aside>
      )}
    </main>
  );
}
