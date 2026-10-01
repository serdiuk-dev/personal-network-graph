import { Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PHOTO_BYTES, PersonMediaService } from './person-media.service';

// The global AuthGuard applies to every route, including GET. Mutations require
// the existing owner session, exact Origin and X-Pnet-CSRF. No static directory.
@Controller('people/:id/photo')
export class PersonMediaController {
  constructor(private readonly media: PersonMediaService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store, max-age=0')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cross-Origin-Resource-Policy', 'same-origin')
  get(@Param('id', new ParseUUIDPipe()) id: string) { return this.media.get(id); }

  @Post()
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 0, parts: 1 },
  }))
  upload(@Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file?: { buffer: Buffer; size: number }) {
    return this.media.upload(id, file);
  }

  @Delete()
  remove(@Param('id', new ParseUUIDPipe()) id: string) { return this.media.remove(id); }
}
