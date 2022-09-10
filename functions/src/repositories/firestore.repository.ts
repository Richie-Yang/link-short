import { Injectable, Injectable } from '@nestjs/common';

@Injectable()
export class FirestoreRepository {
  findWhole(collectionName) {
  return async (where = null) => {
    const result = { rows: [] };
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `findWhole-${collectionName}`,
    });

    let docRef = collection;
    if (where) {
      const searchEntries = Array.isArray(where[0]) ? where : [where];
      for (const entry of searchEntries) {
        const [searchKey, op, searchValue] = entry;
        docRef = await (docRef || collection).where(searchKey, op, searchValue);
      }
    } else docRef = collection;

    let allDocs = await docRef.get();
    if (allDocs.empty) return result;
    allDocs.forEach((doc) => result.rows.push(doc.data()));

    LogUtility.printLog(logOptions);
    return result;
  };
}

  findAll(collectionName) {
  return async (
    options = { size: 5, page: 1, order: ['createdAt', 'desc'], where: null }
  ) => {
    const result = { size: 0, page: 0, total: 0, pageCount: 0, rows: [] };
    let { size, page, order, where } = Object.assign(
      {
        size: 5,
        page: 1,
        order: ['createdAt', 'desc'],
        where: null,
      },
      options
    );
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `findAll-${collectionName}`,
    });

    let allDocs, searchEntries, orderEntries;
    let docRef = collection;
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
        docRef = await (docRef || collection).where(searchKey, op, searchValue);
        if (['==', 'in'].includes(op) || orderKeyArray.includes(searchKey))
          continue;
        docRef = inputOrderMap.has(searchKey)
          ? await docRef.orderBy(searchKey, inputOrderMap.get(searchKey))
          : await docRef.orderBy(searchKey, 'desc');
        inputOrderMap.delete(searchKey);
        orderKeyArray.push(searchKey);
      }
      allDocs = await docRef.get();
    } else docRef = collection;

    const allDocSize = where ? allDocs.size : await _getDocSize();
    if (!allDocSize) return result;
    result.total = allDocSize;

    if (order) {
      for (const mapKey in inputOrderMap) {
        docRef = await docRef.orderBy(mapKey, inputOrderMap[mapKey]);
      }
    }

    size = Number.isInteger(parseInt(size)) ? parseInt(size) : 5;
    result.size = size;
    docRef = docRef.limit(size);

    page = Number.isInteger(parseInt(page)) ? parseInt(page) : 1;
    result.page = page;
    docRef = docRef.offset(size * (page - 1));

    let docSnap = await docRef.get();
    docSnap.forEach((doc) => {
      result.rows.push(doc.data());
    });
    result.pageCount = Math.ceil(result.total / size);

    LogUtility.printLog(logOptions);
    return result;
  };
}

/**
 * @param {string} collectionName
 * @returns {}
 */
function findById(collectionName) {
  return async (documentId) => {
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `findById-${collectionName}`,
    });
    const docSnap = await collection.doc(documentId).get();
    LogUtility.printLog(logOptions);
    return docSnap.data() || {};
  };
}

/**
 * @param {string} collectionName
 * @returns {}
 */
function countAll(collectionName) {
  return async () => {
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `countAll-${collectionName}`,
    });
    const docRefs = collection.get();
    LogUtility.printLog(logOptions);
    return docRefs.size;
  };
}

/**
 * @param {string} collectionName
 * @returns {}
 */
function create(collectionName) {
  return async (createData = {}) => {
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `create-${collectionName}`,
    });
    const data = Object.assign(createData, {
      id: _genRandomCode(12),
      createdAt: Math.round(Date.now() / 1000),
      updatedAt: Math.round(Date.now() / 1000),
    });
    await collection.doc(data.id).set(data);
    _updateDocSize({ numberOfDocs: 1 });
    LogUtility.printLog(logOptions);
    return true;
  };
}

/**
 * @param {string} collectionName
 * @returns {}
 */
function update(collectionName) {
  return async (documentId, updateData = {}) => {
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `update-${collectionName}`,
    });
    updateData.updatedAt = Math.round(Date.now() / 1000);
    await collection.doc(documentId).update(updateData);
    LogUtility.printLog(logOptions);
    return true;
  };
}

/**
 * @param {string} collectionName
 * @returns {}
 */
function softDelete(collectionName) {
  return async (documentId) => {
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `softDelete-${collectionName}`,
    });
    updateData.updatedAt = Math.round(Date.now() / 1000);
    await collection.doc(documentId).update({ status: DB_DATA_STATUS.DELETE });
    LogUtility.printLog(logOptions);
    _updateDocSize({ numberOfDeletes: 1 });
    return true;
  };
}

/**
 * @param {string} collectionName
 * @returns {}
 */
function hardDelete(collectionName) {
  return async (documentId) => {
    const { srvProvider, collection } = _getSettings(collectionName);
    const logOptions = LogUtility.getOptions({
      srvProvider,
      service: `hardDelete-${collectionName}`,
    });
    await collection.doc(documentId).delete();
    LogUtility.printLog(logOptions);
    _updateDocSize({ numberOfDocs: -1 });
    return true;
  };
}

function _getSettings(collectionName) {
  return {
    srvProvider: SRV_PROVIDER.FIRESTORE,
    collection: db.collection(collectionName),
  };
}

function _updateDocSize(options = { numberOfDocs: 0 }) {
  const overrideOptions = Object.assign({ numberOfDocs: 0 }, options);
  for (const field in overrideOptions) {
    db.doc(`${DATA_MODEL.SIZE}/${this.collectionName}`).update(
      field,
      firestore.FieldValue.increment(overrideOptions[field])
    );
  }
}

async function _getDocSize() {
  const docSnap = await db
    .doc(`${DATA_MODEL.SIZE}/${this.collectionName}`)
    .get();

  const floorNumber = 0;
  const { numberOfDocs, numberOfDeletes } = docSnap.data();
  const diffNumber = numberOfDocs - (numberOfDeletes || floorNumber);
  return diffNumber > floorNumber ? diffNumber : floorNumber;
}

function _genRandomCode(length) {
  const char = '1234567890abcdefghijklmnopqrstuvwxyz';
  let code = '';
  for (let i = 0; i < length; i++) {
    code = code + char[Math.floor(Math.random() * char.length)];
  }
  return code;
}
