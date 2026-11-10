/**
 * Konfigurasi Firebase - Kasirku by Agsstwn
 * File ini memuat konfigurasi dari firebase-applet-config.json
 * Anda dapat mengedit nilai di bawah ini jika ingin mengganti project Firebase Anda.
 */
import rawConfig from '../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: rawConfig.apiKey || "AIzaSyBberhLjw99PjsZ54izYTC1T7Mty6Jwvj0",
  authDomain: rawConfig.authDomain || "gen-lang-client-0720990737.firebaseapp.com",
  projectId: rawConfig.projectId || "gen-lang-client-0720990737",
  storageBucket: rawConfig.storageBucket || "gen-lang-client-0720990737.firebasestorage.app",
  messagingSenderId: rawConfig.messagingSenderId || "579548324803",
  appId: rawConfig.appId || "1:579548324803:web:e4b127786e704379e3d376",
  firestoreDatabaseId: rawConfig.firestoreDatabaseId || "ai-studio-kasirkubyagsstwn-e0b50d5d-9eb6-4228-bc77-75ee37ac3b5b"
};

export default firebaseConfig;
