import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;
const dbName = process.env.MONGODB_DB_NAME || 'kopcheni_smakoluky';

if (!uri) {
  throw new Error('MONGODB_URI не встановлено в .env або середовищі');
}

const client = new MongoClient(uri);
let db = null;

export async function initDb() {
  if (db) return db;
  await client.connect();
  db = client.db(dbName);
  await ensureSampleProducts();
  return db;
}

export function getObjectId(value) {
  try {
    return new ObjectId(value);
  } catch {
    return null;
  }
}

function mapDocument(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

async function ensureSampleProducts() {
  const products = db.collection('products');
  const count = await products.countDocuments();
  if (count > 0) return;

  const samples = [
    { name: 'Ковбаса домашня', description: 'Натуральне копчення, свинина', price_per_100g: 85, sort_order: 1, is_active: true, is_stop_listed: false, created_at: new Date() },
    { name: 'Сало копчене', description: 'З часником та перцем', price_per_100g: 65, sort_order: 2, is_active: true, is_stop_listed: false, created_at: new Date() },
    { name: 'Ребра свинні', description: 'М\'які, соковиті', price_per_100g: 120, sort_order: 3, is_active: true, is_stop_listed: false, created_at: new Date() },
    { name: 'Курка копчена', description: 'Ціла тушка', price_per_100g: 95, sort_order: 4, is_active: true, is_stop_listed: false, created_at: new Date() },
    { name: 'Сир копчений', description: 'Твердий, ароматний', price_per_100g: 110, sort_order: 5, is_active: true, is_stop_listed: false, created_at: new Date() },
  ];

  await products.insertMany(samples);
}

export async function getProductsCollection() {
  const database = await initDb();
  return database.collection('products');
}

export async function getOrdersCollection() {
  const database = await initDb();
  return database.collection('orders');
}

export async function getOrderItemsCollection() {
  const database = await initDb();
  return database.collection('order_items');
}

export function mapProduct(doc) {
  return mapDocument(doc);
}

export function mapOrder(doc) {
  return mapDocument(doc);
}

export function mapOrderItem(doc) {
  return mapDocument(doc);
}
