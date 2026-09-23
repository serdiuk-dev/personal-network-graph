import { Injectable } from '@nestjs/common';
import { UndirectedGraph } from 'graphology';
const louvain: typeof import('graphology-communities-louvain').default =
  require('graphology-communities-louvain');

import betweennessCentrality from 'graphology-metrics/centrality/betweenness';
import { weightedDegree } from 'graphology-metrics/node/weighted-degree';

import { PrismaService } from '../prisma.service';

type Role =
  | 'connector'
  | 'bridge'
  | 'hub';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private round(value: number) {
    return Number(value.toFixed(6));
  }

  async getNetworkAnalytics() {
    const [people, relationships] =
      await Promise.all([
        this.prisma.person.findMany({
          orderBy: {
            createdAt: 'asc',
          },
        }),

        this.prisma.relationship.findMany({
          orderBy: {
            createdAt: 'asc',
          },
        }),
      ]);

    const graph = new UndirectedGraph({
      allowSelfLoops: false,
    });

    people.forEach((person) => {
      graph.addNode(person.id, {
        label: [
          person.firstName,
          person.lastName,
        ]
          .filter(Boolean)
          .join(' '),
      });
    });

    /*
     * Analytics treats relationships as undirected topology.
     *
     * If A -> B and B -> A both exist in PostgreSQL,
     * they become one analytical connection.
     *
     * For that connection we keep the strongest strength.
     */
    const analyticalEdges = new Map<
      string,
      {
        source: string;
        target: string;
        strength: number;
      }
    >();

    relationships.forEach(
      (relationship) => {
        if (
          !graph.hasNode(
            relationship.fromId,
          ) ||
          !graph.hasNode(
            relationship.toId,
          ) ||
          relationship.fromId ===
            relationship.toId
        ) {
          return;
        }

        const pair = [
          relationship.fromId,
          relationship.toId,
        ].sort();

        const key =
          `${pair[0]}::${pair[1]}`;

        const current =
          analyticalEdges.get(key);

        if (
          !current ||
          relationship.strength >
            current.strength
        ) {
          analyticalEdges.set(
            key,
            {
              source: pair[0],
              target: pair[1],
              strength:
                relationship.strength,
            },
          );
        }
      },
    );

    analyticalEdges.forEach(
      (edge, key) => {
        graph.addEdgeWithKey(
          key,
          edge.source,
          edge.target,
          {
            strength:
              Math.max(
                1,
                edge.strength,
              ),
          },
        );
      },
    );

    /*
     * Community detection uses weighted Louvain.
     *
     * Relationship strength is used as the edge weight.
     * randomWalk=false keeps results deterministic for an unchanged graph.
     *
     * A graph without edges is handled explicitly because every isolated
     * person forms a standalone community and modularity is defined here as 0.
     */
    const communityResult =
      graph.order === 0
        ? {
            communities: {} as Record<
              string,
              number
            >,
            count: 0,
            modularity: 0,
          }
        : graph.size === 0
          ? {
              communities:
                Object.fromEntries(
                  graph
                    .nodes()
                    .map(
                      (
                        id,
                        index,
                      ) => [
                        id,
                        index,
                      ],
                    ),
                ) as Record<
                  string,
                  number
                >,
              count:
                graph.order,
              modularity: 0,
            }
          : louvain.detailed(
              graph,
              {
                getEdgeWeight:
                  'strength',
                randomWalk:
                  false,
              },
            );

    const communityPartition =
      communityResult.communities;

    const betweennessScores =
      graph.order > 2
        ? betweennessCentrality(
            graph,
            {
              normalized: true,

              /*
               * strength = closeness.
               * Shortest-path algorithms need distance,
               * therefore distance = 1 / strength.
               */
              getEdgeWeight: (
                _edge,
                attributes,
              ) =>
                1 /
                Math.max(
                  1,
                  Number(
                    attributes
                      .strength ??
                      1,
                  ),
                ),
            },
          )
        : Object.fromEntries(
            graph
              .nodes()
              .map((id) => [
                id,
                0,
              ]),
          );

    const rawMetrics =
      people.map((person) => {
        const degree =
          graph.degree(
            person.id,
          );

        const strengthDegree =
          weightedDegree(
            graph,
            person.id,
            (
              _edge,
              attributes,
            ) =>
              Number(
                attributes
                  .strength ??
                  1,
              ),
          );

        const betweenness =
          betweennessScores[
            person.id
          ] ?? 0;

        return {
          id: person.id,

          label: [
            person.firstName,
            person.lastName,
          ]
            .filter(Boolean)
            .join(' '),

          degree,
          weightedDegree:
            strengthDegree,
          betweenness,

          communityId:
            communityPartition[
              person.id
            ] ?? 0,
        };
      });

    const maxDegree =
      Math.max(
        0,
        ...rawMetrics.map(
          (item) =>
            item.degree,
        ),
      );

    const maxWeightedDegree =
      Math.max(
        0,
        ...rawMetrics.map(
          (item) =>
            item.weightedDegree,
        ),
      );

    const maxBetweenness =
      Math.max(
        0,
        ...rawMetrics.map(
          (item) =>
            item.betweenness,
        ),
      );

    const nodes =
      rawMetrics.map(
        (item) => {
          const roles: Role[] =
            [];

          const explanations: string[] =
            [];

          const degreeRatio =
            maxDegree > 0
              ? item.degree /
                maxDegree
              : 0;

          const weightedRatio =
            maxWeightedDegree >
            0
              ? item.weightedDegree /
                maxWeightedDegree
              : 0;

          const bridgeRatio =
            maxBetweenness > 0
              ? item.betweenness /
                maxBetweenness
              : 0;

          if (
            item.degree >= 2 &&
            degreeRatio >= 0.6
          ) {
            roles.push(
              'connector',
            );

            explanations.push(
              'High number of direct network connections.',
            );
          }

          if (
            item.betweenness >
              0 &&
            bridgeRatio >= 0.6
          ) {
            roles.push(
              'bridge',
            );

            explanations.push(
              'Frequently lies on shortest paths between other people.',
            );
          }

          if (
            item.degree >= 2 &&
            weightedRatio >=
              0.6
          ) {
            roles.push('hub');

            explanations.push(
              'High combined relationship strength.',
            );
          }

          return {
            id: item.id,
            label: item.label,

            communityId:
              item.communityId,

            metrics: {
              degree:
                item.degree,

              weightedDegree:
                this.round(
                  item.weightedDegree,
                ),

              betweenness:
                this.round(
                  item.betweenness,
                ),
            },

            roles,

            explanation:
              explanations,
          };
        },
      );

    const density =
      graph.order > 1
        ? (2 * graph.size) /
          (graph.order *
            (graph.order - 1))
        : 0;

    const communityMembers =
      new Map<
        number,
        Array<{
          id: string;
          label: string;
        }>
      >();

    nodes.forEach((node) => {
      const members =
        communityMembers.get(
          node.communityId,
        ) ?? [];

      members.push({
        id: node.id,
        label: node.label,
      });

      communityMembers.set(
        node.communityId,
        members,
      );
    });

    const communities =
      Array.from(
        communityMembers.entries(),
      )
        .map(
          ([
            id,
            members,
          ]) => ({
            id,
            size:
              members.length,
            members,
          }),
        )
        .sort(
          (a, b) =>
            b.size - a.size ||
            a.id - b.id,
        );

    return {
      meta: {
        nodeCount:
          graph.order,

        edgeCount:
          graph.size,

        density:
          this.round(
            density,
          ),

        communityCount:
          communityResult.count,

        modularity:
          this.round(
            communityResult.modularity,
          ),

        communityAlgorithm:
          'louvain',

        analyticalModel:
          'undirected',

        roleMethod:
          'relative explainable heuristics',
      },

      nodes,

      communities,

      rankings: {
        connectors: [
          ...nodes,
        ]
          .sort(
            (a, b) =>
              b.metrics.degree -
              a.metrics.degree,
          )
          .slice(0, 10),

        strongestNetworks: [
          ...nodes,
        ]
          .sort(
            (a, b) =>
              b.metrics
                .weightedDegree -
              a.metrics
                .weightedDegree,
          )
          .slice(0, 10),

        bridges: [
          ...nodes,
        ]
          .sort(
            (a, b) =>
              b.metrics
                .betweenness -
              a.metrics
                .betweenness,
          )
          .slice(0, 10),
      },
    };
  }
}
