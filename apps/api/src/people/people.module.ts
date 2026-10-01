import { PersonMediaController } from '../person-media/person-media.controller';
import { PersonMediaService } from '../person-media/person-media.service';
import { Module } from '@nestjs/common';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  controllers: [PeopleController, PersonMediaController],
  providers: [PeopleService, PersonMediaService],
})
export class PeopleModule {}
