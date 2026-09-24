import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GraphService {
  constructor(private readonly prisma: PrismaService) {}

  async getGraph() {
    const [people, relationships] = await Promise.all([
      this.prisma.person.findMany({
        include: {
          categories: {
            include: {
              category: true,
            },
          },
          interests: {
            include: {
              interest: true,
            },
          },
        },
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

    const nodes = people.map((person) => ({
      id: person.id,
      label:
        [person.firstName, person.lastName]
          .filter(Boolean)
          .join(' ') || person.nickname || person.id,

      firstName: person.firstName,
      lastName: person.lastName,
      nickname: person.nickname,
      company: person.company,
      position: person.position,
      city: person.city,
      country: person.country,
      importance: person.importance,

      categories: person.categories.map((item) => ({
        id: item.category.id,
        name: item.category.name,
      })),

      interests: person.interests.map((item) => ({
        id: item.interest.id,
        name: item.interest.name,
      })),
    }));

    const edges = relationships.map((relationship) => ({
      id: relationship.id,
      source: relationship.fromId,
      target: relationship.toId,
      type: relationship.type,
      strength: relationship.strength,
      notes: relationship.notes,
      visualColor:
        relationship.visualColor,
      visualWidth:
        relationship.visualWidth,
    }));

    return {
      nodes,
      edges,
      meta: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      },
    };
  }
}
