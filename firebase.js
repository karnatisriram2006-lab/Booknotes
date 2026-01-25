
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Function to check if all required environment variables are set
function checkFirebaseConfig(config) {
    for (const [key, value] of Object.entries(config)) {
        if (!value) {
            throw new Error(`Missing Firebase config value for: ${key}. Please check your .env file.`);
        }
    }
}

let db;

try {
    // Check for all required config values
    checkFirebaseConfig(firebaseConfig);

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully.");

} catch (error) {
    console.error("Failed to initialize Firebase:", error.message);
    // Exit the process if Firebase initialization fails, as the app cannot run without it.
    process.exit(1); 
}

export { db };
