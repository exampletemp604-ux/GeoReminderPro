import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBr0rtcj32T4qq60zhvG8iLdmq2bIJnnZ4",
  authDomain: "georeminderpro.firebaseapp.com",
  projectId: "georeminderpro",
  storageBucket: "georeminderpro.firebasestorage.app",
  messagingSenderId: "484979776213",
  appId: "1:484979776213:web:b212cb67404c70bef7205c",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
