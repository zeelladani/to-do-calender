// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    collection, 
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA3Pxcs_8vKKOOpZkMFQPA4yiKoXvh1zEI",
    authDomain: "task-calendar-585ae.firebaseapp.com",
    projectId: "task-calendar-585ae",
    storageBucket: "task-calendar-585ae.firebasestorage.app",
    messagingSenderId: "585666687552",
    appId: "1:585666687552:web:189944fea308f3d87325a5",
    measurementId: "G-Z5DQJ7FZK5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements - Auth
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const resetForm = document.getElementById('reset-form');
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');
const forgotPassword = document.getElementById('forgot-password');
const backToLogin = document.getElementById('back-to-login');
const loginError = document.getElementById('login-error');
const loginSuccess = document.getElementById('login-success');
const signupError = document.getElementById('signup-error');
const signupSuccess = document.getElementById('signup-success');
const resetMessage = document.getElementById('reset-message');
const userEmailDisplay = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const passwordToggles = document.querySelectorAll('.password-toggle');

// DOM Elements - App
const calendarDays = document.getElementById('calendar-days');
const monthYear = document.getElementById('month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const selectedDateEl = document.getElementById('selected-date');
const newTaskInput = document.getElementById('new-task');
const addTaskBtn = document.getElementById('add-task');
const taskList = document.getElementById('task-list');
const filterBtns = document.querySelectorAll('.filter-btn');
const clearCompletedBtn = document.getElementById('clear-completed');
const themeIcon = document.getElementById('theme-icon');

// DOM Elements - Common Tasks
const newCommonTaskInput = document.getElementById('new-common-task');
const addCommonTaskBtn = document.getElementById('add-common-task');
const commonTaskList = document.getElementById('common-task-list');
const commonFilterBtns = document.querySelectorAll('.common-filter-btn');
const clearCommonCompletedBtn = document.getElementById('clear-common-completed');

// DOM Elements - Notification
const notificationToast = document.getElementById('notification-toast');
const notificationIcon = document.getElementById('notification-icon');
const notificationMessage = document.getElementById('notification-message');
const closeNotification = document.getElementById('close-notification');

// State variables
let currentDate = new Date();
let selectedDate = new Date();
let currentFilter = 'all';
let currentCommonFilter = 'all';
let currentUser = null;
let tasksCache = {}; // Cache for tasks to reduce database calls
let commonTasksCache = []; // Cache for common tasks
let autoLogoutTimer = null; // Timer for auto-logout

// Get the loading overlay
const loadingOverlay = document.querySelector('.loading-overlay');

// Helper function to show loading
function showLoading() {
    loadingOverlay.classList.add('active');
}

// Helper function to hide loading
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

// Helper function to show notification
function showNotification(message, type = 'success') {
    notificationMessage.textContent = message;
    
    if (type === 'success') {
        notificationIcon.className = 'fas fa-check-circle';
        notificationToast.className = 'notification-toast show success';
    } else {
        notificationIcon.className = 'fas fa-exclamation-circle';
        notificationToast.className = 'notification-toast show error';
    }
    
    setTimeout(() => {
        notificationToast.classList.remove('show');
    }, 5000);
}

// Close notification
closeNotification.addEventListener('click', () => {
    notificationToast.classList.remove('show');
});

// Helper function to capitalize first letter of first word
function capitalizeFirstWord(text) {
    if (!text || typeof text !== 'string') return '';
    const words = text.split(' ');
    if (words.length === 0) return text;
    
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
    return words.join(' ');
}

// Helper function to format date as key
function formatDateKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Helper function to get today's date as key
function getTodayDateKey() {
    const today = new Date();
    return formatDateKey(today);
}

// Helper function to get the next midnight timestamp
function getNextMidnightTimestamp() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
}

// Helper function to set last login time and next logout time
function updateLoginTimes() {
    const now = new Date();
    const todayDateKey = getTodayDateKey();
    
    localStorage.setItem('lastLoginTime', now.toString());
    localStorage.setItem('lastLoginDate', todayDateKey);
    
    const nextMidnight = getNextMidnightTimestamp();
    localStorage.setItem('nextLogoutTime', nextMidnight.toString());
    
    // Set auto logout timer
    setupAutoLogout();
}

// Check if the user should be logged out due to date change
function checkDateChangeLogout() {
    if (!currentUser) return false;
    
    const lastLoginDate = localStorage.getItem('lastLoginDate');
    const todayDateKey = getTodayDateKey();
    
    // If there's no last login date, update it to today
    if (!lastLoginDate) {
        localStorage.setItem('lastLoginDate', todayDateKey);
        return false;
    }
    
    // If the date has changed since last login, log out
    if (lastLoginDate !== todayDateKey) {
        console.log('Date changed since last login. Auto-logout triggered.');
        return true;
    }
    
    return false;
}

// Set up auto logout timer
function setupAutoLogout() {
    // Clear any existing timer
    if (autoLogoutTimer) {
        clearTimeout(autoLogoutTimer);
    }
    
    const nextLogoutTime = parseInt(localStorage.getItem('nextLogoutTime') || '0');
    const now = Date.now();
    
    if (nextLogoutTime > now) {
        const timeUntilLogout = nextLogoutTime - now;
        console.log(`Auto logout scheduled in ${Math.round(timeUntilLogout/1000/60)} minutes`);
        
        autoLogoutTimer = setTimeout(() => {
            console.log("Auto logout triggered at midnight");
            if (currentUser) {
                signOut(auth).then(() => {
                    localStorage.removeItem('lastLoginTime');
                    localStorage.removeItem('nextLogoutTime');
                    localStorage.removeItem('lastLoginDate');
                    showNotification('Session expired at midnight. Please login again.', 'error');
                }).catch(error => {
                    console.error('Auto-logout error:', error);
                });
            }
        }, timeUntilLogout);
    }
}

// Password visibility toggle
passwordToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
        const passwordInput = toggle.parentElement.querySelector('input');
        const icon = toggle.querySelector('i');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.className = 'fa-solid fa-eye';
        } else {
            passwordInput.type = 'password';
            icon.className = 'fa-solid fa-eye-slash';
        }
    });
});

// Auth tab switching
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    resetForm.style.display = 'none';
    loginError.textContent = '';
    loginSuccess.textContent = '';
});

signupTab.addEventListener('click', () => {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.style.display = 'block';
    loginForm.style.display = 'none';
    resetForm.style.display = 'none';
    signupError.textContent = '';
    signupSuccess.textContent = '';
});

forgotPassword.addEventListener('click', () => {
    resetForm.style.display = 'block';
    loginForm.style.display = 'none';
    signupForm.style.display = 'none';
    resetMessage.textContent = '';
    resetForm.querySelector('input').value = '';
});

backToLogin.addEventListener('click', () => {
    loginForm.style.display = 'block';
    resetForm.style.display = 'none';
    loginTab.click();
});

// Auth Form Submissions
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        loginError.textContent = 'Please enter both email and password';
        return;
    }
    
    loginError.textContent = '';
    loginSuccess.textContent = '';
    showLoading();
    
    try {
        // Attempt to sign in
        await signInWithEmailAndPassword(auth, email, password);
        
        // Reset form and show success message
        loginForm.reset();
        loginSuccess.textContent = 'Login successful! Redirecting...';
        
        // Login time will be updated in onAuthStateChanged handler
        showNotification('Login successful!');
    } catch (error) {
        console.error('Login error:', error);
        
        // Improved error messages for common authentication errors
        let errorMessage = 'Login failed: ';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'No account with this email exists';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password';
                break;
            case 'auth/invalid-credential':
            case 'auth/invalid-login-credentials':
                errorMessage += 'Invalid email or password';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format';
                break;
            case 'auth/too-many-requests':
                errorMessage += 'Too many failed login attempts. Please try again later';
                break;
            default:
                errorMessage += error.message;
        }
        
        // Add a signup suggestion if user not found
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials') {
            errorMessage += '. Consider creating a new account';
            // Auto switch to signup tab after 2 seconds
            setTimeout(() => {
                signupTab.click();
            }, 2000);
        }
        
        loginError.textContent = errorMessage;
        showNotification(errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;
    
    if (!email || !password || !confirmPassword) {
        signupError.textContent = 'Please fill in all fields';
        return;
    }
    
    if (password !== confirmPassword) {
        signupError.textContent = 'Passwords do not match';
        return;
    }
    
    // Basic password validation
    if (password.length < 6) {
        signupError.textContent = 'Password must be at least 6 characters long';
        return;
    }
    
    signupError.textContent = '';
    signupSuccess.textContent = '';
    showLoading();
    
    try {
        // Create user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user document in Firestore with common tasks array embedded
        await setDoc(doc(db, 'users', user.uid), {
            email: user.email,
            createdAt: new Date().toISOString(),
            commonTasks: [] // Store common tasks here instead of a separate collection
        });
        
        // Reset form and show success
        signupForm.reset();
        signupSuccess.textContent = 'Account created successfully! You can now login.';
        
        // Auto switch to login tab after 2 seconds
        setTimeout(() => {
            loginTab.click();
        }, 2000);
        
        showNotification('Account created successfully!');
    } catch (error) {
        console.error('Signup error:', error);
        
        // Improved error messages for common signup errors
        let errorMessage = 'Signup failed: ';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'This email is already registered';
                // Add a suggestion to log in instead
                errorMessage += '. Try logging in instead';
                // Auto switch to login tab after 2 seconds
                setTimeout(() => {
                    loginTab.click();
                }, 2000);
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid email format';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password is too weak. Use at least 6 characters';
                break;
            case 'auth/network-request-failed':
                errorMessage += 'Network error. Check your internet connection';
                break;
            default:
                errorMessage += error.message;
        }
        
        signupError.textContent = errorMessage;
        showNotification(errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value.trim();
    
    if (!email) {
        resetMessage.textContent = 'Please enter your email';
        resetMessage.style.color = 'var(--error-color)';
        return;
    }
    
    showLoading();
    try {
        await sendPasswordResetEmail(auth, email);
        resetMessage.textContent = 'Password reset email sent! Check your inbox.';
        resetMessage.style.color = 'var(--success-color)';
        showNotification('Password reset email sent!');
    } catch (error) {
        console.error('Reset error:', error);
        
        // Improved error messages for password reset
        let errorMessage = '';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account with this email exists';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email format';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Check your internet connection';
                break;
            default:
                errorMessage = error.message;
        }
        
        resetMessage.textContent = errorMessage;
        resetMessage.style.color = 'var(--error-color)';
        showNotification('Password reset failed: ' + errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // Clear the timer and login info on manual logout
        if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
            autoLogoutTimer = null;
        }
        localStorage.removeItem('lastLoginTime');
        localStorage.removeItem('nextLogoutTime');
        localStorage.removeItem('lastLoginDate');
        showNotification('Logged out successfully!');
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Logout failed: ' + error.message, 'error');
    }
});

// Auth state observer
onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed:", user ? "User logged in" : "No user");
    showLoading();
    
    if (user) {
        // Check if the date has changed since last login
        if (checkDateChangeLogout()) {
            // If date has changed, log out the user
            try {
                await signOut(auth);
                localStorage.removeItem('lastLoginTime');
                localStorage.removeItem('nextLogoutTime');
                localStorage.removeItem('lastLoginDate');
                showNotification('A new day has begun. Please log in again.', 'error');
                hideLoading();
                return;
            } catch (error) {
                console.error('Date change logout error:', error);
            }
        }
        
        // User is signed in
        currentUser = user;
        userEmailDisplay.textContent = user.email;
        
        // Show app container, hide auth container
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        
        // Update login time and set up auto-logout at midnight
        updateLoginTimes();
        
        try {
            // Load user tasks from Firestore
            const tasksData = await loadTasks();
            tasksCache = tasksData || {};
            
            // Load common tasks
            await loadCommonTasks();
            
            renderCalendar();
            updateSelectedDate();
            renderTasks();
            renderCommonTasks();
        } catch (error) {
            console.error("Error loading initial data:", error);
            showNotification("Error loading tasks. Please refresh the page.", "error");
        }
    } else {
        // User is signed out
        currentUser = null;
        tasksCache = {};
        commonTasksCache = [];
        
        // Clear auto-logout timer
        if (autoLogoutTimer) {
            clearTimeout(autoLogoutTimer);
            autoLogoutTimer = null;
        }
        
        // Show auth container, hide app container
        authContainer.style.display = 'flex';
        appContainer.style.display = 'none';
        
        // Reset forms
        loginForm.reset();
        signupForm.reset();
        resetForm.reset();
        loginError.textContent = '';
        loginSuccess.textContent = '';
        signupError.textContent = '';
        signupSuccess.textContent = '';
        resetMessage.textContent = '';
        
        // Show login form by default
        loginTab.click();
    }
    
    hideLoading();
});

// Load tasks from Firestore
async function loadTasks() {
    if (!currentUser) return {};
    
    try {
        const tasksSnapshot = await getDocs(collection(db, 'users', currentUser.uid, 'tasks'));
        const tasks = {};
        
        tasksSnapshot.forEach((doc) => {
            tasks[doc.id] = doc.data().tasks || [];
        });
        
        return tasks;
    } catch (error) {
        console.error('Error loading tasks:', error);
        showNotification('Error loading tasks. Please try again.', 'error');
        return {};
    }
}

// Load common tasks from Firestore - updated to use main user document
async function loadCommonTasks() {
    if (!currentUser) return;
    
    try {
        // Get the user document instead of a separate collection
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists() && userDoc.data().commonTasks) {
            // If user doc exists and has commonTasks array
            commonTasksCache = userDoc.data().commonTasks;
        } else {
            // Initialize common tasks if it doesn't exist
            commonTasksCache = [];
            
            // Create the commonTasks array in the user document if it doesn't exist
            await setDoc(doc(db, 'users', currentUser.uid), {
                commonTasks: []
            }, { merge: true });
        }
    } catch (error) {
        console.error('Error loading common tasks:', error);
        // Create a more friendly error message and don't show the notification
        console.log('Initializing empty common tasks due to loading error');
        commonTasksCache = [];
    }
}

// Save task to Firestore - optimized to avoid unnecessary loading
async function saveTask(dateKey, tasks) {
    if (!currentUser) return;
    
    try {
        // Update the cache first for immediate feedback
        tasksCache[dateKey] = [...tasks];
        
        const taskRef = doc(db, 'users', currentUser.uid, 'tasks', dateKey);
        await setDoc(taskRef, { tasks: tasks }, { merge: true });
    } catch (error) {
        console.error('Error saving task:', error);
        showNotification('Error saving task. Please try again.', 'error');
    }
}

// Save common tasks to Firestore
async function saveCommonTasks() {
    if (!currentUser) return;
    
    try {
        // Use setDoc with merge:true instead of updateDoc to ensure it works even if fields don't exist
        await setDoc(doc(db, 'users', currentUser.uid), {
            commonTasks: commonTasksCache
        }, { merge: true });
    } catch (error) {
        console.error('Error saving common tasks:', error);
        
        // Log more detailed error information
        if (error.code) {
            console.error('Error code:', error.code);
        }
        
        // Don't show notification for permission-denied errors to avoid frustrating users
        if (error.code !== 'permission-denied') {
            showNotification('Error saving common task. Please try again.', 'error');
        }
    }
}

// Delete date from Firestore if no tasks - optimized
async function deleteEmptyDate(dateKey) {
    if (!currentUser) return;
    
    try {
        // Update cache first
        delete tasksCache[dateKey];
        
        await deleteDoc(doc(db, 'users', currentUser.uid, 'tasks', dateKey));
    } catch (error) {
        console.error('Error deleting date:', error);
        showNotification('Error deleting tasks. Please try again.', 'error');
    }
}

// Calendar functions
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Update month and year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    monthYear.textContent = `${monthNames[month]} ${year}`;
    
    // Clear previous days
    calendarDays.innerHTML = '';
    
    // Get first day of month and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0-6)
    const firstDayIndex = firstDay.getDay();
    
    // Get the last date of previous month
    const prevLastDay = new Date(year, month, 0);
    const prevLastDate = prevLastDay.getDate();
    
    // Get the total days in current month
    const totalDays = lastDay.getDate();
    
    // Get the day of the week for the last day (0-6)
    const lastDayIndex = lastDay.getDay();
    
    // Calculate days from next month to display
    const nextDays = 7 - lastDayIndex - 1;
    
    // Render days from previous month
    for (let i = firstDayIndex; i > 0; i--) {
        const day = document.createElement('div');
        day.classList.add('day', 'other-month');
        day.textContent = prevLastDate - i + 1;
        
        const prevMonthDate = new Date(year, month - 1, prevLastDate - i + 1);
        const dateKey = formatDateKey(prevMonthDate);
        
        // Use cached data instead of fetching
        if (tasksCache[dateKey] && tasksCache[dateKey].length > 0) {
            day.classList.add('has-tasks');
        }
        
        day.addEventListener('click', () => {
            const newDate = new Date(year, month - 1, prevLastDate - i + 1);
            selectedDate = newDate;
            updateSelectedDate();
            renderCalendar();
            renderTasks();
        });
        calendarDays.appendChild(day);
    }
    
    // Render days of current month
    for (let i = 1; i <= totalDays; i++) {
        const day = document.createElement('div');
        day.classList.add('day');
        day.textContent = i;
        
        const currentMonthDate = new Date(year, month, i);
        const dateKey = formatDateKey(currentMonthDate);
        
        // Use cached data instead of fetching
        if (tasksCache[dateKey] && tasksCache[dateKey].length > 0) {
            day.classList.add('has-tasks');
        }
        
        // Check if this day is today
        const today = new Date();
        if (i === today.getDate() && month === today.getMonth() && year === today.getFullYear()) {
            day.classList.add('today');
        }
        
        // Check if this day is selected
        if (i === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()) {
            day.classList.add('selected');
        }
        
        // Add click event
        day.addEventListener('click', () => {
            selectedDate = new Date(year, month, i);
            updateSelectedDate();
            renderCalendar();
            renderTasks();
        });
        
        calendarDays.appendChild(day);
    }
    
    // Render days from next month
    for (let i = 1; i <= nextDays; i++) {
        const day = document.createElement('div');
        day.classList.add('day', 'other-month');
        day.textContent = i;
        
        const nextMonthDate = new Date(year, month + 1, i);
        const dateKey = formatDateKey(nextMonthDate);
        
        // Use cached data instead of fetching
        if (tasksCache[dateKey] && tasksCache[dateKey].length > 0) {
            day.classList.add('has-tasks');
        }
        
        day.addEventListener('click', () => {
            const newDate = new Date(year, month + 1, i);
            selectedDate = newDate;
            updateSelectedDate();
            renderCalendar();
            renderTasks();
        });
        calendarDays.appendChild(day);
    }
}

// Update the selected date display
function updateSelectedDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    selectedDateEl.textContent = selectedDate.toLocaleDateString('en-US', options);
}

// Task functions - optimized to use cache
async function renderTasks() {
    taskList.innerHTML = '';
    
    try {
        if (!currentUser) return;
        
        const dateKey = formatDateKey(selectedDate);
        let tasksForDate = [];
        
        // Use cache if available, otherwise fetch from Firestore
        if (dateKey in tasksCache) {
            tasksForDate = tasksCache[dateKey] || [];
        } else {
            const taskDoc = await getDoc(doc(db, 'users', currentUser.uid, 'tasks', dateKey));
            if (taskDoc.exists()) {
                tasksForDate = taskDoc.data().tasks || [];
                // Update cache
                tasksCache[dateKey] = [...tasksForDate];
            }
        }
        
        let filteredTasks = tasksForDate;
        
        if (currentFilter === 'active') {
            filteredTasks = tasksForDate.filter(task => !task.completed);
        } else if (currentFilter === 'completed') {
            filteredTasks = tasksForDate.filter(task => task.completed);
        }
        
        if (filteredTasks.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('empty-message');
            emptyMessage.textContent = currentFilter === 'all' 
                ? 'No tasks for this day. Add a task to get started!' 
                : `No ${currentFilter} tasks for this day.`;
            taskList.appendChild(emptyMessage);
            return;
        }
        
        filteredTasks.forEach((task, index) => {
            const taskItem = document.createElement('li');
            taskItem.classList.add('task-item');
            if (task.completed) {
                taskItem.classList.add('completed');
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('task-checkbox');
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => {
                // Find the actual index in the original array
                const originalIndex = tasksForDate.findIndex(t => t.id === task.id);
                toggleTaskCompletion(dateKey, originalIndex);
            });
            
            const taskContent = document.createElement('div');
            taskContent.classList.add('task-content');
            
            const taskText = document.createElement('div');
            taskText.classList.add('task-text');
            taskText.textContent = task.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-task');
            deleteBtn.title = 'Delete task';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', () => {
                // Find the actual index in the original array
                const originalIndex = tasksForDate.findIndex(t => t.id === task.id);
                deleteTask(dateKey, originalIndex);
            });
            
            taskContent.appendChild(taskText);
            
            taskItem.appendChild(checkbox);
            taskItem.appendChild(taskContent);
            taskItem.appendChild(deleteBtn);
            
            taskList.appendChild(taskItem);
        });
    } catch (error) {
        console.error('Error rendering tasks:', error);
        showNotification('Error loading tasks. Please try again.', 'error');
    }
}

// Render common tasks
function renderCommonTasks() {
    commonTaskList.innerHTML = '';
    
    try {
        if (!currentUser) return;
        
        let filteredTasks = [...commonTasksCache];
        
        if (currentCommonFilter === 'active') {
            filteredTasks = commonTasksCache.filter(task => !task.completed);
        } else if (currentCommonFilter === 'completed') {
            filteredTasks = commonTasksCache.filter(task => task.completed);
        }
        
        if (filteredTasks.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('empty-message');
            emptyMessage.textContent = currentCommonFilter === 'all' 
                ? 'No common tasks. Add a task to get started!' 
                : `No ${currentCommonFilter} common tasks.`;
            commonTaskList.appendChild(emptyMessage);
            return;
        }
        
        filteredTasks.forEach((task, index) => {
            const taskItem = document.createElement('li');
            taskItem.classList.add('task-item');
            if (task.completed) {
                taskItem.classList.add('completed');
            }
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('task-checkbox');
            checkbox.checked = task.completed;
            checkbox.addEventListener('change', () => {
                // Find the actual index in the original array
                const originalIndex = commonTasksCache.findIndex(t => t.id === task.id);
                toggleCommonTaskCompletion(originalIndex);
            });
            
            const taskContent = document.createElement('div');
            taskContent.classList.add('task-content');
            
            const taskText = document.createElement('div');
            taskText.classList.add('task-text');
            taskText.textContent = task.text;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-task');
            deleteBtn.title = 'Delete common task';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.addEventListener('click', () => {
                // Find the actual index in the original array
                const originalIndex = commonTasksCache.findIndex(t => t.id === task.id);
                deleteCommonTask(originalIndex);
            });
            
            taskContent.appendChild(taskText);
            
            taskItem.appendChild(checkbox);
            taskItem.appendChild(taskContent);
            taskItem.appendChild(deleteBtn);
            
            commonTaskList.appendChild(taskItem);
        });
    } catch (error) {
        console.error('Error rendering common tasks:', error);
        showNotification('Error loading common tasks. Please try again.', 'error');
    }
}

async function addTask() {
    if (!currentUser) return;
    
    const taskText = newTaskInput.value.trim();
    if (taskText === '') return;
    
    try {
        const dateKey = formatDateKey(selectedDate);
        
        // Get tasks from cache or create empty array
        let tasks = [];
        if (dateKey in tasksCache) {
            tasks = [...tasksCache[dateKey]];
        }
        
        // Add new task with capitalized first word
        const newTask = {
            id: Date.now().toString(),
            text: capitalizeFirstWord(taskText),
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        tasks.push(newTask);
        
        // Update cache immediately for responsiveness
        tasksCache[dateKey] = tasks;
        
        // Clear input and update UI immediately
        newTaskInput.value = '';
        renderTasks();
        renderCalendar();
        
        // Save to Firestore in background
        await saveTask(dateKey, tasks);
        showNotification('Task added successfully!');
    } catch (error) {
        console.error('Error adding task:', error);
        showNotification('Error adding task. Please try again.', 'error');
    }
}

// Add common task
async function addCommonTask() {
    if (!currentUser) return;
    
    const taskText = newCommonTaskInput.value.trim();
    if (taskText === '') return;
    
    try {
        // Add new common task with capitalized first word
        const newTask = {
            id: Date.now().toString(),
            text: capitalizeFirstWord(taskText),
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        // Update cache immediately
        commonTasksCache.push(newTask);
        
        // Clear input and update UI immediately
        newCommonTaskInput.value = '';
        renderCommonTasks();
        
        // Save to Firestore in background
        await saveCommonTasks();
        showNotification('Common task added successfully!');
    } catch (error) {
        console.error('Error adding common task:', error);
        showNotification('Error adding common task. Please try again.', 'error');
    }
}

async function toggleTaskCompletion(dateKey, index) {
    if (!currentUser) return;
    
    try {
        // Use cached tasks
        if (!(dateKey in tasksCache)) return;
        
        const tasks = [...tasksCache[dateKey]];
        
        if (tasks[index]) {
            tasks[index].completed = !tasks[index].completed;
            
            // Update cache immediately
            tasksCache[dateKey] = tasks;
            
            // Update UI immediately
            renderTasks();
            
            // Save to Firestore in background
            await saveTask(dateKey, tasks);
        }
    } catch (error) {
        console.error('Error toggling task completion:', error);
        showNotification('Error updating task. Please try again.', 'error');
    }
}

// Toggle common task completion
async function toggleCommonTaskCompletion(index) {
    if (!currentUser) return;
    
    try {
        if (index < 0 || index >= commonTasksCache.length) return;
        
        // Create a clean copy of the task to avoid potential circular references
        const task = { ...commonTasksCache[index] };
        task.completed = !task.completed;
        
        // Update cache with clean task object
        commonTasksCache[index] = task;
        
        // Update UI immediately
        renderCommonTasks();
        
        // Make a clean copy of the entire array for Firestore
        const cleanTasks = commonTasksCache.map(t => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
            createdAt: t.createdAt
        }));
        
        // Save the clean array to Firestore
        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                commonTasks: cleanTasks
            }, { merge: true });
        } catch (error) {
            // If error occurs, try again with a simpler array structure
            if (error.code === 'invalid-argument' || error.code === 'permission-denied') {
                const simpleTasks = cleanTasks.map(t => ({
                    id: t.id,
                    text: t.text,
                    completed: t.completed
                }));
                
                await setDoc(doc(db, 'users', currentUser.uid), {
                    commonTasks: simpleTasks
                }, { merge: true });
            } else {
                throw error; // Re-throw if it's not a format issue
            }
        }
    } catch (error) {
        console.error('Error toggling common task completion:', error);
        
        // Don't show notification for silent failures to avoid frustrating users
        if (error.code !== 'permission-denied') {
            showNotification('Error updating common task. Task saved locally only.', 'error');
        }
    }
}

async function deleteTask(dateKey, index) {
    if (!currentUser) return;
    
    try {
        // Use cached tasks
        if (!(dateKey in tasksCache)) return;
        
        let tasks = [...tasksCache[dateKey]];
        
        if (tasks[index]) {
            // Remove the task
            tasks.splice(index, 1);
            
            if (tasks.length === 0) {
                // Delete from cache if no tasks remain
                delete tasksCache[dateKey];
                
                // Delete from Firestore in background
                await deleteEmptyDate(dateKey);
            } else {
                // Update cache immediately
                tasksCache[dateKey] = tasks;
                
                // Save to Firestore in background
                await saveTask(dateKey, tasks);
            }
            
            // Update UI immediately
            renderTasks();
            renderCalendar();
            showNotification('Task deleted successfully!');
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Error deleting task. Please try again.', 'error');
    }
}

// Delete common task
async function deleteCommonTask(index) {
    if (!currentUser) return;
    
    try {
        if (index < 0 || index >= commonTasksCache.length) return;
        
        // Remove the task from cache
        commonTasksCache.splice(index, 1);
        
        // Update UI immediately
        renderCommonTasks();
        
        // Make a clean copy of the entire array for Firestore
        const cleanTasks = commonTasksCache.map(t => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
            createdAt: t.createdAt
        }));
        
        // Save to Firestore with cleaner data
        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                commonTasks: cleanTasks
            }, { merge: true });
            showNotification('Common task deleted successfully!');
        } catch (error) {
            // If error occurs, try with simpler structure
            if (error.code === 'invalid-argument' || error.code === 'permission-denied') {
                const simpleTasks = cleanTasks.map(t => ({
                    id: t.id,
                    text: t.text,
                    completed: t.completed
                }));
                
                await setDoc(doc(db, 'users', currentUser.uid), {
                    commonTasks: simpleTasks
                }, { merge: true });
                showNotification('Common task deleted successfully!');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error deleting common task:', error);
        // Don't show notification for silent failures
        if (error.code !== 'permission-denied') {
            showNotification('Error deleting common task. Please try again.', 'error');
        }
    }
}

async function clearCompletedTasks() {
    if (!currentUser) return;
    
    try {
        const dateKey = formatDateKey(selectedDate);
        
        // Use cached tasks
        if (!(dateKey in tasksCache)) return;
        
        let tasks = [...tasksCache[dateKey]];
        let completedCount = tasks.filter(task => task.completed).length;
        
        if (completedCount === 0) {
            showNotification('No completed tasks to clear.', 'error');
            return;
        }
        
        // Filter out completed tasks
        tasks = tasks.filter(task => !task.completed);
        
        if (tasks.length === 0) {
            // Delete from cache if no tasks remain
            delete tasksCache[dateKey];
            
            // Delete from Firestore in background
            await deleteEmptyDate(dateKey);
        } else {
            // Update cache immediately
            tasksCache[dateKey] = tasks;
            
            // Save to Firestore in background
            await saveTask(dateKey, tasks);
        }
        
        // Update UI immediately
        renderTasks();
        renderCalendar();
        showNotification('Completed tasks cleared successfully!');
    } catch (error) {
        console.error('Error clearing completed tasks:', error);
        showNotification('Error clearing tasks. Please try again.', 'error');
    }
}

// Clear completed common tasks
async function clearCompletedCommonTasks() {
    if (!currentUser) return;
    
    try {
        let completedCount = commonTasksCache.filter(task => task.completed).length;
        
        if (completedCount === 0) {
            showNotification('No completed common tasks to clear.', 'error');
            return;
        }
        
        // Filter out completed tasks
        const activeTasks = commonTasksCache.filter(task => !task.completed);
        
        // Update cache with only active tasks
        commonTasksCache = activeTasks;
        
        // Update UI immediately
        renderCommonTasks();
        
        // Make a clean copy for Firestore
        const cleanTasks = activeTasks.map(t => ({
            id: t.id,
            text: t.text,
            completed: t.completed,
            createdAt: t.createdAt
        }));
        
        // Save to Firestore with cleaner data
        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                commonTasks: cleanTasks
            }, { merge: true });
            showNotification('Completed common tasks cleared successfully!');
        } catch (error) {
            // If error occurs, try with simpler structure
            if (error.code === 'invalid-argument' || error.code === 'permission-denied') {
                const simpleTasks = cleanTasks.map(t => ({
                    id: t.id,
                    text: t.text,
                    completed: t.completed
                }));
                
                await setDoc(doc(db, 'users', currentUser.uid), {
                    commonTasks: simpleTasks
                }, { merge: true });
                showNotification('Completed common tasks cleared successfully!');
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error clearing completed common tasks:', error);
        // Don't show notification for silent failures
        if (error.code !== 'permission-denied') {
            showNotification('Error clearing common tasks. Please try again.', 'error');
        }
    }
}

// Event listeners
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

addTaskBtn.addEventListener('click', addTask);

newTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTask();
    }
});

// Common tasks event listeners
addCommonTaskBtn.addEventListener('click', addCommonTask);

newCommonTaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addCommonTask();
    }
});

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTasks();
    });
});

// Common tasks filter buttons
commonFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        commonFilterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCommonFilter = btn.dataset.filter;
        renderCommonTasks();
    });
});

clearCompletedBtn.addEventListener('click', clearCompletedTasks);

// Clear completed common tasks button
clearCommonCompletedBtn.addEventListener('click', clearCompletedCommonTasks);

// Theme toggle functionality
themeIcon.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    updateThemeIcon();
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
});

function updateThemeIcon() {
    if (document.body.classList.contains('dark-theme')) {
        themeIcon.className = 'fas fa-moon';
    } else {
        themeIcon.className = 'fas fa-sun';
    }
}

// Initialize theme from localStorage
function initTheme() {
    // If theme is not set in localStorage (first time user), default to dark theme
    if (localStorage.getItem('theme') === null) {
        localStorage.setItem('theme', 'dark');
        document.body.classList.add('dark-theme');
    } else if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    updateThemeIcon();
}

// Check for date change on page load/refresh
function checkDateChangeOnLoad() {
    const lastLoginDate = localStorage.getItem('lastLoginDate');
    if (lastLoginDate) {
        const todayDateKey = getTodayDateKey();
        if (lastLoginDate !== todayDateKey) {
            console.log('Date has changed since last session. Will trigger logout if user is authenticated.');
            // The actual logout happens in the onAuthStateChanged handler
        }
    }
}

// Initialize the app
initTheme();
checkDateChangeOnLoad();

// Setup auto-logout on page load if necessary
setupAutoLogout();

// Console message to verify script is loaded
console.log("Task Calendar application initialized successfully");