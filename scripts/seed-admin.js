#!/usr/bin/env node
// Creates the initial super-admin user
// Usage: MONGO_URL=... node scripts/seed-admin.js

import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://taarifa:change_me@localhost:27017/taarifa?authSource=admin';
const DB_NAME  = process.env.MONGO_DB || 'taarifa';

const email    = process.argv[2] || 'admin@taarifa.live';
const password = process.argv[3] || randomBytes(8).toString('hex');
const fullName = process.argv[4] || 'Super Admin';

const client = new MongoClient(MONGO_URL);
await client.connect();
const db = client.db(DB_NAME);

let org = await db.collection('organizations').findOne({ slug: 'taarifa' });
if (!org) {
  const { insertedId } = await db.collection('organizations').insertOne({
    _id: 'taarifa-platform', name: 'Taarifa Platform',
    slug: 'taarifa', plan: 'enterprise', isActive: true,
    settings: {}, createdAt: new Date(), updatedAt: new Date(),
  });
  org = { _id: insertedId };
}

const exists = await db.collection('users').findOne({ email });
if (exists) {
  console.log(`User ${email} already exists.`);
} else {
  await db.collection('users').insertOne({
    orgId: org._id, email, fullName,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'super_admin', locale: 'en', isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
  });
  console.log(`\n✅ Admin user created:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`\nChange the password after first login!\n`);
}

await client.close();
