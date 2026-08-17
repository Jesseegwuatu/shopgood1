// api/server.js - SIMPLIFIED VERSION for Vercel

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// ========================================
// CONFIGURATION - From Vercel Environment Variables
// ========================================
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || "https://shop-good-81afa-default-rtdb.firebaseio.com";
const FIREBASE_DATABASE_SECRET = process.env.FIREBASE_DATABASE_SECRET || "8qexZglGAbuGEf3Y5Q5NINnIvXdnyMwB36jYAzB8";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

console.log('🚀 Server starting...');
console.log('📡 Firebase URL:', FIREBASE_DATABASE_URL);
console.log('🔑 Paystack configured:', !!PAYSTACK_SECRET);
console.log('🤖 OpenRouter configured:', !!OPENROUTER_API_KEY);

// ========================================
// FIREBASE REST API HELPER
// ========================================
const firebaseRequest = async (method, path, data = null) => {
    const url = `${FIREBASE_DATABASE_URL}/${path}.json?auth=${FIREBASE_DATABASE_SECRET}`;
    
    try {
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(`Firebase ${method} error:`, error);
        throw error;
    }
};

const getData = async (path) => {
    try {
        const result = await firebaseRequest('GET', path);
        return result;
    } catch (error) {
        return null;
    }
};

const setData = async (path, data) => {
    try {
        const result = await firebaseRequest('PUT', path, data);
        return result;
    } catch (error) {
        return null;
    }
};

const updateData = async (path, data) => {
    try {
        const result = await firebaseRequest('PATCH', path, data);
        return result;
    } catch (error) {
        return null;
    }
};

const deleteData = async (path) => {
    try {
        const result = await firebaseRequest('DELETE', path);
        return result;
    } catch (error) {
        return null;
    }
};

// ========================================
// AUTH MIDDLEWARE - Simplified
// ========================================
const verifyAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
        // Verify token using Google's API
        const response = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=AIzaSyA3uJnA73js_YRrSJM_aN-HxVvNu1uwA6g`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token })
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        const data = await response.json();
        if (data.users && data.users.length > 0) {
            req.user = {
                uid: data.users[0].localId,
                email: data.users[0].email,
                ...data.users[0]
            };
            return next();
        }
        
        throw new Error('Invalid token');
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// ========================================
// HEALTH CHECK
// ========================================
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: Date.now(),
        databaseConfigured: !!FIREBASE_DATABASE_URL,
        paystackConfigured: !!PAYSTACK_SECRET
    });
});

// ========================================
// TEST ROUTE - To check if Firebase works
// ========================================
app.get('/api/test-firebase', async (req, res) => {
    try {
        const testData = await getData('test');
        res.json({ success: true, data: testData });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ========================================
// AUTH ROUTES
// ========================================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { uid, email, displayName, phone, photoURL, role = 'customer' } = req.body;

        if (!uid || !email) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Check if user exists
        const existingUser = await getData(`users/${uid}`);
        if (existingUser && existingUser !== null) {
            await updateData(`users/${uid}`, {
                email,
                displayName: displayName || '',
                phone: phone || '',
                photoURL: photoURL || '',
                role,
                lastLogin: Date.now()
            });
        } else {
            await setData(`users/${uid}`, {
                uid,
                email,
                displayName: displayName || '',
                phone: phone || '',
                photoURL: photoURL || '',
                role,
                isActive: true,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                preferences: {
                    notifications: {
                        email: true,
                        browser: true,
                        orders: true,
                        promotions: false
                    }
                }
            });
        }

        // Create wallet
        const wallet = await getData(`wallets/${uid}`);
        if (!wallet || wallet === null) {
            await setData(`wallets/${uid}`, {
                balance: 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        res.json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/auth/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email required' });
        }

        const users = await getData('users');
        let exists = false;
        if (users) {
            exists = Object.values(users).some(user => user.email === email);
        }

        res.json({ success: true, exists });
    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { email, redirectUrl } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email required' });
        }

        // Firebase Auth handles password reset directly
        res.json({ success: true, message: 'Password reset email sent' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// USER ROUTES
// ========================================

app.get('/api/users/profile', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const userData = await getData(`users/${uid}`);

        if (!userData || userData === null) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.json({ success: true, user: { ...userData, uid } });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/users/update', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { displayName, phone, photoURL, preferences } = req.body;

        const updates = {};
        if (displayName !== undefined) updates.displayName = displayName;
        if (phone !== undefined) updates.phone = phone;
        if (photoURL !== undefined) updates.photoURL = photoURL;
        if (preferences) updates.preferences = preferences;
        updates.updatedAt = Date.now();

        await updateData(`users/${uid}`, updates);

        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/users/preferences', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { notifications } = req.body;

        if (notifications) {
            await updateData(`users/${uid}/preferences/notifications`, notifications);
        }

        res.json({ success: true, message: 'Preferences updated' });
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/users/recently-viewed', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const items = await getData(`users/${uid}/recentlyViewed`) || [];

        res.json({ success: true, items });
    } catch (error) {
        console.error('Get recently viewed error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/users/recently-viewed', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { items } = req.body;

        await setData(`users/${uid}/recentlyViewed`, items);

        res.json({ success: true, message: 'Updated' });
    } catch (error) {
        console.error('Update recently viewed error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/users/delete', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        await deleteData(`users/${uid}`);
        await deleteData(`wallets/${uid}`);
        await deleteData(`cart/${uid}`);
        await deleteData(`notifications/${uid}`);
        await deleteData(`wishlist/${uid}`);

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/users', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        // Check if admin
        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const users = await getData('users') || {};
        const userList = Object.values(users);

        res.json({ success: true, users: userList });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// PRODUCT ROUTES
// ========================================

app.get('/api/products', async (req, res) => {
    try {
        const { limit, categoryId, status, bestSeller } = req.query;

        const products = await getData('products') || {};
        let productList = Object.entries(products).map(([id, data]) => ({
            id,
            ...data
        }));

        if (categoryId) {
            productList = productList.filter(p => p.categoryId === categoryId);
        }
        if (status) {
            productList = productList.filter(p => p.status === status);
        }
        if (bestSeller === 'true') {
            productList = productList.filter(p => p.bestSeller === true);
        }

        productList.sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0));

        if (limit) {
            productList = productList.slice(0, parseInt(limit));
        }

        res.json({ success: true, products: productList });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/products/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ success: true, products: [] });
        }

        const searchTerm = q.toLowerCase();
        const products = await getData('products') || {};

        const results = Object.entries(products)
            .filter(([id, data]) => {
                const name = (data.name || '').toLowerCase();
                const brand = (data.brand || '').toLowerCase();
                const description = (data.description || '').toLowerCase();
                return name.includes(searchTerm) || brand.includes(searchTerm) || description.includes(searchTerm);
            })
            .map(([id, data]) => ({
                id,
                ...data
            }))
            .slice(0, 50);

        res.json({ success: true, products: results });
    } catch (error) {
        console.error('Search products error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/products/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await getData(`products/${productId}`);

        if (!product || product === null) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.json({ success: true, product: { id: productId, ...product } });
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/products', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { name, categoryId, price, stock, status, description, brand, thumbnail, images, variations } = req.body;

        if (!name || !categoryId || !price) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const productId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const productData = {
            name,
            categoryId,
            price: price || { base: 0, display: 0, discountPercent: 0 },
            stock: stock || { available: 0, reserved: 0, status: 'out_of_stock' },
            status: status || 'active',
            description: description || '',
            brand: brand || '',
            thumbnail: thumbnail || '',
            images: images || [],
            variations: variations || {},
            createdAt: Date.now(),
            updatedAt: Date.now(),
            soldCount: 0,
            rating: { average: 0, count: 0 }
        };

        await setData(`products/${productId}`, productData);

        res.json({ success: true, product: { id: productId, ...productData } });
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/products/:productId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { productId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { name, categoryId, price, stock, status, description, brand, thumbnail, images, variations } = req.body;

        const product = await getData(`products/${productId}`);
        if (!product || product === null) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const updates = { updatedAt: Date.now() };
        if (name !== undefined) updates.name = name;
        if (categoryId !== undefined) updates.categoryId = categoryId;
        if (price !== undefined) updates.price = price;
        if (stock !== undefined) updates.stock = stock;
        if (status !== undefined) updates.status = status;
        if (description !== undefined) updates.description = description;
        if (brand !== undefined) updates.brand = brand;
        if (thumbnail !== undefined) updates.thumbnail = thumbnail;
        if (images !== undefined) updates.images = images;
        if (variations !== undefined) updates.variations = variations;

        await updateData(`products/${productId}`, updates);

        const updatedProduct = await getData(`products/${productId}`);
        res.json({ success: true, product: { id: productId, ...updatedProduct } });
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/products/:productId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { productId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const product = await getData(`products/${productId}`);
        if (!product || product === null) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        await deleteData(`products/${productId}`);
        res.json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/categories/:categoryId/products', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const products = await getData('products') || {};

        const productList = Object.entries(products)
            .filter(([id, data]) => data.categoryId === categoryId)
            .map(([id, data]) => ({
                id,
                ...data
            }));

        res.json({ success: true, products: productList });
    } catch (error) {
        console.error('Get category products error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// CATEGORY ROUTES
// ========================================

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await getData('categories') || {};
        const categoryList = Object.entries(categories).map(([id, data]) => ({
            id,
            ...data
        }));

        res.json({ success: true, categories: categoryList });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/categories/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const category = await getData(`categories/${categoryId}`);

        if (!category || category === null) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        res.json({ success: true, category: { id: categoryId, ...category } });
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/categories', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { name, image, icon, status, description } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Category name required' });
        }

        const categoryId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const categoryData = {
            name,
            image: image || '',
            icon: icon || 'tag',
            status: status || 'active',
            description: description || '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await setData(`categories/${categoryId}`, categoryData);

        res.json({ success: true, category: { id: categoryId, ...categoryData } });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/categories/:categoryId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { categoryId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { name, image, icon, status, description } = req.body;

        const category = await getData(`categories/${categoryId}`);
        if (!category || category === null) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const updates = { updatedAt: Date.now() };
        if (name !== undefined) updates.name = name;
        if (image !== undefined) updates.image = image;
        if (icon !== undefined) updates.icon = icon;
        if (status !== undefined) updates.status = status;
        if (description !== undefined) updates.description = description;

        await updateData(`categories/${categoryId}`, updates);

        const updatedCategory = await getData(`categories/${categoryId}`);
        res.json({ success: true, category: { id: categoryId, ...updatedCategory } });
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/categories/:categoryId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { categoryId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const category = await getData(`categories/${categoryId}`);
        if (!category || category === null) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        await deleteData(`categories/${categoryId}`);
        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// CART ROUTES
// ========================================

app.get('/api/cart', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const cart = await getData(`cart/${uid}/items`) || {};

        res.json({ success: true, cart });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/cart/update', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { productId, variationId, quantity, price, name, thumbnail, variationName } = req.body;

        if (!productId || !quantity || quantity < 1) {
            return res.status(400).json({ success: false, message: 'Invalid product data' });
        }

        const cart = await getData(`cart/${uid}/items`) || {};
        let existingKey = null;

        for (const [key, item] of Object.entries(cart)) {
            if (item.productId === productId && item.variationId === variationId) {
                existingKey = key;
                break;
            }
        }

        if (existingKey) {
            await updateData(`cart/${uid}/items/${existingKey}`, {
                quantity: Math.min(quantity, 99),
                updatedAt: Date.now()
            });
        } else {
            const newKey = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
            await setData(`cart/${uid}/items/${newKey}`, {
                productId,
                variationId: variationId || null,
                quantity,
                price: price || 0,
                name: name || 'Product',
                thumbnail: thumbnail || '',
                variationName: variationName || '',
                addedAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        res.json({ success: true, message: 'Cart updated successfully' });
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/cart/remove', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { cartKey } = req.body;

        if (!cartKey) {
            return res.status(400).json({ success: false, message: 'Cart key required' });
        }

        await deleteData(`cart/${uid}/items/${cartKey}`);
        res.json({ success: true, message: 'Item removed from cart' });
    } catch (error) {
        console.error('Remove cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/cart/clear', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        await deleteData(`cart/${uid}/items`);
        res.json({ success: true, message: 'Cart cleared successfully' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// WISHLIST ROUTES
// ========================================

app.get('/api/wishlist', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const items = await getData(`wishlist/${uid}/items`) || {};

        res.json({ success: true, items });
    } catch (error) {
        console.error('Get wishlist error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/wishlist/toggle', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: 'Product ID required' });
        }

        const existing = await getData(`wishlist/${uid}/items/${productId}`);
        let added = false;

        if (existing && existing !== null) {
            await deleteData(`wishlist/${uid}/items/${productId}`);
            added = false;
        } else {
            await setData(`wishlist/${uid}/items/${productId}`, {
                productId,
                addedAt: Date.now()
            });
            added = true;
        }

        res.json({ success: true, added });
    } catch (error) {
        console.error('Toggle wishlist error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// ORDER ROUTES
// ========================================

app.get('/api/orders/list', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        const isAdmin = adminCheck || req.user.email === 'jesseegwuatu@gmail.com';

        const ordersData = await getData('orders') || {};
        let orderList = Object.entries(ordersData).map(([id, data]) => ({
            id,
            ...data
        }));

        if (!isAdmin) {
            orderList = orderList.filter(o => o.customerUid === uid);
        }

        orderList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        res.json({ success: true, orders: orderList });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/orders/:orderId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderId } = req.params;

        const order = await getData(`orders/${orderId}`);
        if (!order || order === null) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const adminCheck = await getData(`admins/${uid}`);
        const isAdmin = adminCheck || req.user.email === 'jesseegwuatu@gmail.com';

        if (order.customerUid !== uid && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.json({ success: true, order: { id: orderId, ...order } });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/orders/create', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderNumber, deliveryAddress, items, subtotal, deliveryFee, discount, total, paymentMethod, estimatedDelivery } = req.body;

        if (!items || items.length === 0 || !deliveryAddress) {
            return res.status(400).json({ success: false, message: 'Missing order details' });
        }

        const userData = await getData(`users/${uid}`) || {};

        const orderId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const orderData = {
            orderNumber: orderNumber || 'SG' + Date.now().toString(36).toUpperCase(),
            customerUid: uid,
            customerName: userData.displayName || '',
            customerEmail: userData.email || '',
            deliveryAddress,
            items: items.map(item => ({
                ...item,
                productId: item.productId || item.id,
                name: item.name || 'Product',
                quantity: item.quantity || 1,
                price: item.price || 0,
                total: (item.price || 0) * (item.quantity || 1),
                thumbnail: item.thumbnail || '',
                variationName: item.variationName || ''
            })),
            subtotal: subtotal || 0,
            deliveryFee: deliveryFee || 0,
            discount: discount || 0,
            total: total || 0,
            paymentMethod: paymentMethod || 'paystack',
            paymentStatus: 'pending',
            orderStatus: 'pending',
            estimatedDelivery: estimatedDelivery || {
                start: Date.now() + (2 * 24 * 60 * 60 * 1000),
                end: Date.now() + (5 * 24 * 60 * 60 * 1000)
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
            statusHistory: [{
                status: 'pending',
                note: 'Order placed',
                timestamp: Date.now()
            }]
        };

        await setData(`orders/${orderId}`, orderData);

        // Send notification
        try {
            await setData(`notifications/${uid}/${Date.now().toString(36)}`, {
                title: 'Order Placed',
                message: `Your order #${orderData.orderNumber} has been placed successfully.`,
                type: 'order',
                read: false,
                createdAt: Date.now(),
                data: { orderId, orderNumber: orderData.orderNumber }
            });
        } catch (notifError) {
            console.error('Notification error:', notifError);
        }

        res.json({ success: true, order: { id: orderId, ...orderData } });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/orders/:orderId/status', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderId } = req.params;
        const { status, note } = req.body;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const order = await getData(`orders/${orderId}`);
        if (!order || order === null) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const history = order.statusHistory || [];
        history.push({
            status,
            note: note || `Status changed to ${status}`,
            timestamp: Date.now()
        });

        await updateData(`orders/${orderId}`, {
            orderStatus: status,
            updatedAt: Date.now(),
            statusHistory: history
        });

        res.json({ success: true, message: 'Order status updated' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/orders/:orderId/cancel', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderId } = req.params;
        const { note } = req.body;

        const order = await getData(`orders/${orderId}`);
        if (!order || order === null) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const adminCheck = await getData(`admins/${uid}`);
        const isAdmin = adminCheck || req.user.email === 'jesseegwuatu@gmail.com';

        if (order.customerUid !== uid && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const cancellableStatuses = ['pending', 'paid', 'confirmed'];
        if (!cancellableStatuses.includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled in its current state: ${order.orderStatus}`
            });
        }

        const history = order.statusHistory || [];
        history.push({
            status: 'cancelled',
            note: note || 'Order cancelled',
            timestamp: Date.now()
        });

        await updateData(`orders/${orderId}`, {
            orderStatus: 'cancelled',
            updatedAt: Date.now(),
            statusHistory: history
        });

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/orders/:orderId/confirm', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderId } = req.params;
        const { paymentReference, paymentMethod } = req.body;

        const order = await getData(`orders/${orderId}`);
        if (!order || order === null) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.customerUid !== uid) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const history = order.statusHistory || [];
        history.push({
            status: 'paid',
            note: 'Payment confirmed',
            timestamp: Date.now()
        });

        await updateData(`orders/${orderId}`, {
            paymentStatus: 'paid',
            orderStatus: 'paid',
            paymentReference: paymentReference,
            paymentMethod: paymentMethod || order.paymentMethod,
            updatedAt: Date.now(),
            statusHistory: history
        });

        res.json({ success: true, message: 'Order confirmed' });
    } catch (error) {
        console.error('Confirm order error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/orders/export', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { limit } = req.query;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const ordersData = await getData('orders') || {};
        let orderList = Object.entries(ordersData).map(([id, data]) => ({
            id,
            ...data
        }));

        orderList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        if (limit) {
            orderList = orderList.slice(0, parseInt(limit));
        }

        res.json({ success: true, orders: orderList });
    } catch (error) {
        console.error('Export orders error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// WALLET ROUTES
// ========================================

app.get('/api/wallet/balance', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const wallet = await getData(`wallets/${uid}`) || { balance: 0 };

        res.json({ success: true, balance: wallet.balance || 0 });
    } catch (error) {
        console.error('Get wallet balance error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/wallet/transactions', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const transactionsData = await getData(`wallets/${uid}/transactions`) || {};
        const transactionList = Object.entries(transactionsData).map(([id, data]) => ({
            id,
            ...data
        }));

        transactionList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        res.json({ success: true, transactions: transactionList });
    } catch (error) {
        console.error('Get wallet transactions error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/payments/initialize', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { amount, email, type, metadata } = req.body;

        if (!amount || amount < 100) {
            return res.status(400).json({ success: false, message: 'Invalid amount (min ₦100)' });
        }

        if (!PAYSTACK_SECRET) {
            return res.status(500).json({ success: false, message: 'Paystack secret key not configured' });
        }

        const userData = await getData(`users/${uid}`) || {};

        const reference = `SG_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const response = await axios.post('https://api.paystack.co/transaction/initialize', {
            email: email || userData.email,
            amount: Math.round(amount * 100),
            currency: 'NGN',
            reference,
            callback_url: `${req.headers.origin || 'https://shopgood1.vercel.app'}/wallet.html`,
            metadata: {
                ...metadata,
                type: type || 'wallet_funding',
                customerUid: uid
            }
        }, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.status) {
            await setData(`pending_payments/${reference}`, {
                uid,
                amount,
                type: type || 'wallet_funding',
                status: 'pending',
                createdAt: Date.now()
            });

            res.json({
                success: true,
                authorization_url: response.data.data.authorization_url,
                reference: reference
            });
        } else {
            throw new Error(response.data.message || 'Payment initialization failed');
        }
    } catch (error) {
        console.error('Payment initialization error:', error);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
    }
});

app.get('/api/payments/verify/:reference', verifyAuth, async (req, res) => {
    try {
        const { reference } = req.params;

        if (!PAYSTACK_SECRET) {
            return res.status(500).json({ success: false, message: 'Paystack secret key not configured' });
        }

        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET}`
            }
        });

        if (response.data.status) {
            const data = response.data.data;

            const pending = await getData(`pending_payments/${reference}`);

            if (pending && data.status === 'success') {
                const wallet = await getData(`wallets/${pending.uid}`) || { balance: 0 };
                const newBalance = (wallet.balance || 0) + (data.amount / 100);

                await updateData(`wallets/${pending.uid}`, {
                    balance: newBalance,
                    updatedAt: Date.now()
                });

                const txId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
                await setData(`wallets/${pending.uid}/transactions/${txId}`, {
                    amount: data.amount / 100,
                    type: 'fund',
                    status: 'completed',
                    reference: reference,
                    description: 'Wallet funding via Paystack',
                    createdAt: Date.now()
                });

                await deleteData(`pending_payments/${reference}`);

                res.json({
                    success: true,
                    status: 'completed',
                    amount: data.amount / 100
                });
            } else if (data.status === 'success') {
                res.json({
                    success: true,
                    status: 'completed',
                    amount: data.amount / 100,
                    reference: data.reference
                });
            } else {
                res.json({
                    success: true,
                    status: data.status,
                    message: data.gateway_response || 'Payment verification failed'
                });
            }
        } else {
            throw new Error(response.data.message || 'Verification failed');
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ success: false, message: error.response?.data?.message || error.message });
    }
});

app.post('/api/orders/:orderId/pay-with-wallet', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { orderId } = req.params;

        const order = await getData(`orders/${orderId}`);
        if (!order || order === null) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.customerUid !== uid) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (order.paymentStatus === 'paid') {
            return res.status(400).json({ success: false, message: 'Order already paid' });
        }

        const wallet = await getData(`wallets/${uid}`) || { balance: 0 };

        if (wallet.balance < order.total) {
            return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
        }

        const newBalance = (wallet.balance || 0) - order.total;
        await updateData(`wallets/${uid}`, {
            balance: newBalance,
            updatedAt: Date.now()
        });

        const txId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        await setData(`wallets/${uid}/transactions/${txId}`, {
            amount: order.total,
            type: 'payment',
            status: 'completed',
            reference: `ORDER_${order.orderNumber}`,
            description: `Payment for order #${order.orderNumber}`,
            createdAt: Date.now()
        });

        const history = order.statusHistory || [];
        history.push({
            status: 'paid',
            note: 'Payment via wallet',
            timestamp: Date.now()
        });

        await updateData(`orders/${orderId}`, {
            paymentStatus: 'paid',
            orderStatus: 'paid',
            paymentMethod: 'wallet',
            updatedAt: Date.now(),
            statusHistory: history
        });

        res.json({ success: true, message: 'Payment successful' });
    } catch (error) {
        console.error('Wallet payment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// NOTIFICATION ROUTES
// ========================================

app.get('/api/notifications', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const notificationsData = await getData(`notifications/${uid}`) || {};
        const notificationList = Object.entries(notificationsData).map(([id, data]) => ({
            id,
            ...data
        }));

        notificationList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        res.json({ success: true, notifications: notificationList });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/notifications/unread-count', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const notificationsData = await getData(`notifications/${uid}`) || {};
        const unread = Object.values(notificationsData).filter(n => !n.read).length;

        res.json({ success: true, count: unread });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/notifications/:notificationId/read', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { notificationId } = req.params;

        await updateData(`notifications/${uid}/${notificationId}`, { read: true });
        res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/notifications/read-all', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const notificationsData = await getData(`notifications/${uid}`) || {};

        for (const key of Object.keys(notificationsData)) {
            await updateData(`notifications/${uid}/${key}`, { read: true });
        }

        res.json({ success: true, message: 'All marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/notifications/:notificationId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { notificationId } = req.params;

        await deleteData(`notifications/${uid}/${notificationId}`);
        res.json({ success: true, message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/notifications', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        await deleteData(`notifications/${uid}`);
        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        console.error('Clear notifications error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// SUPPORT / CHAT ROUTES
// ========================================

app.post('/api/support/chat', verifyAuth, async (req, res) => {
    try {
        const { message, userName, userEmail, history } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        let responseText = null;
        let source = 'openrouter';

        try {
            if (OPENROUTER_API_KEY) {
                const aiResponse = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'google/gemini-2.0-flash-exp:free',
                    messages: [
                        {
                            role: 'system',
                            content: `You are Vortex AI, a helpful and friendly shopping assistant for Shop Good, an e-commerce platform in Nigeria. 
                            You help customers with orders, payments, delivery, product inquiries, returns, and general shopping questions.
                            Be concise, friendly, and professional. Keep responses under 3 paragraphs unless detailed information is needed.
                            Your name is Vortex AI. You work for Shop Good (shopgood.com).`
                        },
                        ...(history || []),
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 400
                }, {
                    headers: {
                        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://shopgood.com',
                        'X-Title': 'Shop Good Support'
                    },
                    timeout: 8000
                });

                if (aiResponse.data && aiResponse.data.choices && aiResponse.data.choices.length > 0) {
                    responseText = aiResponse.data.choices[0].message.content;
                }
            }
        } catch (aiError) {
            console.error('OpenRouter API error:', aiError.message);
        }

        if (!responseText) {
            source = 'fallback';
            responseText = "I'm here to help! Could you please provide more details about your question?";
        }

        res.json({ success: true, response: responseText, source: source });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to process your request' });
    }
});

app.post('/api/support/ticket', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { customerName, customerEmail, category, subject, message, priority } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ success: false, message: 'Subject and message required' });
        }

        const ticketId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const ticketData = {
            id: ticketId,
            customerUid: uid,
            customerName: customerName || 'Customer',
            customerEmail: customerEmail || '',
            category: category || 'other',
            subject: subject,
            message: message,
            priority: priority || 'normal',
            status: 'open',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await setData(`support_tickets/${ticketId}`, ticketData);

        res.json({ success: true, ticket: { id: ticketId, ...ticketData } });
    } catch (error) {
        console.error('Create ticket error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/support/tickets', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const ticketsData = await getData('support_tickets') || {};
        const ticketList = Object.entries(ticketsData)
            .filter(([id, data]) => data.customerUid === uid)
            .map(([id, data]) => ({
                id,
                ...data
            }));

        ticketList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        res.json({ success: true, tickets: ticketList });
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// ADDRESS ROUTES
// ========================================

app.get('/api/addresses', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const addressesData = await getData(`addresses/${uid}`) || {};
        const addressList = Object.entries(addressesData).map(([id, data]) => ({
            id,
            ...data
        }));

        res.json({ success: true, addresses: addressList });
    } catch (error) {
        console.error('Get addresses error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/addresses', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { fullName, phone, state, city, area, address, landmark, instructions, label, isDefault } = req.body;

        if (!fullName || !phone || !state || !city || !area || !address) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const addressId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        if (isDefault) {
            const addressesData = await getData(`addresses/${uid}`) || {};
            for (const [id, data] of Object.entries(addressesData)) {
                if (data.isDefault) {
                    await updateData(`addresses/${uid}/${id}`, { isDefault: false });
                }
            }
        }

        const addressData = {
            fullName,
            phone,
            state,
            city,
            area,
            address,
            landmark: landmark || '',
            instructions: instructions || '',
            label: label || 'Home',
            isDefault: isDefault || false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await setData(`addresses/${uid}/${addressId}`, addressData);

        res.json({ success: true, address: { id: addressId, ...addressData } });
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/addresses/:addressId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { addressId } = req.params;
        const { fullName, phone, state, city, area, address, landmark, instructions, label, isDefault } = req.body;

        const address = await getData(`addresses/${uid}/${addressId}`);
        if (!address || address === null) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        if (isDefault) {
            const addressesData = await getData(`addresses/${uid}`) || {};
            for (const [id, data] of Object.entries(addressesData)) {
                if (data.isDefault && id !== addressId) {
                    await updateData(`addresses/${uid}/${id}`, { isDefault: false });
                }
            }
        }

        const updates = {
            fullName,
            phone,
            state,
            city,
            area,
            address,
            landmark: landmark || '',
            instructions: instructions || '',
            label: label || 'Home',
            isDefault: isDefault || false,
            updatedAt: Date.now()
        };

        await updateData(`addresses/${uid}/${addressId}`, updates);

        const updatedAddress = await getData(`addresses/${uid}/${addressId}`);
        res.json({ success: true, address: { id: addressId, ...updatedAddress } });
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/addresses/:addressId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { addressId } = req.params;

        await deleteData(`addresses/${uid}/${addressId}`);
        res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
        console.error('Delete address error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/addresses/:addressId/default', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { addressId } = req.params;

        const addressesData = await getData(`addresses/${uid}`) || {};
        for (const [id, data] of Object.entries(addressesData)) {
            if (data.isDefault) {
                await updateData(`addresses/${uid}/${id}`, { isDefault: false });
            }
        }

        await updateData(`addresses/${uid}/${addressId}`, { isDefault: true });

        res.json({ success: true, message: 'Default address updated' });
    } catch (error) {
        console.error('Set default address error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// VOUCHER ROUTES
// ========================================

app.get('/api/vouchers', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const vouchersData = await getData(`vouchers/${uid}`) || {};
        const voucherList = Object.entries(vouchersData).map(([id, data]) => ({
            id,
            ...data
        }));

        voucherList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        res.json({ success: true, vouchers: voucherList });
    } catch (error) {
        console.error('Get vouchers error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/vouchers/redeem', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { code } = req.body;

        if (!code) {
            return res.status(400).json({ success: false, message: 'Voucher code required' });
        }

        const normalizedCode = code.toUpperCase().trim();
        const globalVouchers = await getData('vouchers_global') || {};

        let globalVoucherId = null;
        let globalVoucher = null;

        for (const [id, data] of Object.entries(globalVouchers)) {
            if (data.code === normalizedCode) {
                globalVoucherId = id;
                globalVoucher = data;
                break;
            }
        }

        if (!globalVoucher) {
            return res.status(404).json({ success: false, message: 'Invalid voucher code' });
        }

        if (globalVoucher.status === 'used') {
            return res.status(400).json({ success: false, message: 'Voucher has already been used' });
        }

        if (globalVoucher.expiryDate && globalVoucher.expiryDate <= Date.now()) {
            return res.status(400).json({ success: false, message: 'Voucher has expired' });
        }

        if (globalVoucher.customerEmail && globalVoucher.customerEmail !== req.user.email) {
            return res.status(403).json({ success: false, message: 'This voucher is not assigned to you' });
        }

        const userVoucherId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const voucherData = {
            code: globalVoucher.code,
            type: globalVoucher.type || 'voucher',
            discountType: globalVoucher.discountType || 'fixed',
            value: globalVoucher.value,
            description: globalVoucher.description || '',
            minimumOrder: globalVoucher.minimumOrder || 0,
            expiryDate: globalVoucher.expiryDate || null,
            status: 'active',
            redeemedAt: Date.now(),
            createdAt: Date.now()
        };

        await setData(`vouchers/${uid}/${userVoucherId}`, voucherData);

        await updateData(`vouchers_global/${globalVoucherId}`, {
            status: 'used',
            usedBy: uid,
            usedAt: Date.now()
        });

        res.json({ success: true, message: 'Voucher redeemed successfully', voucher: voucherData });
    } catch (error) {
        console.error('Redeem voucher error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/vouchers', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { code, type, discountType, value, customerEmail, expiryDate, status, description, minimumOrder } = req.body;

        if (!value || value <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid value' });
        }

        const voucherCode = code || 'VC' + Date.now().toString(36).toUpperCase();

        const voucherId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const voucherData = {
            code: voucherCode,
            type: type || 'voucher',
            discountType: discountType || 'fixed',
            value: value,
            customerEmail: customerEmail || '',
            expiryDate: expiryDate || null,
            status: status || 'active',
            description: description || '',
            minimumOrder: minimumOrder || 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await setData(`vouchers_global/${voucherId}`, voucherData);

        res.json({ success: true, voucher: { id: voucherId, ...voucherData } });
    } catch (error) {
        console.error('Create voucher error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/vouchers/:voucherId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { voucherId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        await deleteData(`vouchers_global/${voucherId}`);
        res.json({ success: true, message: 'Voucher deleted' });
    } catch (error) {
        console.error('Delete voucher error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/vouchers/gift-card', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { recipientEmail, amount, message, senderName } = req.body;

        if (!recipientEmail || !amount || amount < 100) {
            return res.status(400).json({ success: false, message: 'Invalid gift card details' });
        }

        const code = 'GC' + Date.now().toString(36).toUpperCase();
        const voucherId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const voucherData = {
            code: code,
            type: 'gift_card',
            discountType: 'fixed',
            value: amount,
            customerEmail: recipientEmail,
            expiryDate: Date.now() + (365 * 24 * 60 * 60 * 1000),
            status: 'active',
            description: `Gift card from ${senderName || 'Shop Good'}`,
            minimumOrder: 0,
            giftCard: {
                senderName: senderName || 'Shop Good',
                senderEmail: req.user.email,
                message: message || '',
                recipientEmail: recipientEmail,
                sentAt: Date.now()
            },
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await setData(`vouchers_global/${voucherId}`, voucherData);

        res.json({
            success: true,
            message: 'Gift card sent successfully',
            giftCard: { code, amount, recipientEmail, senderName: senderName || 'Shop Good' }
        });
    } catch (error) {
        console.error('Send gift card error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// PROMOTIONS / FLASH SALE ROUTES
// ========================================

app.get('/api/promotions/flash', async (req, res) => {
    try {
        const promotionsData = await getData('promotions') || {};
        const promoList = Object.entries(promotionsData)
            .filter(([id, data]) => data.type === 'flash_sale')
            .map(([id, data]) => ({
                id,
                ...data
            }));

        promoList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        res.json({ success: true, promotions: promoList });
    } catch (error) {
        console.error('Get flash sales error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/promotions', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { type, name, discountPercent, endDate, products, status } = req.body;

        if (!name || !discountPercent || !endDate || !products || products.length === 0) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const promoId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

        const promoData = {
            type: type || 'flash_sale',
            name,
            discountPercent,
            endDate,
            products,
            status: status || 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        await setData(`promotions/${promoId}`, promoData);

        res.json({ success: true, promotion: { id: promoId, ...promoData } });
    } catch (error) {
        console.error('Create promotion error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/promotions/:promotionId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { promotionId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const promotion = await getData(`promotions/${promotionId}`);
        if (!promotion || promotion === null) {
            return res.status(404).json({ success: false, message: 'Promotion not found' });
        }

        const { name, discountPercent, endDate, products, status } = req.body;

        await updateData(`promotions/${promotionId}`, {
            name,
            discountPercent,
            endDate,
            products,
            status,
            updatedAt: Date.now()
        });

        const updatedPromotion = await getData(`promotions/${promotionId}`);
        res.json({ success: true, promotion: { id: promotionId, ...updatedPromotion } });
    } catch (error) {
        console.error('Update promotion error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/promotions/:promotionId', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { promotionId } = req.params;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const promotion = await getData(`promotions/${promotionId}`);
        if (!promotion || promotion === null) {
            return res.status(404).json({ success: false, message: 'Promotion not found' });
        }

        await deleteData(`promotions/${promotionId}`);
        res.json({ success: true, message: 'Promotion deleted' });
    } catch (error) {
        console.error('Delete promotion error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// ADMIN MANAGEMENT ROUTES
// ========================================

app.get('/api/admins/check', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        if (req.user.email === 'jesseegwuatu@gmail.com') {
            return res.json({ isAdmin: true, firstLogin: false });
        }

        const adminData = await getData(`admins/${uid}`);
        if (!adminData || adminData === null) {
            return res.json({ isAdmin: false });
        }

        res.json({
            isAdmin: true,
            firstLogin: adminData.firstLogin || false,
            role: adminData.role || 'admin'
        });
    } catch (error) {
        console.error('Check admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/admins', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        if (req.user.email !== 'jesseegwuatu@gmail.com') {
            const adminCheck = await getData(`admins/${uid}`);
            if (!adminCheck || adminCheck === null) {
                return res.status(403).json({ success: false, message: 'Super admin access required' });
            }
        }

        const adminsData = await getData('admins') || {};
        const adminList = Object.entries(adminsData).map(([id, data]) => ({
            uid: id,
            ...data
        }));

        res.json({ success: true, admins: adminList });
    } catch (error) {
        console.error('Get admins error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admins', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        if (req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Super admin access required' });
        }

        const { email, displayName, firstLogin = true } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email required' });
        }

        const users = await getData('users') || {};
        let userUid = null;
        for (const [id, data] of Object.entries(users)) {
            if (data.email === email) {
                userUid = id;
                break;
            }
        }

        if (!userUid) {
            return res.status(404).json({ success: false, message: 'User not found. User must have an account first.' });
        }

        const existingAdmin = await getData(`admins/${userUid}`);
        if (existingAdmin && existingAdmin !== null) {
            return res.status(400).json({ success: false, message: 'User is already an admin' });
        }

        await setData(`admins/${userUid}`, {
            email: email,
            displayName: displayName || 'Admin',
            role: 'admin',
            firstLogin: firstLogin,
            createdAt: Date.now(),
            addedBy: uid
        });

        res.json({ success: true, message: 'Admin added successfully' });
    } catch (error) {
        console.error('Add admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admins/:adminUid', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { adminUid } = req.params;

        if (req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Super admin access required' });
        }

        const adminData = await getData(`admins/${adminUid}`);
        if (adminData && adminData.email === 'jesseegwuatu@gmail.com') {
            return res.status(400).json({ success: false, message: 'Cannot remove super admin' });
        }

        await deleteData(`admins/${adminUid}`);

        res.json({ success: true, message: 'Admin removed successfully' });
    } catch (error) {
        console.error('Remove admin error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// ANALYTICS ROUTES
// ========================================

app.get('/api/analytics', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { period = '30' } = req.query;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const periodDays = period === 'all' ? Infinity : parseInt(period);
        const cutoff = periodDays === Infinity ? 0 : Date.now() - (periodDays * 24 * 60 * 60 * 1000);

        const ordersData = await getData('orders') || {};
        const orders = Object.entries(ordersData)
            .filter(([id, data]) => !periodDays || (data.createdAt || 0) >= cutoff)
            .map(([id, data]) => ({
                id,
                ...data
            }));

        res.json({ success: true, orders });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// SETTINGS ROUTES
// ========================================

app.get('/api/settings', async (req, res) => {
    try {
        const settings = await getData('settings/store') || {};
        res.json({ success: true, settings });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/settings', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { storeName, storeEmail, storePhone, storeAddress, deliveryFee, minCOD } = req.body;

        const updates = {};
        if (storeName !== undefined) updates.storeName = storeName;
        if (storeEmail !== undefined) updates.storeEmail = storeEmail;
        if (storePhone !== undefined) updates.storePhone = storePhone;
        if (storeAddress !== undefined) updates.storeAddress = storeAddress;
        if (deliveryFee !== undefined) updates.deliveryFee = deliveryFee;
        if (minCOD !== undefined) updates.minCOD = minCOD;
        updates.updatedAt = Date.now();

        await updateData('settings/store', updates);

        res.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// AUDIT LOG ROUTES
// ========================================

app.get('/api/audit-logs', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;

        const adminCheck = await getData(`admins/${uid}`);
        if (!adminCheck && req.user.email !== 'jesseegwuatu@gmail.com') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const logsData = await getData('audit_logs') || {};
        const logList = Object.entries(logsData).map(([id, data]) => ({
            id,
            ...data
        }));

        logList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        res.json({ success: true, logs: logList });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/audit-logs', verifyAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { action, details, adminEmail, adminUid } = req.body;

        const logId = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        await setData(`audit_logs/${logId}`, {
            action,
            details,
            adminEmail: adminEmail || req.user.email,
            adminUid: adminUid || uid,
            timestamp: Date.now()
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Create audit log error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========================================
// EXPORT FOR VERCEL
// ========================================
module.exports = app;
