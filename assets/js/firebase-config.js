// Firebase config and initialization (exports Firestore `db`)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAU96hFLomAtATR2diOSq4-_rJBWr_g5zE",
  authDomain: "ken-github.firebaseapp.com",
  databaseURL: "https://ken-github-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ken-github",
  storageBucket: "ken-github.firebasestorage.app",
  messagingSenderId: "501229830621",
  appId: "1:501229830621:web:abd5664f0138164f6d7634",
  measurementId: "G-V24YXHSMDD"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
