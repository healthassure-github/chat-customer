import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import CustomerConsole from "./components/CustomerConsole";
import { configureApiClient } from "./lib/api";
import { configureFirebase } from "./lib/firebase";
import { ToastProvider } from "./ui/ToastContext";

const SESSION_ROLE_KEY = "ha_chat_customer_session_role";

const getSessionStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

const normalizeApiBaseUrl = (value = "") => String(value || "").trim().replace(/\/$/, "");

export default function CustomerChat({
  apiBaseUrl = "",
  firebaseConfig = {},
  appointmentId = "",
  conversationId = "",
  customerId = "",
  chatType = "",
  onConversationIdChange,
  className = ""
}) {
  const sessionStorageRef = getSessionStorage();
  const [authUser, setAuthUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [sessionRole, setSessionRole] = useState(
    () => sessionStorageRef?.getItem(SESSION_ROLE_KEY) || null
  );

  const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  useEffect(() => {
    configureApiClient(normalizedApiBaseUrl);
  }, [normalizedApiBaseUrl]);

  const firebaseConfigKey = useMemo(
    () => JSON.stringify(firebaseConfig || {}),
    [firebaseConfig]
  );
  const firebaseClients = useMemo(
    () => configureFirebase(firebaseConfig || {}),
    [firebaseConfigKey]
  );

  useEffect(() => {
    setAuthReady(false);
    if (!firebaseClients.auth) {
      setAuthUser(null);
      setAuthReady(true);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(firebaseClients.auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [firebaseClients.auth]);

  useEffect(() => {
    if (!sessionStorageRef) return;
    if (sessionRole) {
      sessionStorageRef.setItem(SESSION_ROLE_KEY, sessionRole);
    } else {
      sessionStorageRef.removeItem(SESSION_ROLE_KEY);
    }
  }, [sessionRole, sessionStorageRef]);

  const mode = chatType || (appointmentId ? "doctor" : "support");
  const firebaseMissing = !firebaseClients.hasConfig;
  const apiMissing = !normalizedApiBaseUrl;

  if (firebaseMissing || apiMissing) {
    return (
      <div
        className={`ha-chat-customer-root flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-900 px-4 py-3 text-sm text-slate-100 ${className}`.trim()}
      >
        <strong>Setup required.</strong>
        <span>
          Pass valid <code className="rounded bg-white/10 px-1 py-0.5">apiBaseUrl</code>
          {" "}and <code className="rounded bg-white/10 px-1 py-0.5">firebaseConfig</code>.
        </span>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className={`ha-chat-customer-root h-full w-full ${className}`.trim()}>
        <CustomerConsole
          authUser={authUser}
          authReady={authReady}
          sessionRole={sessionRole}
          setSessionRole={setSessionRole}
          conversationIdProp={conversationId || ""}
          chatType={mode}
          appointmentIdProp={appointmentId || ""}
          customerId={customerId || ""}
          onConversationIdChange={onConversationIdChange}
        />
      </div>
    </ToastProvider>
  );
}
