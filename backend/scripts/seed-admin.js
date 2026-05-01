#!/usr/bin/env node
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { config } from '../src/config/index.js';

const email    = process.argv[2] || 'admin@taarifa.live';
const password = process.argv[3] || randomBytes(8).toString('hex');
const fullName = process.argv[4] || 'Admin';

const client = new MongoClient(config.mongo.url);
await client.connect();
const db = client.db(config.mongo.db);

let org = await db.collection('organizations').findOne({ slug: 'taarifa' });
if (!org) {
  const res = await db.collection('organizations').insertOne({
    name: 'Taarifa Platform', slug: 'taarifa', plan: 'enterprise',
    isActive: true, settings: {}, createdAt: new Date(), updatedAt: new Date(),
  });
  org = { _id: res.insertedId };
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
  console.log(`\n✅ Admin created:`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}\n`);
}

await client.close();
