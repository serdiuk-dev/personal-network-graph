import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import Graph from 'graphology';
import Sigma from 'sigma';
import EdgeCurveProgram from '@sigma/edge-curve';

type TaxonomyItem = {
  id: string;
  name: string;
};

import { PRODIGY_LIGHT_THEME } from '../graph/graphTheme';
import {
  DEFAULT_GRAPH_STYLES,
  type GraphStyleSettings,
} from './GraphStyleManager';

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
  networkCircle: 'INNER' | 'MIDDLE' | 'OUTER';
  primaryTag: string | null;
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
  visualColor: string | null;
  visualWidth: number | null;
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
  '#0ea5e9',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
  '#2dd4bf',
  '#60a5fa',
  '#38bdf8',
  '#5eead4',
  '#818cf8',
  '#22d3ee',
  '#0891b2',
  '#0f766e',
];

const COMMUNITY_COLORS = [
  '#2563eb',
  '#0891b2',
  '#14b8a6',
  '#6366f1',
  '#0ea5e9',
  '#0f766e',
  '#3b82f6',
  '#06b6d4',
  '#4f46e5',
  '#2dd4bf',
  '#0284c7',
  '#5b8def',
];

function communityColor(
  communityId: number | undefined,
) {
  if (communityId === undefined) {
    return PRODIGY_LIGHT_THEME.text.muted;
  }

  return COMMUNITY_COLORS[
    Math.abs(communityId) %
      COMMUNITY_COLORS.length
  ];
}

function categoryColor(name: string | null) {
  if (!name) {
    return PRODIGY_LIGHT_THEME.text.muted;
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


function primaryTagLabel(
  node: GraphNode,
) {
  const explicit =
    node.primaryTag?.trim();

  if (explicit) {
    return explicit;
  }

  const category =
    primaryCategory(node);

  if (category) {
    return category;
  }

  if (node.interests.length === 0) {
    return null;
  }

  return [...node.interests]
    .sort((a, b) =>
      a.name.localeCompare(b.name),
    )[0].name;
}

function personDisplayLabel(
  node: GraphNode,
) {
  const tag =
    primaryTagLabel(node);

  return tag
    ? `${node.label}  ·  ${tag}`
    : node.label;
}

type NetworkCircle =
  | 'INNER'
  | 'MIDDLE'
  | 'OUTER';

const SELF_NODE_ID =
  '__PNET_SELF__';

const SELF_EDGE_PREFIX =
  '__PNET_SELF_EDGE__:';

function normalizeNetworkCircle(
  node: GraphNode,
): NetworkCircle {
  return node.networkCircle ?? 'MIDDLE';
}

function circleLabel(
  circle: NetworkCircle,
) {
  switch (circle) {
    case 'INNER':
      return 'Inner — close circle';
    case 'OUTER':
      return 'Outer — distant circle';
    default:
      return 'Middle — regular circle';
  }
}

function edgeCurvature(
  key: string,
  circle: NetworkCircle = 'MIDDLE',
  relationship = false,
) {
  let hash = 0;

  for (
    let index = 0;
    index < key.length;
    index += 1
  ) {
    hash =
      (
        hash * 31 +
        key.charCodeAt(index)
      ) >>> 0;
  }

  const circleBase: Record<
    NetworkCircle,
    number
  > = {
    INNER: 0.10,
    MIDDLE: 0.14,
    OUTER: 0.18,
  };

  const base =
    relationship
      ? 0.18
      : circleBase[circle];

  return (
    base +
    (hash % 5) * 0.018
  );
}

function softenHexColor(
  color: string,
  mixToWhite: number,
) {
  const match =
    /^#([0-9a-f]{6})$/i.exec(
      color,
    );

  if (!match) {
    return color;
  }

  const value =
    Number.parseInt(
      match[1],
      16,
    );

  const source = [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ];

  const result =
    source.map((channel) =>
      Math.round(
        channel +
        (255 - channel) *
          mixToWhite,
      ),
    );

  return `#${result
    .map((channel) =>
      channel
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function displayEdgeWidth(
  rawWidth: number,
  focused = false,
) {
  const bounded =
    Math.max(
      0.25,
      Math.min(
        8,
        Number(rawWidth) || 0.25,
      ),
    );

  return focused
    ? 0.9 + bounded * 0.42
    : 0.28 + bounded * 0.225;
}

function egoStyleForCircle(
  styles: GraphStyleSettings,
  circle: NetworkCircle,
) {
  switch (circle) {
    case 'INNER':
      return {
        color: styles.innerEgoColor,
        opacity: styles.innerEgoOpacity,
        width: styles.innerEgoWidth,
      };

    case 'OUTER':
      return {
        color: styles.outerEgoColor,
        opacity: styles.outerEgoOpacity,
        width: styles.outerEgoWidth,
      };

    default:
      return {
        color: styles.middleEgoColor,
        opacity: styles.middleEgoOpacity,
        width: styles.middleEgoWidth,
      };
  }
}

function ringStyleForCircle(
  styles: GraphStyleSettings,
  circle: NetworkCircle,
) {
  switch (circle) {
    case 'INNER':
      return {
        color: styles.innerRingColor,
        opacity: styles.innerRingOpacity,
        width: styles.innerRingWidth,
      };

    case 'OUTER':
      return {
        color: styles.outerRingColor,
        opacity: styles.outerRingOpacity,
        width: styles.outerRingWidth,
      };

    default:
      return {
        color: styles.middleRingColor,
        opacity: styles.middleRingOpacity,
        width: styles.middleRingWidth,
      };
  }
}

function hexToRgba(
  color: string,
  opacity: number,
) {
  const match =
    /^#([0-9a-f]{6})$/i.exec(
      color,
    );

  if (!match) {
    return color;
  }

  const value =
    Number.parseInt(
      match[1],
      16,
    );

  const red =
    (value >> 16) & 255;

  const green =
    (value >> 8) & 255;

  const blue =
    value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${Math.max(
    0,
    Math.min(
      1,
      opacity,
    ),
  )})`;
}

function installProdigyVisualLayer(
  renderer: Sigma,
  container: HTMLDivElement,
  styles: GraphStyleSettings,
) {
  container.style.position =
    'relative';

  container.style.overflow =
    'hidden';

  const guidesLayer =
    document.createElement('div');

  Object.assign(
    guidesLayer.style,
    {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
    },
  );

  const circleNames: Record<
    NetworkCircle,
    string
  > = {
    INNER: 'CLOSE',
    MIDDLE: 'REGULAR',
    OUTER: 'DISTANT',
  };

  const rings =
    (
      [
        'OUTER',
        'MIDDLE',
        'INNER',
      ] as NetworkCircle[]
    ).map((circle) => {
      const ring =
        document.createElement('div');

      const ringStyle =
        ringStyleForCircle(
          styles,
          circle,
        );

      Object.assign(
        ring.style,
        {
          position: 'absolute',
          borderRadius: '50%',
          border:
            `${ringStyle.width}px solid ${hexToRgba(
              ringStyle.color,
              ringStyle.opacity,
            )}`,
          transform:
            'translate(-50%, -50%)',
          boxSizing: 'border-box',
        },
      );

      if (circle === 'OUTER') {
        ring.style.background =
          'radial-gradient(circle, rgba(37,99,235,0.018) 0%, rgba(20,184,166,0.012) 48%, rgba(255,255,255,0) 72%)';
      }

      const label =
        document.createElement('span');

      label.textContent =
        circleNames[circle];

      Object.assign(
        label.style,
        {
          position: 'absolute',
          left: '50%',
          top: '-8px',
          transform:
            'translate(-50%, -100%)',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
          fontSize: '9px',
          fontWeight: '600',
          letterSpacing: '0.18em',
          color:
            hexToRgba(
              ringStyle.color,
              Math.min(
                1,
                ringStyle.opacity + 0.18,
              ),
            ),
          whiteSpace: 'nowrap',
        },
      );

      ring.appendChild(label);
      guidesLayer.appendChild(ring);

      return {
        circle,
        ring,
      };
    });

  container.insertBefore(
    guidesLayer,
    container.firstChild,
  );

  const hubLayer =
    document.createElement('div');

  Object.assign(
    hubLayer.style,
    {
      position: 'absolute',
      inset: '0',
      pointerEvents: 'none',
      overflow: 'hidden',
    },
  );

  const hub =
    document.createElement('div');

  Object.assign(
    hub.style,
    {
      position: 'absolute',
      width: '92px',
      height: '92px',
      borderRadius: '50%',
      transform:
        'translate(-50%, -50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',

      background:
        'linear-gradient(135deg, #2563eb 0%, #0ea5e9 42%, #18c7bd 100%)',

      color: '#ffffff',
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
      fontWeight: '700',
      fontSize: '18px',
      letterSpacing: '0.08em',

      border:
        '1px solid rgba(255,255,255,0.82)',

      boxShadow:
        [
          '0 0 0 8px rgba(14,165,233,0.055)',
          '0 0 0 18px rgba(24,199,189,0.028)',
          '0 12px 36px rgba(37,99,235,0.16)',
          '0 0 54px rgba(14,165,233,0.13)',
        ].join(', '),
    },
  );

  hub.textContent = 'Я';

  hubLayer.appendChild(hub);
  container.appendChild(hubLayer);

  const update = () => {
    const center =
      renderer.graphToViewport({
        x: 0,
        y: 0,
      });

    hub.style.left =
      `${center.x}px`;

    hub.style.top =
      `${center.y}px`;

    rings.forEach(
      ({ circle, ring }) => {
        const radius =
          PRODIGY_LIGHT_THEME.radial
            .radii[circle];

        const point =
          renderer.graphToViewport({
            x: radius,
            y: 0,
          });

        const radiusPx =
          Math.hypot(
            point.x - center.x,
            point.y - center.y,
          );

        const diameter =
          radiusPx * 2;

        ring.style.left =
          `${center.x}px`;

        ring.style.top =
          `${center.y}px`;

        ring.style.width =
          `${diameter}px`;

        ring.style.height =
          `${diameter}px`;
      },
    );
  };

  renderer.on(
    'afterRender',
    update,
  );

  requestAnimationFrame(update);

  return () => {
    renderer.off(
      'afterRender',
      update,
    );

    guidesLayer.remove();
    hubLayer.remove();
  };
}

function buildRadialPositions(
  nodes: GraphNode[],
) {
  const groups: Record<
    NetworkCircle,
    GraphNode[]
  > = {
    INNER: [],
    MIDDLE: [],
    OUTER: [],
  };

  nodes.forEach((node) => {
    groups[
      normalizeNetworkCircle(node)
    ].push(node);
  });

  const circles: NetworkCircle[] = [
    'INNER',
    'MIDDLE',
    'OUTER',
  ];

  const angleOffsets: Record<
    NetworkCircle,
    number
  > = {
    INNER: -Math.PI / 2,
    MIDDLE: -Math.PI / 2 + Math.PI / 5,
    OUTER: -Math.PI / 2 + Math.PI / 10,
  };

  const result =
    new Map<
      string,
      { x: number; y: number }
    >();

  circles.forEach((circle) => {
    const group = [...groups[circle]].sort(
      (a, b) =>
        b.importance - a.importance ||
        a.label.localeCompare(b.label),
    );

    const goldenAngle =
      Math.PI *
      (3 - Math.sqrt(5));

    group.forEach((node, index) => {
      const angle =
        angleOffsets[circle] +
        index * goldenAngle;

      const radius =
        PRODIGY_LIGHT_THEME.radial
          .radii[circle];

      result.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      });
    });
  });

  return result;
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

  const graphStyleRef =
    useRef<GraphStyleSettings>({
      ...DEFAULT_GRAPH_STYLES,
    });

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

  const [showEdgeLabels, setShowEdgeLabels] =
    useState(false);

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
          if (node === SELF_NODE_ID) {
            return {
              ...data,
              hidden: false,
              label: '',
              color:
                PRODIGY_LIGHT_THEME.radial
                  .selfColor,
              size:
                PRODIGY_LIGHT_THEME.radial
                  .selfSize,
              highlighted: true,
              zIndex: 4,
            };
          }

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
            analyticsRef.current.get(node);

          const color =
            colorMode === 'community'
              ? communityColor(
                  analytics?.communityId,
                )
              : categoryColor(
                  primaryCategory(person),
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
                  (
                    isClusterHub
                      ? PRODIGY_LIGHT_THEME.node
                          .clusterHubBonus
                      : 0
                  ) +
                  (
                    isInterClusterBridge
                      ? PRODIGY_LIGHT_THEME.node
                          .interClusterBridgeBonus
                      : 0
                  )
                )
              : 0;

          const nodeSize =
            PRODIGY_LIGHT_THEME.node.baseSize +
            person.importance *
              PRODIGY_LIGHT_THEME.node
                .importanceStep +
            roleSizeBonus;

          const displayLabel =
            personDisplayLabel(
              person,
            );

          const showOverviewLabel = true;

          /*
           * Overview mode:
           * keep the graph quiet and readable.
           * Labels are shown only for important
           * or analytically significant nodes.
           */
          if (!selectedId) {
            return {
              ...data,
              hidden: false,
              color,
              label:
                showOverviewLabel
                  ? displayLabel
                  : '',
              size: nodeSize,
              highlighted:
                specialRole,
              zIndex:
                specialRole
                  ? PRODIGY_LIGHT_THEME.focus
                      .neighborZIndex
                  : PRODIGY_LIGHT_THEME.focus
                      .inactiveZIndex,
            };
          }

          /*
           * Selected person becomes the
           * visual focal point.
           */
          if (node === selectedId) {
            return {
              ...data,
              hidden: false,
              color:
                PRODIGY_LIGHT_THEME.node
                  .selected,
              label: displayLabel,
              highlighted: true,
              size: Math.max(
                PRODIGY_LIGHT_THEME.node
                  .selectedMinSize,
                nodeSize,
              ),
              zIndex:
                PRODIGY_LIGHT_THEME.focus
                  .selectedZIndex,
            };
          }

          /*
           * Direct neighbors remain saturated
           * and keep their category/community
           * identity.
           */
          if (neighbors.has(node)) {
            return {
              ...data,
              hidden: false,
              color,
              label: displayLabel,
              highlighted: true,
              size: nodeSize,
              zIndex:
                PRODIGY_LIGHT_THEME.focus
                  .neighborZIndex,
            };
          }

          /*
           * Everything else remains present
           * but fades into background depth.
           */
          return {
            ...data,
            hidden: false,
            color:
              PRODIGY_LIGHT_THEME.node
                .inactive,
            label: '',
            zIndex:
              PRODIGY_LIGHT_THEME.focus
                .inactiveZIndex,
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

        const styles =
          graphStyleRef.current;

        const isEgoEdge =
          Boolean(
            graph.getEdgeAttribute(
              edge,
              'isEgo',
            ),
          );

        if (isEgoEdge) {
          const personId =
            source === SELF_NODE_ID
              ? target
              : source;

          if (!visibleIds.has(personId)) {
            return {
              ...data,
              hidden: true,
            };
          }

          const circle =
            (
              graph.getEdgeAttribute(
                edge,
                'networkCircle',
              ) as NetworkCircle | undefined
            ) ?? 'MIDDLE';

          const egoStyle =
            egoStyleForCircle(
              styles,
              circle,
            );

          if (!selectedId) {
            return {
              ...data,
              hidden: false,
              label: '',
              color:
                softenHexColor(
                  egoStyle.color,
                  1 -
                    egoStyle.opacity,
                ),
              size:
                egoStyle.width,
              zIndex: 0,
            };
          }

          if (personId === selectedId) {
            return {
              ...data,
              hidden: false,
              label: '',
              color:
                softenHexColor(
                  egoStyle.color,
                  1 -
                    Math.min(
                      1,
                      egoStyle.opacity +
                        0.20,
                    ),
                ),
              size:
                Math.max(
                  egoStyle.width * 1.7,
                  0.8,
                ),
              zIndex: 1,
            };
          }

          return {
            ...data,
            hidden: false,
            label: '',
            color:
              softenHexColor(
                egoStyle.color,
                1 -
                  egoStyle.opacity *
                    0.55,
              ),
            size:
              Math.max(
                egoStyle.width * 0.55,
                0.2,
              ),
            zIndex: 0,
          };
        }

        if (
          !visibleIds.has(source) ||
          !visibleIds.has(target)
        ) {
          return {
            ...data,
            hidden: true,
          };
        }

        const visualColor =
          graph.getEdgeAttribute(
            edge,
            'visualColor',
          ) as string | null | undefined;

        const visualWidth =
          graph.getEdgeAttribute(
            edge,
            'visualWidth',
          ) as number | null | undefined;

        const baseSize =
          Number(
            visualWidth ??
              data.size ??
              PRODIGY_LIGHT_THEME.edge
                .defaultWidth,
          );

        if (!selectedId) {
          const overviewColor =
            visualColor ??
            styles
              .relationshipDefaultColor;

          return {
            ...data,
            hidden: false,
            color:
              softenHexColor(
                overviewColor,
                1 -
                  styles
                    .relationshipDefaultOpacity,
              ),
            size:
              displayEdgeWidth(
                baseSize,
                false,
              ) *
              styles
                .relationshipDefaultWidthScale,
            zIndex: 0,
          };
        }

        const isActiveRelationship =
          source === selectedId ||
          target === selectedId;

        if (isActiveRelationship) {
          const activeColor =
            visualColor ??
            styles
              .relationshipFocusColor;

          const activeWidth =
            visualWidth ??
            Math.max(
              baseSize,
              PRODIGY_LIGHT_THEME.edge
                .activeWidth,
            );

          return {
            ...data,
            hidden: false,
            color:
              softenHexColor(
                activeColor,
                1 -
                  styles
                    .relationshipFocusOpacity,
              ),
            size:
              displayEdgeWidth(
                activeWidth,
                true,
              ) *
              styles
                .relationshipFocusWidthScale,
            zIndex: 2,
          };
        }

        return {
          ...data,
          hidden: false,
          color:
            softenHexColor(
              styles
                .relationshipInactiveColor,
              1 -
                styles
                  .relationshipInactiveOpacity,
            ),
          label: '',
          size:
            styles
              .relationshipInactiveWidth,
          zIndex: 0,
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

    if (nodeId === SELF_NODE_ID) {
      setSelectedNode(null);
      applyGraphView(null);

      const position =
        renderer.getNodeDisplayData(
          SELF_NODE_ID,
        );

      if (position) {
        renderer
          .getCamera()
          .animate(
            {
              x: position.x,
              y: position.y,
              ratio: 0.85,
            },
            {
              duration:
                PRODIGY_LIGHT_THEME.motion
                  .cameraDurationMs,
            },
          );
      }

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

    let disposeProdigyLayer:
      (() => void) | null =
      null;

    async function loadGraph() {
      try {
        const [
          response,
          analyticsResponse,
          graphStylesResponse,
        ] = await Promise.all([
          fetch('/api/v1/graph'),
          fetch(
            '/api/v1/analytics/network',
          ),
          fetch(
            '/api/v1/graph-styles',
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

        const graphStyles:
          GraphStyleSettings =
          graphStylesResponse.ok
            ? await graphStylesResponse.json()
            : DEFAULT_GRAPH_STYLES;

        graphStyleRef.current = {
          ...DEFAULT_GRAPH_STYLES,
          ...graphStyles,
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

        const positions =
          buildRadialPositions(
            data.nodes,
          );

        /*
         * The ego node is visual/system state only.
         * It is intentionally NOT persisted as Person
         * and therefore does not affect analytics.
         */
        graph.addNode(
          SELF_NODE_ID,
          {
            label: '',
            x: 0,
            y: 0,
            size:
              PRODIGY_LIGHT_THEME.radial
                .selfSize,
            color:
              PRODIGY_LIGHT_THEME.radial
                .selfColor,
            isSelf: true,
          },
        );

        data.nodes.forEach(
          (node) => {
            const circle =
              normalizeNetworkCircle(
                node,
              );

            const position =
              positions.get(node.id) ?? {
                x: 0,
                y: 0,
              };

            graph.addNode(
              node.id,
              {
                label:
                  personDisplayLabel(
                    node,
                  ),
                forceLabel: true,
                x: position.x,
                y: position.y,
                size:
                  PRODIGY_LIGHT_THEME.node
                    .baseSize +
                  node.importance *
                    PRODIGY_LIGHT_THEME.node
                      .importanceStep,
                color:
                  categoryColor(
                    primaryCategory(
                      node,
                    ),
                  ),
                importance:
                  node.importance,
                networkCircle:
                  circle,
              },
            );
          },
        );

        /*
         * Every real contact belongs to the user's
         * ego network, so each Person gets a light
         * visual connection from the fixed SELF node.
         * These edges are not stored in PostgreSQL.
         */
        data.nodes.forEach(
          (node) => {
            const circle =
              normalizeNetworkCircle(
                node,
              );

            graph.addDirectedEdgeWithKey(
              `${SELF_EDGE_PREFIX}${node.id}`,
              SELF_NODE_ID,
              node.id,
              {
                label: '',
                type: 'curved',
                curvature:
                  edgeCurvature(
                    node.id,
                    circle,
                  ),
                isEgo: true,
                networkCircle:
                  circle,
                color:
                  PRODIGY_LIGHT_THEME.radial
                    .edgeColors[circle],
                size:
                  PRODIGY_LIGHT_THEME.radial
                    .edgeWidths[circle],
                weight: 1,
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
              const strength =
                Math.max(
                  1,
                  edge.strength,
                );

              const automaticWidth =
                PRODIGY_LIGHT_THEME.edge
                  .defaultWidth +
                Math.min(
                  (
                    strength - 1
                  ) *
                    PRODIGY_LIGHT_THEME.edge
                      .strengthWidthStep,
                  PRODIGY_LIGHT_THEME.edge
                    .maxStrengthWidthBonus,
                );

              graph.addDirectedEdgeWithKey(
                edge.id,
                edge.source,
                edge.target,
                {
                  label:
                    edge.type ??
                    undefined,

                  type: 'curved',

                  curvature:
                    edgeCurvature(
                      edge.id,
                      'MIDDLE',
                      true,
                    ),

                  size:
                    edge.visualWidth ??
                    automaticWidth,

                  color:
                    edge.visualColor ??
                    PRODIGY_LIGHT_THEME.edge
                      .default,

                  visualColor:
                    edge.visualColor,

                  visualWidth:
                    edge.visualWidth,

                  weight:
                    strength,
                },
              );
            }
          },
        );

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
              showEdgeLabels,

            edgeProgramClasses: {
              curved:
                EdgeCurveProgram,
            },

            defaultEdgeType:
              'curved',

            labelFont:
              'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',

            labelSize: 14,

            labelRenderedSizeThreshold:
              0,

            labelWeight: '600',

            labelColor: {
              color:
                PRODIGY_LIGHT_THEME.text
                  .primary,
            },

            zIndex: true,
          },
        );

        sigmaRef.current =
          renderer;

        disposeProdigyLayer =
          installProdigyVisualLayer(
            renderer,
            containerRef.current,
            graphStyleRef.current,
          );

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
      disposeProdigyLayer?.();
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
    showEdgeLabels,
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

          <label>
            <input
              type="checkbox"
              checked={showEdgeLabels}
              onChange={(event) =>
                setShowEdgeLabels(
                  event.target.checked,
                )
              }
            />{' '}
            Edge labels
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
                Cluster hub = larger node
                {' (+'}
                {PRODIGY_LIGHT_THEME.node
                  .clusterHubBonus}
                {')'}
              </span>

              <span>
                Inter-cluster bridge = larger node
                {' (+'}
                {PRODIGY_LIGHT_THEME.node
                  .interClusterBridgeBonus}
                {')'}
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
              background:
                PRODIGY_LIGHT_THEME.canvas.background,
              flex: 1,
              minHeight: 0,
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
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

          <p
            style={{
              color:
                PRODIGY_LIGHT_THEME.text
                  .secondary,
            }}
          >
            Network circle:{' '}
            {circleLabel(
              normalizeNetworkCircle(
                selectedNode,
              ),
            )}
          </p>

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
