import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException, StreamableFile, UnsupportedMediaTypeException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
// sharp exposes a CJS callable and ESM default types under legacy TS resolution.
const sharp: typeof import('sharp').default = require('sharp');
import { PrismaService } from '../prisma.service';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 25_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Re-encode only raster images. Never give SVG or arbitrary input to a decoder.
export function rasterFormat(bytes: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

@Injectable()
export class PersonMediaService {
  private readonly logger = new Logger(PersonMediaService.name);
  private readonly directory = process.env.PNET_MEDIA_DIR || '/app/private-media';
  private processing = 0;

  constructor(private readonly prisma: PrismaService) {
    if (!isAbsolute(this.directory)) throw new Error('PNET_MEDIA_DIR must be absolute');
  }

  private path(id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Invalid person ID');
    return join(this.directory, `${id}.webp`);
  }

  // Row locks serialize upload, removal and contact deletion across API processes.
  // Decoding happens before acquiring the row lock, keeping DB transactions short.
  private async withPerson<T>(id: string, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    this.path(id);
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Person" WHERE "id" = ${id} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('Person not found');
      return action(tx);
    }, { maxWait: 5000, timeout: 15000 });
  }

  private async unlinkIfPresent(path: string) {
    try { await unlink(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }

  async get(id: string) {
    const path = this.path(id);
    const person = await this.prisma.person.findUnique({ where: { id }, select: { id: true } });
    if (!person) throw new NotFoundException('Person not found');
    try {
      const bytes = await readFile(path);
      return new StreamableFile(bytes, { type: 'image/webp', disposition: 'inline; filename="contact.webp"', length: bytes.length });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('No photo');
      throw error;
    }
  }

  async upload(id: string, file?: { buffer: Buffer; size: number }) {
    this.path(id);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a JPG, PNG or WebP image');
    if (file.buffer.length > MAX_PHOTO_BYTES) throw new BadRequestException('Image exceeds 5 MB');
    const format = rasterFormat(file.buffer);
    if (!format) throw new UnsupportedMediaTypeException('Only JPG, PNG and WebP images are supported');
    if (this.processing >= 2) throw new ServiceUnavailableException('Image processing is busy. Try again shortly.');
    this.processing++;
    let temporary: string | undefined;
    try {
      let output: Buffer;
      try {
        const decoder = sharp(file.buffer, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
        const metadata = await decoder.metadata();
        if (metadata.format !== format || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
          throw new Error('Invalid raster image');
        }
        output = await decoder.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 }).timeout({ seconds: 10 }).toBuffer();
        // sharp strips EXIF, GPS and other metadata by default. Alpha is retained.
      } catch {
        throw new BadRequestException('Invalid image. Use a non-animated JPG, PNG or WebP up to 25 megapixels.');
      }
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      temporary = join(this.directory, `.${id}.${randomUUID()}.tmp`);
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(output); await handle.sync(); } finally { await handle.close(); }
      await this.withPerson(id, async () => {
        await rename(temporary!, this.path(id));
      });
      temporary = undefined;
      return { hasPhoto: true };
    } finally {
      this.processing--;
      if (temporary) {
        try { await this.unlinkIfPresent(temporary); }
        catch { this.logger.warn('Temporary photo cleanup failed; inspect private media storage.'); }
      }
    }
  }

  async remove(id: string) {
    await this.withPerson(id, async () => this.unlinkIfPresent(this.path(id)));
    return { hasPhoto: false };
  }

  async removePerson(id: string) {
    const person = await this.withPerson(id, tx => tx.person.delete({ where: { id } }));
    // A failed DB deletion must leave the photo intact. Once deleted, every read
    // and upload is rejected, even if a storage fault delays physical cleanup.
    try { await this.unlinkIfPresent(this.path(id)); }
    catch { this.logger.warn('Deleted contact photo cleanup failed; inspect private media storage.'); }
    return person;
  }
}
