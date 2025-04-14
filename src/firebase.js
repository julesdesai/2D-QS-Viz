import { initializeApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyB8GNZzJ1mYWaK9O87PPdruBYaFp1BDWRM",
    authDomain: "inquiry-complex.firebaseapp.com",
    projectId: "inquiry-complex",
    storageBucket: "inquiry-complex.firebasestorage.app",
    messagingSenderId: "792264989863",
    appId: "1:792264989863:web:5496f1938fe00b6bc60f82"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const storage = getStorage(app); 