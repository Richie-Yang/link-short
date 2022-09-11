import { Inject, Injectable } from '@nestjs/common';
import { initializeApp, cert } from 'firebase-admin/app';
import { DocumentData, getFirestore, Query } from 'firebase-admin/firestore';
import { LogUtility } from '../utilities';
import { CONFIG } from '../config';
import { SRV_PROVIDER, DATA_MODEL } from '../variables';

const firestore = require('firebase-admin').firestore;
const initializer =
  CONFIG.NODE_ENV === 'local'
    ? { credential: cert(require('../firebase_service_account.json')) }
    : {};

// initialize firestore
initializeApp(initializer);
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

@Injectable()
export abstract class Firestore {
  @Inject(LogUtility)
  private readonly logUtility: LogUtility;

  abstract collectionName: string;
  private readonly srvProvider = SRV_PROVIDER.FIRESTORE;

  async create(createData: object = {}): Promise<boolean> {
    const logOptions = this.logUtility.getOptions({
      srvProvider: this.srvProvider,
      service: `create-${this.collectionName}`,
    });
    const data = Object.assign(createData, {
      id: this._genRandomCode(12),
      createdAt: Math.round(Date.now() / 1000),
      updatedAt: Math.round(Date.now() / 1000),
    });
    await db.collection(this.collectionName).doc(data.id).set(data);
    // _updateDocSize({ numberOfDocs: 1 });
    this.logUtility.printLog(logOptions);
    return true;
  }

  async update(documentId, updateData = {}) {
    const logOptions = this.logUtility.getOptions({
      srvProvider: this.srvProvider,
      service: `update-${this.collectionName}`,
    });
    const data = Object.assign(updateData, {
      updatedAt: Math.round(Date.now() / 1000),
    });
    await db.doc(`${this.collectionName}/${documentId}`).update(data);
    this.logUtility.printLog(logOptions);
    return true;
  }

  async findAll(
    options = { size: 5, page: 1, order: ['createdAt', 'desc'], where: null },
  ) {
    const result = { size: 0, page: 0, total: 0, pageCount: 0, rows: [] };
    let { size, page, order, where } = Object.assign(
      {
        size: 5,
        page: 1,
        order: ['createdAt', 'desc'],
        where: null,
      },
      options,
    );
    const logOptions = this.logUtility.getOptions({
      srvProvider: this.srvProvider,
      service: `findAll-${this.collectionName}`,
    });

    let allDocs, searchEntries, orderEntries;
    let docRef:
      | FirebaseFirestore.CollectionReference<DocumentData>
      | Query<DocumentData> = db.collection(this.collectionName);
    const inputOrderMap = new Map();

    if (order) {
      orderEntries = Array.isArray(order[0]) ? order : [order];
      for (const entry of orderEntries) {
        const [orderField, orderDirection] = entry;
        inputOrderMap.set(orderField, orderDirection);
      }
    }

    if (where) {
      searchEntries = Array.isArray(where[0]) ? where : [where];
      const orderKeyArray = [];
      for (const entry of searchEntries) {
        const [searchKey, op, searchValue] = entry;
        docRef = await docRef.where(searchKey, op, searchValue);
        if (['==', 'in'].includes(op) || orderKeyArray.includes(searchKey))
          continue;
        docRef = inputOrderMap.has(searchKey)
          ? await docRef.orderBy(searchKey, inputOrderMap.get(searchKey))
          : await docRef.orderBy(searchKey, 'desc');
        inputOrderMap.delete(searchKey);
        orderKeyArray.push(searchKey);
      }
      allDocs = await docRef.get();
    }

    // const allDocSize = where ? allDocs.size : await _getDocSize();
    // if (!allDocSize) return result;
    // result.total = allDocSize;

    if (order) {
      for (const mapKey in inputOrderMap) {
        docRef = await docRef.orderBy(mapKey, inputOrderMap[mapKey]);
      }
    }

    size = size || 5;
    result.size = size;
    docRef = docRef.limit(size);

    page = page || 1;
    result.page = page;
    docRef = docRef.offset(size * (page - 1));

    let docSnap = await docRef.get();
    docSnap.forEach((doc) => {
      result.rows.push(doc.data());
    });
    result.pageCount = Math.ceil(result.total / size);

    this.logUtility.printLog(logOptions);
    return result;
  }

  async findById(documentId: string): Promise<object> {
    const logOptions = this.logUtility.getOptions({
      srvProvider: this.srvProvider,
      service: `findById-${this.collectionName}`,
    });
    const docSnap = await db.doc(`${this.collectionName}/${documentId}`).get();
    this.logUtility.printLog(logOptions);
    return docSnap.data() || {};
  }

  private _genRandomCode(length) {
    const char = '1234567890abcdefghijklmnopqrstuvwxyz';
    let code = '';
    for (let i = 0; i < length; i++) {
      code = code + char[Math.floor(Math.random() * char.length)];
    }
    return code;
  }
}
