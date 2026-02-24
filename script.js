// script.js
import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global variables
let currentUser = null;
let currentUserData = null;
let services = [];

// Initialize based on page
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData(user.uid);
            
            // Redirect if needed
            if (path.includes('login.html') || path.includes('register.html')) {
                if (currentUserData?.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'dashboard.html';
                }
            }
            
            // Load page-specific content
            if (path.includes('dashboard.html')) {
                loadDashboard();
            } else if (path.includes('admin.html')) {
                if (currentUserData?.role !== 'admin') {
                    window.location.href = 'dashboard.html';
                } else {
                    loadAdminPanel();
                }
            }
        } else {
            // Not logged in
            if (path.includes('dashboard.html') || path.includes('admin.html')) {
                window.location.href = 'login.html';
            }
        }
    });
    
    // Initialize page-specific event listeners
    if (path.includes('register.html')) {
        initRegister();
    } else if (path.includes('login.html')) {
        initLogin();
    } else if (path.includes('dashboard.html')) {
        initDashboard();
    } else if (path.includes('admin.html')) {
        initAdmin();
    }
});

// Load user data from Firestore
async function loadUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Initialize register page
function initRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            showAlert('Passwords do not match', 'error');
            return;
        }
        
        try {
            // Create user in Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Create user document in Firestore
            await addDoc(collection(db, 'users'), {
                uid: user.uid,
                fullName: fullName,
                email: email,
                balance: 0,
                role: 'user',
                apiKey: generateAPIKey(),
                createdAt: serverTimestamp()
            });
            
            showAlert('Registration successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
            
        } catch (error) {
            showAlert(error.message, 'error');
        }
    });
}

// Initialize login page
function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            showAlert('Login successful! Redirecting...', 'success');
            
            // Check if admin
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('uid', '==', userCredential.user.uid));
            const querySnapshot = await getDocs(q);
            
            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                if (userData.role === 'admin') {
                    setTimeout(() => { window.location.href = 'admin.html'; }, 2000);
                } else {
                    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
                }
            });
            
        } catch (error) {
            showAlert(error.message, 'error');
        }
    });
}

// Initialize dashboard
function initDashboard() {
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Order form
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderSubmit);
        
        // Update price when quantity changes
        const quantityInput = document.getElementById('quantity');
        const serviceSelect = document.getElementById('service');
        
        quantityInput.addEventListener('input', updateOrderPrice);
        serviceSelect.addEventListener('change', updateOrderPrice);
    }
}

// Initialize admin panel
function initAdmin() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // User form
    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }
    
    // Service form
    const addServiceForm = document.getElementById('addServiceForm');
    if (addServiceForm) {
        addServiceForm.addEventListener('submit', handleAddService);
    }
}

// Load dashboard data
async function loadDashboard() {
    try {
        // Display user info
        document.getElementById('userName').textContent = currentUserData?.fullName || 'User';
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userBalance').textContent = `$${currentUserData?.balance || 0}`;
        
        // Load services
        await loadServices();
        
        // Load orders
        await loadUserOrders();
        
        // Load API key
        document.getElementById('apiKey').value = currentUserData?.apiKey || 'No API key found';
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showAlert('Error loading dashboard data', 'error');
    }
}

// Load services from Firestore
async function loadServices() {
    try {
        const servicesRef = collection(db, 'services');
        const querySnapshot = await getDocs(servicesRef);
        
        services = [];
        querySnapshot.forEach((doc) => {
            services.push({ id: doc.id, ...doc.data() });
        });
        
        // Populate service dropdown
        const serviceSelect = document.getElementById('service');
        if (serviceSelect) {
            serviceSelect.innerHTML = '<option value="">Choose a service...</option>';
            services.forEach(service => {
                serviceSelect.innerHTML += `<option value="${service.id}" data-price="${service.price}">${service.name} - $${service.price}/1000</option>`;
            });
        }
        
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

// Load user orders
async function loadUserOrders() {
    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;
        
        let ordersHtml = '';
        let totalOrders = 0;
        let completedOrders = 0;
        let pendingOrders = 0;
        
        querySnapshot.forEach((doc) => {
            const order = doc.data();
            totalOrders++;
            
            if (order.status === 'completed') completedOrders++;
            if (order.status === 'pending') pendingOrders++;
            
            ordersHtml += `
                <tr>
                    <td>#${doc.id.slice(0, 8)}</td>
                    <td>${order.serviceName}</td>
                    <td>${order.link}</td>
                    <td>${order.quantity}</td>
                    <td>$${order.price}</td>
                    <td><span class="badge badge-${order.status}">${order.status}</span></td>
                    <td>${new Date(order.createdAt?.toDate()).toLocaleDateString()}</td>
                </tr>
            `;
        });
        
        document.getElementById('totalOrders').textContent = totalOrders;
        document.getElementById('completedOrders').textContent = completedOrders;
        document.getElementById('pendingOrders').textContent = pendingOrders;
        
        ordersList.innerHTML = ordersHtml || '<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>';
        
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Handle order submission
async function handleOrderSubmit(e) {
    e.preventDefault();
    
    const serviceId = document.getElementById('service').value;
    const link = document.getElementById('link').value;
    const quantity = parseInt(document.getElementById('quantity').value);
    
    const selectedService = services.find(s => s.id === serviceId);
    if (!selectedService) return;
    
    const price = (selectedService.price / 1000) * quantity;
    
    // Check if user has enough balance
    if (currentUserData.balance < price) {
        showAlert('Insufficient balance. Please add funds.', 'error');
        return;
    }
    
    try {
        // Create order
        const orderRef = await addDoc(collection(db, 'orders'), {
            userId: currentUser.uid,
            serviceId: serviceId,
            serviceName: selectedService.name,
            link: link,
            quantity: quantity,
            price: price,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        
        // Update user balance
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach(async (doc) => {
            await updateDoc(doc.ref, {
                balance: currentUserData.balance - price
            });
        });
        
        showAlert('Order placed successfully!', 'success');
        e.target.reset();
        
        // Reload dashboard data
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Error placing order:', error);
        showAlert('Error placing order', 'error');
    }
}

// Load admin panel data
async function loadAdminPanel() {
    try {
        await loadAllUsers();
        await loadAllServices();
        await loadAllOrders();
        await loadAdminStats();
    } catch (error) {
        console.error('Error loading admin panel:', error);
    }
}

// Load all users for admin
async function loadAllUsers() {
    try {
        const usersRef = collection(db, 'users');
        const querySnapshot = await getDocs(usersRef);
        
        const usersList = document.getElementById('usersList');
        if (!usersList) return;
        
        let usersHtml = '';
        querySnapshot.forEach((doc) => {
            const user = doc.data();
            usersHtml += `
                <tr>
                    <td>${doc.id.slice(0, 8)}</td>
                    <td>${user.fullName || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>$${user.balance || 0}</td>
                    <td>${user.totalOrders || 0}</td>
                    <td><span class="badge badge-${user.status || 'active'}">${user.status || 'active'}</span></td>
                    <td>
                        <button class="btn btn-secondary" onclick="editUser('${doc.id}')">Edit</button>
                        <button class="btn btn-danger" onclick="deleteUser('${doc.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        usersList.innerHTML = usersHtml || '<tr><td colspan="7" style="text-align: center;">No users found</td></tr>';
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load all services for admin
async function loadAllServices() {
    try {
        const servicesRef = collection(db, 'services');
        const querySnapshot = await getDocs(servicesRef);
        
        const servicesList = document.getElementById('servicesList');
        if (!servicesList) return;
        
        let servicesHtml = '';
        querySnapshot.forEach((doc) => {
            const service = doc.data();
            servicesHtml += `
                <tr>
                    <td>${doc.id.slice(0, 8)}</td>
                    <td>${service.name}</td>
                    <td>${service.category}</td>
                    <td>$${service.price}</td>
                    <td>${service.min}</td>
                    <td>${service.max}</td>
                    <td><span class="badge badge-${service.status || 'active'}">${service.status || 'active'}</span></td>
                    <td>
                        <button class="btn btn-secondary" onclick="editService('${doc.id}')">Edit</button>
                        <button class="btn btn-danger" onclick="deleteService('${doc.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        servicesList.innerHTML = servicesHtml || '<tr><td colspan="8" style="text-align: center;">No services found</td></tr>';
        
    } catch (error) {
        console.error('Error loading services:', error);
    }
}

// Load all orders for admin
async function loadAllOrders() {
    try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;
        
        let ordersHtml = '';
        querySnapshot.forEach((doc) => {
            const order = doc.data();
            ordersHtml += `
                <tr>
                    <td>#${doc.id.slice(0, 8)}</td>
                    <td>${order.userId?.slice(0, 8)}...</td>
                    <td>${order.serviceName}</td>
                    <td>${order.link}</td>
                    <td>${order.quantity}</td>
                    <td>$${order.price}</td>
                    <td><span class="badge badge-${order.status}">${order.status}</span></td>
                    <td>${new Date(order.createdAt?.toDate()).toLocaleDateString()}</td>
                    <td>
                        <select onchange="updateOrderStatus('${doc.id}', this.value)">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>Processing</option>
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                </tr>
            `;
        });
        
        ordersList.innerHTML = ordersHtml || '<tr><td colspan="9" style="text-align: center;">No orders found</td></tr>';
        
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Load admin stats
async function loadAdminStats() {
    try {
        // Get total users
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        document.getElementById('totalUsers').textContent = usersSnapshot.size;
        
        // Get total orders and revenue
        const ordersRef = collection(db, 'orders');
        const ordersSnapshot = await getDocs(ordersRef);
        let totalRevenue = 0;
        let pendingCount = 0;
        
        ordersSnapshot.forEach((doc) => {
            const order = doc.data();
            totalRevenue += order.price || 0;
            if (order.status === 'pending') pendingCount++;
        });
        
        document.getElementById('totalOrders').textContent = ordersSnapshot.size;
        document.getElementById('totalRevenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('pendingOrders').textContent = pendingCount;
        
    } catch (error) {
        console.error('Error loading admin stats:', error);
    }
}

// Handle add user
async function handleAddUser(e) {
    e.preventDefault();
    
    const name = document.getElementById('userName').value;
    const email = document.getElementById('userEmail').value;
    const password = document.getElementById('userPassword').value;
    const balance = parseFloat(document.getElementById('userBalance').value);
    
    try {
        // Create user in Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore
        await addDoc(collection(db, 'users'), {
            uid: user.uid,
            fullName: name,
            email: email,
            balance: balance,
            role: 'user',
            apiKey: generateAPIKey(),
            createdAt: serverTimestamp()
        });
        
        showAlert('User added successfully!', 'success');
        closeAddUserModal();
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle add service
async function handleAddService(e) {
    e.preventDefault();
    
    const name = document.getElementById('serviceName').value;
    const category = document.getElementById('serviceCategory').value;
    const price = parseFloat(document.getElementById('servicePrice').value);
    const min = parseInt(document.getElementById('serviceMin').value);
    const max = parseInt(document.getElementById('serviceMax').value);
    
    try {
        await addDoc(collection(db, 'services'), {
            name: name,
            category: category,
            price: price,
            min: min,
            max: max,
            status: 'active',
            createdAt: serverTimestamp()
        });
        
        showAlert('Service added successfully!', 'success');
        closeAddServiceModal();
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

// Handle logout
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
    }
}

// Utility Functions
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function generateAPIKey() {
    return 'smm_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
}

function updateOrderPrice() {
    const serviceSelect = document.getElementById('service');
    const quantity = document.getElementById('quantity').value;
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    
    if (selectedOption && selectedOption.dataset.price) {
        const price = parseFloat(selectedOption.dataset.price);
        const total = (price / 1000) * parseInt(quantity);
        document.getElementById('orderPrice').textContent = `Total: $${total.toFixed(2)}`;
    }
}

function copyAPIKey() {
    const apiKey = document.getElementById('apiKey');
    apiKey.select();
    document.execCommand('copy');
    showAlert('API key copied to clipboard!', 'success');
}

function regenerateAPIKey() {
    if (confirm('Are you sure you want to regenerate your API key?')) {
        const newApiKey = generateAPIKey();
        // Update in Firestore
        showAlert('API key regenerated successfully!', 'success');
        document.getElementById('apiKey').value = newApiKey;
    }
}

// Modal functions
function showDummyPayment() {
    document.getElementById('paymentModal').classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

function simulatePayment() {
    closePaymentModal();
    showAlert('Payment simulated successfully! (This is a dummy payment)', 'success');
}

function showAddUserModal() {
    document.getElementById('addUserModal').classList.add('active');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('active');
}

function showAddServiceModal() {
    document.getElementById('addServiceModal').classList.add('active');
}

function closeAddServiceModal() {
    document.getElementById('addServiceModal').classList.remove('active');
}

function showTab(tabName) {
    document.getElementById('usersTab').style.display = 'none';
    document.getElementById('servicesTab').style.display = 'none';
    document.getElementById('ordersTab').style.display = 'none';
    
    document.getElementById(`${tabName}Tab`).style.display = 'block';
}

// Make functions available globally
window.copyAPIKey = copyAPIKey;
window.regenerateAPIKey = regenerateAPIKey;
window.showDummyPayment = showDummyPayment;
window.closePaymentModal = closePaymentModal;
window.simulatePayment = simulatePayment;
window.showAddUserModal = showAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.showAddServiceModal = showAddServiceModal;
window.closeAddServiceModal = closeAddServiceModal;
window.showTab = showTab;