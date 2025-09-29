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
  testUser.id = registerRes.body.user.id; // Add this line to get the user ID
  
  // Create admin user directly in DB
  const adminUser = { ...testAdmin, roles: [{ role: Role.Admin }] };
  const createdAdmin = await DB.addUser(adminUser);
  testAdmin.id = createdAdmin.id;
  
  const adminLoginRes = await request(app).put('/api/auth').send(testAdmin);
  testAdminAuthToken = adminLoginRes.body.token;

  // Create a test franchise and store for order creation
  const franchiseData = {
    name: Math.random().toString(36).substring(2, 12),
    admins: [{ email: testUser.email }]
  };
  
  const franchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testAdminAuthToken}`)
    .send(franchiseData);
  testFranchise = franchiseRes.body;

  const storeData = {
    name: Math.random().toString(36).substring(2, 12)
  };
  
  const storeRes = await request(app)
    .post(`/api/franchise/${testFranchise.id}/store`)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(storeData);
  testStore = storeRes.body;
});

test('get menu items', async () => {
  const response = await request(app)
    .get('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    // Check that each menu item has the required fields
    response.body.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('image');
    });
});

test('add menu item as admin', async () => {
  const newItem = {
    title: 'Test Pizza',
    price: 9.99,
    description: 'Delicious test pizza',
    image: 'http://example.com/test-pizza.jpg'
  };

  const response = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${testAdminAuthToken}`)
    .send(newItem)
    .expect(200);

  expect(Array.isArray(response.body)).toBe(true);
  expect(response.body[response.body.length-1]).toHaveProperty('id');
  expect(response.body[response.body.length-1].title).toBe(newItem.title);
  expect(response.body[response.body.length-1].price).toBe(newItem.price);
  expect(response.body[response.body.length-1].description).toBe(newItem.description);
  expect(response.body[response.body.length-1].image).toBe(newItem.image);
});

test('fail to add menu item as non-admin', async () => {
  const newItem = {
    title: 'Unauthorized Pizza',
    price: 5.99,
    description: 'Should not be added',
    image: 'http://example.com/unauth-pizza.jpg'
  };
    const response = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(newItem)
    .expect(403);
});

test('get user orders', async () => {
    // First, ensure there is at least one order for the user
    const menuRes = await request(app)    
    .get('/api/order/menu').expect(200);
    const menu = menuRes.body;
    expect(menu.length).toBeGreaterThan(0);
    const menuItem = menu[0];

  const response = await request(app)
    .get('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .expect(200);
    expect(Number.isInteger(response.body.page)).toBe(true);
    
    // Check that each order has the required fields
    response.body.orders.forEach(order => {
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('userId');
        expect(order).toHaveProperty('items');
        expect(Array.isArray(order.items)).toBe(true);
  });
});


test('create order', async () => {
  // First, get the menu to know valid menu IDs
  const menuRes = await request(app)    
    .get('/api/order/menu').expect(200);
  const menu = menuRes.body;
  expect(menu.length).toBeGreaterThan(0);
  const menuItem = menu[0];

  const newOrder = {
    franchiseId: testFranchise.id, // Add franchise ID
    storeId: testStore.id,         // Add store ID
    items: [
      {
        menuId: menuItem.id,        // Use menuId instead of menuItemId
        description: menuItem.description,
        price: menuItem.price
      }
    ]
  };

  const response = await request(app)
    .post('/api/order')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(newOrder)
    .expect(200);

  expect(response.body).toHaveProperty('order');
  expect(response.body.order).toHaveProperty('id');
  expect(response.body.order.franchiseId).toBe(newOrder.franchiseId);
  expect(response.body.order.storeId).toBe(newOrder.storeId);
  expect(Array.isArray(response.body.order.items)).toBe(true);
  expect(response.body.order.items.length).toBe(newOrder.items.length);
});