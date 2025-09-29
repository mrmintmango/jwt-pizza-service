const { DB, Role } = require('./database.js');


  let testUser;
  let testFranchise;
  let testStore;

  beforeAll(async () => {
    await DB.initialized;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testStore && testFranchise) {
      await DB.deleteStore(testFranchise.id, testStore.id);
    }
    if (testFranchise) {
      await DB.deleteFranchise(testFranchise.id);
    }
  });

  test('should get menu items', async () => {
    const menu = await DB.getMenu();
    expect(Array.isArray(menu)).toBe(true);
  });

  test('should add menu item', async () => {
    const menuItem = {
      title: 'Test Pizza',
      description: 'A delicious test pizza',
      image: 'test.jpg',
      price: 12.99
    };

    const result = await DB.addMenuItem(menuItem);
    expect(result).toHaveProperty('id');
    expect(result.title).toBe(menuItem.title);
    expect(result.description).toBe(menuItem.description);
    expect(result.price).toBe(menuItem.price);
  });

  test('should add and get user', async () => {
    const userData = {
      name: 'Test User',
      email: Math.random().toString(36).substring(2, 12) + '@test.com',
      password: 'testpassword',
      roles: [{ role: Role.Diner }]
    };

    testUser = await DB.addUser(userData);
    expect(testUser).toHaveProperty('id');
    expect(testUser.name).toBe(userData.name);
    expect(testUser.email).toBe(userData.email);
    expect(testUser.password).toBeUndefined(); // Password should be removed
    expect(Array.isArray(testUser.roles)).toBe(true);

    // Test getting the user
    const retrievedUser = await DB.getUser(userData.email, userData.password);
    expect(retrievedUser.id).toBe(testUser.id);
    expect(retrievedUser.email).toBe(userData.email);
  });

  test('should fail to get user with wrong password', async () => {
    await expect(DB.getUser(testUser.email, 'wrongpassword')).rejects.toThrow('unknown user');
  });

  test('should update user', async () => {
    const newName = 'Updated Test User';
    const newEmail = Math.random().toString(36).substring(2, 12) + '@updated.com';
    
    const updatedUser = await DB.updateUser(testUser.id, newName, newEmail);
    expect(updatedUser.name).toBe(newName);
    expect(updatedUser.email).toBe(newEmail);
    
    // Update our test user reference
    testUser.name = newName;
    testUser.email = newEmail;
  });

  test('should create franchise', async () => {
    const franchiseData = {
      name: 'Test Franchise ' + Math.random().toString(36).substring(2, 12),
      admins: [{ email: testUser.email }]
    };

    testFranchise = await DB.createFranchise(franchiseData);
    expect(testFranchise).toHaveProperty('id');
    expect(testFranchise.name).toBe(franchiseData.name);
    expect(testFranchise.admins).toHaveLength(1);
    expect(testFranchise.admins[0].email).toBe(testUser.email);
  });


  test('should get user franchises', async () => {
    const userFranchises = await DB.getUserFranchises(testUser.id);
    expect(Array.isArray(userFranchises)).toBe(true);
    expect(userFranchises.length).toBeGreaterThan(0);
    expect(userFranchises[0].id).toBe(testFranchise.id);
  });

  test('should create store', async () => {
    const storeData = {
      name: 'Test Store ' + Math.random().toString(36).substring(2, 12)
    };

    testStore = await DB.createStore(testFranchise.id, storeData);
    expect(testStore).toHaveProperty('id');
    expect(testStore.name).toBe(storeData.name);
    expect(testStore.franchiseId).toBe(testFranchise.id);
  });

  test('should get orders for user', async () => {
    const orders = await DB.getOrders(testUser);
    expect(orders).toHaveProperty('dinerId', testUser.id);
    expect(orders).toHaveProperty('orders');
    expect(Array.isArray(orders.orders)).toBe(true);
  });

  test('should add diner order', async () => {
    // First get menu to have valid menu items
    const menu = await DB.getMenu();
    if (menu.length === 0) {
      // Add a menu item if none exists
      await DB.addMenuItem({
        title: 'Test Order Pizza',
        description: 'Pizza for order test',
        image: 'test.jpg',
        price: 15.99
      });
      const updatedMenu = await DB.getMenu();
      expect(updatedMenu.length).toBeGreaterThan(0);
    }

    const orderData = {
      franchiseId: testFranchise.id,
      storeId: testStore.id,
      items: [
        {
          menuId: menu[0]?.id || 1,
          description: 'Test pizza order',
          price: 15.99
        }
      ]
    };

    const order = await DB.addDinerOrder(testUser, orderData);
    expect(order).toHaveProperty('id');
    expect(order.franchiseId).toBe(orderData.franchiseId);
    expect(order.storeId).toBe(orderData.storeId);
  });

  test('should handle login/logout', async () => {
    const token = 'test.token.signature';
    
    // Test login
    await DB.loginUser(testUser.id, token);
    const isLoggedIn = await DB.isLoggedIn(token);
    expect(isLoggedIn).toBe(true);
    
    // Test logout
    await DB.logoutUser(token);
    const isLoggedInAfterLogout = await DB.isLoggedIn(token);
    expect(isLoggedInAfterLogout).toBe(false);
  });

  test('should delete store', async () => {
    await expect(DB.deleteStore(testFranchise.id, testStore.id)).resolves.not.toThrow();
    testStore = null; // Mark as deleted
  });

  test('should delete franchise', async () => {
    await expect(DB.deleteFranchise(testFranchise.id)).resolves.not.toThrow();
    testFranchise = null; // Mark as deleted
  });

