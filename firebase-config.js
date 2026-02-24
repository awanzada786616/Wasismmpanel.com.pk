// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA8iI7uZptTD7kmQ3KZFD-evTzzh36Vo-8",
    authDomain: "wasihosting.firebaseapp.com",
    projectId: "wasihosting",
    storageBucket: "wasihosting.firebasestorage.app",
    messagingSenderId: "983134727124",
    appId: ""1:983134727124:web:25914abca24ac1d1dd0441"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);