
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { User, Product, Customer, Sale, SaleItem, Debt, DebtPayment, Settings } from '../types';

interface LocalPOSDB extends DBSchema {
  users: {
    key: string;
    value: User;
    indexes: { 'username': string };
  };
  products: {
    key: string;
    value: Product;
    indexes: { 'barcode': string; 'category': string };
  };
  customers: {
    key: string;
    value: Customer;
    indexes: { 'name': string };
  };
  sales: {
    key: string;
    value: Sale;
    indexes: { 'dateTime': string; 'customerId': string };
  };
  sale_items: {
    key: string;
    value: SaleItem;
    indexes: { 'saleId': string; 'productId': string };
  };
  debts: {
    key: string;
    value: Debt;
    indexes: { 'customerId': string; 'saleId': string };
  };
  debt_payments: {
    key: string;
    value: DebtPayment;
    indexes: { 'customerId': string };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

const DB_NAME = 'grosir-localpos-db';
const DB_VERSION = 1;

export const initDB = async (): Promise<IDBPDatabase<LocalPOSDB>> => {
  return openDB<LocalPOSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('username', 'username', { unique: true });
        userStore.put({
          id: 'user-admin-seed',
          username: 'admin',
          passwordHash: 'admin123',
          role: 'admin',
          createdAt: new Date().toISOString()
        });
      }
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('barcode', 'barcode', { unique: false }); 
        productStore.createIndex('category', 'category');
      }
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore('customers', { keyPath: 'id' });
        custStore.createIndex('name', 'name');
      }
      if (!db.objectStoreNames.contains('sales')) {
        const saleStore = db.createObjectStore('sales', { keyPath: 'id' });
        saleStore.createIndex('dateTime', 'dateTime');
        saleStore.createIndex('customerId', 'customerId');
      }
      if (!db.objectStoreNames.contains('sale_items')) {
        const saleItemStore = db.createObjectStore('sale_items', { keyPath: 'id' });
        saleItemStore.createIndex('saleId', 'saleId');
        saleItemStore.createIndex('productId', 'productId');
      }
      if (!db.objectStoreNames.contains('debts')) {
        const debtStore = db.createObjectStore('debts', { keyPath: 'id' });
        debtStore.createIndex('customerId', 'customerId');
        debtStore.createIndex('saleId', 'saleId');
      }
      if (!db.objectStoreNames.contains('debt_payments')) {
        const debtPaymentStore = db.createObjectStore('debt_payments', { keyPath: 'id' });
        debtPaymentStore.createIndex('customerId', 'customerId');
      }
      if (!db.objectStoreNames.contains('settings')) {
        const settingsStore = db.createObjectStore('settings');
        settingsStore.put({
          storeName: 'Toko Sembako Berkah',
          storeAddress: 'Jl. Raya Makmur No. 12',
          storePhone: '08123456789',
          receiptFooterNote: 'Terima kasih, datang kembali!'
        }, 'config');
      }
    },
  });
};

let dbPromise: Promise<IDBPDatabase<LocalPOSDB>> | null = null;

export const getDB = () => {
  if (!dbPromise) dbPromise = initDB();
  return dbPromise;
};

export const saveTransaction = async (
  sale: Sale,
  items: SaleItem[],
  debt?: Debt
) => {
  const db = await getDB();
  const tx = db.transaction(['sales', 'sale_items', 'products', 'debts'], 'readwrite');
  
  await tx.objectStore('sales').add(sale);

  for (const item of items) {
    await tx.objectStore('sale_items').add(item);
    
    const product = await tx.objectStore('products').get(item.productId);
    if (product) {
      // Potong stok: qty jual * faktor konversi (misal jual 1 slop isi 10, stok dasar kurang 10)
      product.stock -= (item.quantity * item.conversionFactor);
      await tx.objectStore('products').put(product);
    }
  }

  if (debt) await tx.objectStore('debts').add(debt);
  await tx.done;
};

export const exportBackup = async () => {
  const db = await getDB();
  return {
    products: await db.getAll('products'),
    customers: await db.getAll('customers'),
    sales: await db.getAll('sales'),
    saleItems: await db.getAll('sale_items'),
    debts: await db.getAll('debts'),
    debtPayments: await db.getAll('debt_payments'),
    users: await db.getAll('users'),
    settings: await db.get('settings', 'config'),
    version: 1,
    timestamp: new Date().toISOString()
  };
};

export const restoreBackup = async (backupData: any) => {
  const db = await getDB();
  const tx = db.transaction(
    ['products', 'customers', 'sales', 'sale_items', 'debts', 'debt_payments', 'users', 'settings'], 
    'readwrite'
  );

  await tx.objectStore('products').clear();
  await tx.objectStore('customers').clear();
  await tx.objectStore('sales').clear();
  await tx.objectStore('sale_items').clear();
  await tx.objectStore('debts').clear();
  await tx.objectStore('debt_payments').clear();
  await tx.objectStore('users').clear();
  await tx.objectStore('settings').clear();

  if(backupData.products) for (const item of backupData.products) await tx.objectStore('products').add(item);
  if(backupData.customers) for (const item of backupData.customers) await tx.objectStore('customers').add(item);
  if(backupData.sales) for (const item of backupData.sales) await tx.objectStore('sales').add(item);
  if(backupData.saleItems) for (const item of backupData.saleItems) await tx.objectStore('sale_items').add(item);
  if(backupData.debts) for (const item of backupData.debts) await tx.objectStore('debts').add(item);
  if(backupData.debtPayments) for (const item of backupData.debtPayments) await tx.objectStore('debt_payments').add(item);
  if(backupData.users) for (const item of backupData.users) await tx.objectStore('users').add(item);
  if(backupData.settings) await tx.objectStore('settings').put(backupData.settings, 'config');

  await tx.done;
};
