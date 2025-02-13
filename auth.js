// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBZzqOAeB4yclKluaFxjRRN2OZVVAM66LU",
    authDomain: "students-fae3c.firebaseapp.com",
    projectId: "students-fae3c",
    storageBucket: "students-fae3c.firebasestorage.app",
    messagingSenderId: "882805671020",
    appId: "1:882805671020:web:6e65219a0779ad046ec449",
    measurementId: "G-03NELEPK0H"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Toggle between login and signup forms
function toggleForms() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    
    loginForm.style.display = loginForm.style.display === 'none' ? 'block' : 'none';
    signupForm.style.display = signupForm.style.display === 'none' ? 'block' : 'none';
}

// Login function
async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = 'contact.html';
    } catch (error) {
        alert(error.message);
    }
}

// Signup function
async function signup() {
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    try {
        await auth.createUserWithEmailAndPassword(email, password);
        window.location.href = 'index.html';
    } catch (error) {
        alert(error.message);
    }
}

// Check auth state
auth.onAuthStateChanged(user => {
    if (user && window.location.pathname.includes('login.html')) {
        window.location.href = 'index.html';
    }
});
