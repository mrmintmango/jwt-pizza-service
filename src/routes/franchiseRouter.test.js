const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'toomanysecrets' };
const testAdmin = { name: 'pizza admin', email: 'admin@test.com', password: 'toomanysecrets' };
let testUserAuthToken;
let testAdminAuthToken;
let testFranchise;
let testStore;

beforeAll(async () => {
  // Create unique emails
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  testAdmin.email = Math.random().toString(36).substring(2, 12) + '@admin.com';
  
  // Register users
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUser.id = registerRes.body.user.id;
  
  // Create admin user directly in DB
  const adminUser = { ...testAdmin, roles: [{ role: Role.Admin }] };
  const createdAdmin = await DB.addUser(adminUser);
  testAdmin.id = createdAdmin.id;
  
  const adminLoginRes = await request(app).put('/api/auth').send(testAdmin);
  testAdminAuthToken = adminLoginRes.body.token;
});


test('list all franchises', async () => {
    const response = await request(app)
    .get('/api/franchise')
    .expect(200);

    expect(response.body).toHaveProperty('franchises');
    expect(response.body).toHaveProperty('more');
    expect(Array.isArray(response.body.franchises)).toBe(true);
});

test('should support pagination and filtering', async () => {
    const response = await request(app)
    .get('/api/franchise?page=0&limit=5&name=test')
    .expect(200);

    expect(response.body).toHaveProperty('franchises');
    expect(response.body).toHaveProperty('more');
});

test('get user franchises', async () => {
  const response = await request(app)
    .get(`/api/franchise/${testUser.id}`, {userID: testUser.id})
    .set('Authorization', `Bearer ${testUserAuthToken}`);

  expect(response.status).toBe(200);
  expect(Array.isArray(response.body)).toBe(true);
});

test('fail to get user franchises without auth', async () => {
  const response = await request(app)
    .get(`/api/franchise/${testUser.id}`);

  expect(response.status).toBe(401);
});

test('create franchise as admin', async () => {
  const franchiseData = {
    name: Math.random().toString(36).substring(2, 12),
    admins: [{ email: testUser.email }]
  };

  const response = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testAdminAuthToken}`)
    .send(franchiseData);
  
  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('id');
  expect(response.body.name).toBe(franchiseData.name);
  testFranchise = response.body;
});

test('fail to create franchise as non-admin', async () => {
  const franchiseData = {
    name: Math.random().toString(36).substring(2, 12),
    admins: [{ email: testUser.email }]
  };

  const response = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(franchiseData);
  
  expect(response.status).toBe(403);
});

test('fail to create franchise without auth', async () => {
  const franchiseData = {
    name: Math.random().toString(36).substring(2, 12),
    admins: [{ email: testUser.email }]
  };

  const response = await request(app)
    .post('/api/franchise')
    .send(franchiseData);
  
  expect(response.status).toBe(401);
});

test('create store as franchise admin', async () => {
  const storeData = {
    name: Math.random().toString(36).substring(2, 12)
  };

  const response = await request(app)
    .post(`/api/franchise/${testFranchise.id}/store`)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(storeData);

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('id');
  expect(response.body.name).toBe(storeData.name);
  testStore = response.body;
});

test('fail to create store without auth', async () => {
  const storeData = {
    name: Math.random().toString(36).substring(2, 12)
  };

  const response = await request(app)
    .post(`/api/franchise/${testFranchise.id}/store`)
    .send(storeData);
  
  expect(response.status).toBe(401);
});

test('delete store', async () => {
  const response = await request(app)
    .delete(`/api/franchise/${testFranchise.id}/store/${testStore.id}`)
    .set('Authorization', `Bearer ${testUserAuthToken}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('store deleted');
});

test('delete franchise', async () => {
  const response = await request(app)
    .delete(`/api/franchise/${testFranchise.id}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('franchise deleted');
});