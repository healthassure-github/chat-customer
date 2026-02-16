import { getApps, initializeApp } from "firebase/app";
import { browserSessionPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const CHAT_APP_PREFIX = "ha-chat-customer";

export let app = null;
export let auth = null;
export let db = null;
export let rtdb = null;
export let storage = null;

function normalizeConfig(input = {}) {
  return {
    apiKey: input.apiKey || "",
    authDomain: input.authDomain || "",
    projectId: input.projectId || "",
    storageBucket: input.storageBucket || "",
    messagingSenderId: input.messagingSenderId || "",
    appId: input.appId || "",
    databaseURL: input.databaseURL || "",
    firestoreDatabase: input.firestoreDatabase || ""
  };
}

export function hasFirebaseConfig(config = {}) {
  const normalized = normalizeConfig(config);
  return Boolean(
    normalized.apiKey &&
      normalized.authDomain &&
      normalized.projectId &&
      normalized.appId
  );
}

function buildAppName(normalized) {
  const project = (normalized.projectId || "project").replace(/[^a-zA-Z0-9-]/g, "-");
  const appIdPart = (normalized.appId || "app")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .slice(-24);
  return `${CHAT_APP_PREFIX}-${project}-${appIdPart}`;
}

export function configureFirebase(config = {}) {
  const normalized = normalizeConfig(config);
  if (!hasFirebaseConfig(normalized)) {
    app = null;
    auth = null;
    db = null;
    rtdb = null;
    storage = null;
    return { app, auth, db, rtdb, storage, hasConfig: false };
  }

  const appName = buildAppName(normalized);
  const existing = getApps().find((item) => item.name === appName);
  app =
    existing ||
    initializeApp(
      {
        apiKey: normalized.apiKey,
        authDomain: normalized.authDomain,
        projectId: normalized.projectId,
        storageBucket: normalized.storageBucket,
        messagingSenderId: normalized.messagingSenderId,
        appId: normalized.appId,
        databaseURL: normalized.databaseURL
      },
      appName
    );

  auth = getAuth(app);
  db = normalized.firestoreDatabase
    ? getFirestore(app, normalized.firestoreDatabase)
    : getFirestore(app);
  rtdb = normalized.databaseURL
    ? getDatabase(app, normalized.databaseURL)
    : getDatabase(app);
  storage = getStorage(app);

  setPersistence(auth, browserSessionPersistence).catch(() => {});

  return { app, auth, db, rtdb, storage, hasConfig: true };
}

export function getFirebaseClients() {
  return { app, auth, db, rtdb, storage };
}
