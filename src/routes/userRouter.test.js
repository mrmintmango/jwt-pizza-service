const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'toomanysecrets' };
const testAdmin = { name: 'pizza admin', email: 'admin@test.com', password: 'toomanysecrets' };
let testUserAuthToken;
let testAdminAuthToken;

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

// listUsers tests
test('list users unauthorized', async () => {
  const listUsersRes = await request(app).get('/api/user');
  expect(listUsersRes.status).toBe(401);
});

test('list users', async () => {
  const listUsersRes = await request(app)
    .get('/api/user?page=1&limit=10&name=*')
    .set('Authorization', 'Bearer ' + testAdminAuthToken);
  expect(listUsersRes.status).toBe(200);
  
  // Check pagination structure
  expect(listUsersRes.body).toHaveProperty('users');
  expect(listUsersRes.body).toHaveProperty('more');
  expect(listUsersRes.body).toHaveProperty('page');
  expect(listUsersRes.body).toHaveProperty('limit');
  expect(listUsersRes.body).toHaveProperty('total');
  
  // Check that users is an array
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
  
  // Check pagination parameters
  expect(listUsersRes.body.page).toBe(1);
  expect(listUsersRes.body.limit).toBe(10);
  expect(typeof listUsersRes.body.total).toBe('number');
  expect(typeof listUsersRes.body.more).toBe('boolean');
});

test('list users with pagination parameters', async () => {
  const listUsersRes = await request(app)
    .get('/api/user?page=0&limit=5')
    .set('Authorization', 'Bearer ' + testAdminAuthToken);
  expect(listUsersRes.status).toBe(200);
  
  expect(listUsersRes.body.page).toBe(0);
  expect(listUsersRes.body.limit).toBe(5);
  expect(listUsersRes.body.users.length).toBeLessThanOrEqual(5);
});

test('list users with name filter', async () => {
  const listUsersRes = await request(app)
    .get('/api/user?name=pizza')
    .set('Authorization', 'Bearer ' + testAdminAuthToken);
  expect(listUsersRes.status).toBe(200);
  
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);
  // All returned users should have 'pizza' in their name
  listUsersRes.body.users.forEach(user => {
    expect(user.name.toLowerCase()).toContain('pizza');
  });
});

test('delete user', async () => {
  // Create a user specifically for deletion
  const [user, userToken] = await registerUser(request(app));
  
  // Verify user exists first
  const getUserRes = await request(app)
    .get('/api/user/me')
    .set('Authorization', `Bearer ${userToken}`);
  expect(getUserRes.status).toBe(200);
  
  // Now delete the user
  const deleteRes = await request(app)
    .delete(`/api/user/${user.id}`)
    .set('Authorization', `Bearer ${userToken}`)
    .expect(200);
    
  expect(deleteRes.body).toHaveProperty('message', 'User deleted');
  
  // Verify user is actually deleted by trying to access /me again
  const verifyDeleteRes = await request(app)
    .get('/api/user/me')
    .set('Authorization', `Bearer ${userToken}`);
  expect(verifyDeleteRes.status).toBe(401); // Should be unauthorized now
});

async function registerUser(service) {
  const testUser = {
    name: 'pizza diner',
    email: `${randomName()}@test.com`,
    password: 'a',
  };
  const registerRes = await service.post('/api/auth').send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}