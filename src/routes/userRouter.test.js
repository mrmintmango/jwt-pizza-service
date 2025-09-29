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


test ('get a user', async () => {
    const response = await request(app)
    .get('/api/user/me')
    .set('Authorization', `Bearer ${testUserAuthToken}`)    
    .expect(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('name', testUser.name);
    expect(response.body).toHaveProperty('email', testUser.email);
    expect(Array.isArray(response.body.roles)).toBe(true);
});

test('update a user', async () => {
    const newName = 'updated diner';
    const newEmail = 'updated@test.com';
    const response = await request(app)
    .put(`/api/user/${testUser.id}`)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({ name: newName, email: newEmail })
    .expect(200);
    
    expect(response.body.user).toHaveProperty('name', newName);
    expect(response.body.user).toHaveProperty('email', newEmail);
    expect(response.body).toHaveProperty('token'); // Check that new token is returned
});