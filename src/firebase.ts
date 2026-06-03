import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRTgfnpaxEDygnSYx3IoCGWziRqzfUbw4",
  authDomain: "hinata-app-76745.firebaseapp.com",
  projectId: "hinata-app-76745",
  storageBucket: "hinata-app-76745.firebasestorage.app",
  messagingSenderId: "1010552036087",
  appId: "1:1010552036087:web:25b477cda0913afa5011f2",
  measurementId: "G-YSY8Z46PVH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
