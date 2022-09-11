import { Injectable } from '@nestjs/common';
import { Firestore } from './firestore';
import { DATA_MODEL } from '../variables';

@Injectable()
export class User extends Firestore {
  collectionName = DATA_MODEL.USER;
}
