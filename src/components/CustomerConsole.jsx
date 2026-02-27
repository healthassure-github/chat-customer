import { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { signInWithCustomToken, signOut } from "firebase/auth";
import {
  getAgentToken,
  getArchivedConversationByAppointment,
  getGuestToken,
  markConversationRead,
  startConversation
} from "../lib/api";
import { auth, db, rtdb, storage } from "../lib/firebase";
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set
} from "firebase/database";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { TYPING_DEBOUNCE_MS } from "../lib/typing";
import { Spacer } from "../ui/Spacer";
import Badge from "../ui/Badge";
import { Card } from "../ui/Card";
import { ThemeToggleCompact } from "../ui/ThemeToggleCompact";
import {
  AttachmentList,
  PendingAttachmentList,
  buildPendingAttachment,
  isAllowedAttachment,
  sanitizeFileName
} from "./AttachmentList";
import VoiceRecorderButton from "./VoiceRecorderButton";

const LOCAL_KEYS = {
  customerConversationSupport: "chat_ui_customer_conversation_id_support",
  customerConversationSupportLegacy: "chat_ui_customer_conversation_id",
  customerConversationDoctorPrefix: "chat_ui_customer_conversation_id_doctor_"
};

const getSessionStorage = () => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
};

const buttonClasses = {
  primary:
    "rounded-md bg-blue-700 dark:bg-blue-300 px-4 py-2 text-sm font-semibold text-white dark:text-slate-950 shadow-xs transition hover:bg-blue-800 dark:hover:bg-blue-200 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
  ghost:
    "rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
};

const inputBase =
  "box-border rounded-md border border-slate-200 bg-white dark:bg-slate-950 px-2 py-2 text-xs text-slate-950 dark:text-slate-50 shadow-xs focus:border-blue-700 dark:focus:border-blue-300 focus:outline-none";

const READ_RECEIPT_DEBOUNCE_MS = 800;
const THEME_KEY = "ha_chat_customer_theme";

const readInitialTheme = () => {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches || false;
};

const formatTime = (value) => {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  const dateDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.floor((startOfToday - dateDayStart) / 86400000);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
  const weekdayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long"
  }).format(date);

  if (dayDiff === 0) {
    return `Today (${weekdayLabel}) - ${timeLabel}`;
  }
  if (dayDiff === 1) {
    return `Yesterday (${weekdayLabel}) - ${timeLabel}`;
  }
  if (dayDiff >= 2 && dayDiff <= 6) {
    return `${weekdayLabel} - ${timeLabel}`;
  }

  const dateParts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).formatToParts(date);
  const day = dateParts.find((part) => part.type === "day")?.value;
  const month = dateParts.find((part) => part.type === "month")?.value;
  const year = dateParts.find((part) => part.type === "year")?.value;
  const dateLabel = day && month && year ? `${day} ${month}, ${year}` : "";
  return `${dateLabel || date.toLocaleDateString()} - ${timeLabel}`;
};

const formatRelativeTime = (value) => {
  if (!value) return "";
  const date = value.toDate ? value.toDate() : new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return "";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

const friendlyBody = (body) => {
  if (body === undefined || body === null) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body);
};

const randomId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg_${Math.random().toString(36).slice(2)}`;
};

const readStoredUserId = () => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("user_id");
  } catch {
    return null;
  }
};

const isNearBottom = (element, threshold = 48) => {
  if (!element) return true;
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
  );
};

export default function CustomerConsole({
  authUser,
  authReady,
  sessionRole,
  setSessionRole,
  conversationIdProp,
  chatType,
  appointmentIdProp,
  customerId,
  onConversationIdChange
}) {
  const sessionStorageRef = getSessionStorage();
  const customerMode = chatType === "doctor" ? "doctor" : "support";
  const [appointmentId, setAppointmentId] = useState(appointmentIdProp || "");
  const resolveStoredConversationId = (mode, apptId) => {
    if (mode === "doctor") {
      if (!apptId) return "";
      return (
        sessionStorageRef?.getItem(
          `${LOCAL_KEYS.customerConversationDoctorPrefix}${apptId}`
        ) ||
        ""
      );
    }
    return (
      sessionStorageRef?.getItem(LOCAL_KEYS.customerConversationSupport) ||
      sessionStorageRef?.getItem(LOCAL_KEYS.customerConversationSupportLegacy) ||
      ""
    );
  };
  const [conversationId, setConversationId] = useState(
    conversationIdProp || resolveStoredConversationId(customerMode, appointmentIdProp)
  );
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [archivedConversation, setArchivedConversation] = useState(null);
  const [archivedMessages, setArchivedMessages] = useState([]);
  const archivedFetchRef = useRef("");
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const pendingAttachmentsRef = useRef([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const [typingNotice, setTypingNotice] = useState("");
  const messagesListRef = useRef(null);
  const isAutoScrollRef = useRef(true);
  const activeConversationIdRef = useRef("");
  const liveUnsubscribersRef = useRef({ conversation: null, messages: null });
  const closingConversationRef = useRef(false);
  const recentlyClosedRef = useRef({ id: "", at: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const lastMessageCountRef = useRef(0);
  const lastReadMessageIdRef = useRef(null);
  const readReceiptTimerRef = useRef(null);
  const [storedUserId, setStoredUserId] = useState(() => readStoredUserId() || "");
  const [isDarkMode, setIsDarkMode] = useState(readInitialTheme);
  const effectiveUserId = customerId ? String(customerId) : storedUserId || readStoredUserId() || "";
  const autoConnectAttempted = useRef(false);
  const prevAppointmentIdRef = useRef(appointmentIdProp || "");
  const isArchivedView = Boolean(archivedConversation);
  const displayConversation = archivedConversation || conversation;
  const displayMessages = isArchivedView ? archivedMessages : messages;
  const conversationType = displayConversation?.type || customerMode;
  const otherRoleLabel = conversationType === "doctor" ? "Doctor" : "Agent";
  const otherLastReadAt =
    conversationType === "doctor"
      ? displayConversation?.doctor_last_read_at
      : displayConversation?.agent_last_read_at;
  const otherLastReadText = otherLastReadAt
    ? `Last read by ${otherRoleLabel} ${formatRelativeTime(otherLastReadAt)}`
    : `${otherRoleLabel} has not read yet.`;
  const typingChannelKey = conversationId;

  const teardownLiveListeners = (resetActive = false) => {
    const { conversation: unsubConversation, messages: unsubMessages } =
      liveUnsubscribersRef.current;
    liveUnsubscribersRef.current = { conversation: null, messages: null };
    if (typeof unsubConversation === "function") {
      try {
        unsubConversation();
      } catch {
        // Ignore listener teardown errors.
      }
    }
    if (typeof unsubMessages === "function") {
      try {
        unsubMessages();
      } catch {
        // Ignore listener teardown errors.
      }
    }
    if (resetActive) {
      activeConversationIdRef.current = "";
    }
  };

  const isInternalAssertionError = (err) => {
    const message = String(err?.message || err || "");
    return (
      message.includes("INTERNAL ASSERTION FAILED") ||
      (message.includes("Unexpected state") && message.includes("FIRESTORE"))
    );
  };

  const markRecentlyClosed = (id) => {
    if (!id) return;
    recentlyClosedRef.current = { id, at: Date.now() };
  };

  const isRecentlyClosed = (id) => {
    if (!id) return false;
    const snapshot = recentlyClosedRef.current;
    return snapshot.id === id && Date.now() - snapshot.at < 15000;
  };

  useEffect(() => {
    if (typeof onConversationIdChange !== "function") return;
    onConversationIdChange(conversationId || "");
  }, [conversationId, onConversationIdChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_KEY, isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (appointmentIdProp !== undefined && appointmentIdProp !== appointmentId) {
      setAppointmentId(appointmentIdProp || "");
    }
  }, [appointmentIdProp, appointmentId]);

  useEffect(() => {
    if (customerMode !== "doctor") return;
    const currentAppointmentId = appointmentIdProp || "";
    if (prevAppointmentIdRef.current === currentAppointmentId) return;
    prevAppointmentIdRef.current = currentAppointmentId;
    if (conversationIdProp && !isRecentlyClosed(conversationIdProp)) {
      setConversationId(conversationIdProp);
      return;
    }
    const stored = resolveStoredConversationId(customerMode, currentAppointmentId);
    if (stored && isRecentlyClosed(stored)) {
      setConversationId("");
      return;
    }
    setConversationId(stored || "");
  }, [customerMode, appointmentIdProp, conversationIdProp]);

  useEffect(() => {
    if (
      conversationIdProp &&
      conversationIdProp !== conversationId &&
      !isRecentlyClosed(conversationIdProp)
    ) {
      setConversationId(conversationIdProp);
      return;
    }
    if (!conversationIdProp) {
      const stored = resolveStoredConversationId(
        customerMode,
        appointmentIdProp || appointmentId
      );
      if (stored && stored !== conversationId && !isRecentlyClosed(stored)) {
        setConversationId(stored);
      }
    }
  }, [conversationIdProp, conversationId, customerMode, appointmentIdProp, appointmentId]);

  useEffect(() => {
    if (!sessionStorageRef) return;
    if (customerMode === "doctor") {
      if (!appointmentId) return;
      const key = `${LOCAL_KEYS.customerConversationDoctorPrefix}${appointmentId}`;
      if (conversationId) {
        sessionStorageRef.setItem(key, conversationId || "");
      } else {
        sessionStorageRef.removeItem(key);
      }
      return;
    }

    if (conversationId) {
      sessionStorageRef.setItem(LOCAL_KEYS.customerConversationSupport, conversationId);
      sessionStorageRef.removeItem(LOCAL_KEYS.customerConversationSupportLegacy);
    } else {
      sessionStorageRef.removeItem(LOCAL_KEYS.customerConversationSupport);
    }
  }, [conversationId, customerMode, appointmentId, sessionStorageRef]);

  useEffect(() => {
    if (!authUser || sessionRole !== "customer") {
      setConversationId("");
      setConversation(null);
      setMessages([]);
    }
  }, [authUser, sessionRole]);

  useEffect(() => {
    if (readReceiptTimerRef.current) {
      clearTimeout(readReceiptTimerRef.current);
    }
    closingConversationRef.current = false;
    if (!conversationId || !messagesListRef.current) return;
    isAutoScrollRef.current = true;
    setUnreadCount(0);
    lastMessageCountRef.current = 0;
    lastReadMessageIdRef.current = null;
    requestAnimationFrame(() => {
      if (messagesListRef.current) {
        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
      }
    });
  }, [conversationId]);

  useEffect(() => {
    if (!isArchivedView || !messagesListRef.current) return;
    requestAnimationFrame(() => {
      if (messagesListRef.current) {
        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
      }
    });
  }, [isArchivedView, archivedMessages]);

  useEffect(() => {
    if (!conversationId || !messagesListRef.current) return;
    if (!isAutoScrollRef.current) return;
    requestAnimationFrame(() => {
      if (messagesListRef.current) {
        messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
      }
    });
    setUnreadCount(0);
  }, [messages, conversationId]);

  useEffect(() => {
    if (!conversationId) {
      setUnreadCount(0);
      lastMessageCountRef.current = 0;
      return;
    }
    const currentCount = messages.length;
    const prevCount = lastMessageCountRef.current;
    lastMessageCountRef.current = currentCount;
    if (currentCount <= prevCount) return;
    if (isAutoScrollRef.current) {
      setUnreadCount(0);
      return;
    }
    setUnreadCount((prev) => prev + (currentCount - prevCount));
  }, [messages, conversationId]);

  const scheduleReadReceipt = () => {
    if (!authUser || sessionRole !== "customer") return;
    if (isArchivedView) return;
    if (closingConversationRef.current) return;
    if (conversation?.status === "closed") return;
    if (!conversationId || !messages.length) return;
    if (!isAutoScrollRef.current) return;
    const lastMessageId = messages[messages.length - 1]?.id;
    if (!lastMessageId || lastReadMessageIdRef.current === lastMessageId) return;
    const totalCount = Number.isFinite(conversation?.message_count)
      ? conversation.message_count
      : messages.length;
    if (readReceiptTimerRef.current) {
      clearTimeout(readReceiptTimerRef.current);
    }
    readReceiptTimerRef.current = setTimeout(async () => {
      try {
        const idToken = await authUser.getIdToken();
        await markConversationRead({ idToken, conversationId });
        lastReadMessageIdRef.current = lastMessageId;
      } catch {
        // Ignore read receipt failures.
      }
    }, READ_RECEIPT_DEBOUNCE_MS);
  };

  useEffect(() => {
    scheduleReadReceipt();
  }, [authUser, sessionRole, conversationId, messages, conversation]);

  useEffect(() => {
    return () => {
      if (readReceiptTimerRef.current) {
        clearTimeout(readReceiptTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event || event.key === "user_id") {
        setStoredUserId(readStoredUserId() || "");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    return () => {
      teardownLiveListeners(true);
    };
  }, []);

  useEffect(() => {
    if (!typingChannelKey || !authUser || sessionRole !== "customer") return undefined;
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      if (typingActiveRef.current) {
        const typingRef = ref(rtdb, `typing/${typingChannelKey}/${authUser.uid}`);
        set(typingRef, {
          typing: false,
          role: "customer",
          updated_at: rtdbServerTimestamp()
        });
        typingActiveRef.current = false;
      }
    };
  }, [typingChannelKey, authUser, sessionRole]);

  useEffect(() => {
    if (!typingChannelKey) {
      setTypingNotice("");
      return undefined;
    }
    if (!authUser || sessionRole !== "customer") {
      setTypingNotice("");
      return undefined;
    }
    if (isArchivedView) {
      setTypingNotice("");
      return undefined;
    }
    const typingRef = ref(rtdb, `typing/${typingChannelKey}`);
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val() || {};
      const rolesTyping = Object.values(data)
        .filter((entry) => entry && entry.typing && entry.role !== "customer")
        .map((entry) => entry.role);
      if (!rolesTyping.length) {
        setTypingNotice("");
        return;
      }
      if (rolesTyping.includes("doctor")) {
        setTypingNotice("Doctor is typing...");
        return;
      }
      if (rolesTyping.includes("agent")) {
        setTypingNotice("Agent is typing...");
        return;
      }
      setTypingNotice("Support is typing...");
    });
    return () => unsubscribe();
  }, [typingChannelKey, authUser, sessionRole, isArchivedView]);

  useEffect(() => {
    if (customerMode !== "doctor") return;
    if (!authUser || sessionRole !== "customer") return;
    if (conversationId) return;
    if (!appointmentId) return;
    loadArchivedByAppointment(appointmentId);
  }, [customerMode, authUser, sessionRole, conversationId, appointmentId]);

  useEffect(() => {
    if (!authUser || sessionRole !== "customer" || !conversationId) {
      teardownLiveListeners(true);
      setConversation(null);
      setMessages([]);
      if (!conversationId) {
        resetArchivedView();
      }
      return undefined;
    }

    teardownLiveListeners();
    activeConversationIdRef.current = conversationId;
    closingConversationRef.current = false;

    const transitionToClosedState = async () => {
      if (activeConversationIdRef.current !== conversationId) return;
      if (closingConversationRef.current) return;
      closingConversationRef.current = true;
      markRecentlyClosed(conversationId);
      teardownLiveListeners(true);
      setConversation(null);
      setMessages([]);
      setTypingNotice("");
      if (customerMode === "doctor" && appointmentId) {
        await loadArchivedByAppointment(appointmentId);
        return;
      }
      clearSupportConversation();
    };

    const convRef = doc(db, "conversations", conversationId);
    const unsubConversation = onSnapshot(
      convRef,
      (snap) => {
        if (activeConversationIdRef.current !== conversationId) return;
        if (!snap.exists()) {
          transitionToClosedState();
          return;
        }

        const nextConversation = { id: snap.id, ...snap.data() };
        if (nextConversation.status === "closed") {
          setConversation(nextConversation);
          transitionToClosedState();
          return;
        }

        closingConversationRef.current = false;
        resetArchivedView();
        setConversation(nextConversation);
      },
      (err) => {
        if (activeConversationIdRef.current !== conversationId) return;
        if (isInternalAssertionError(err)) {
          transitionToClosedState();
          return;
        }
        if (err?.code === "permission-denied" || err?.message?.includes("permission")) {
          transitionToClosedState();
          if (customerMode !== "doctor") {
            setError("Session expired. Please start a new chat.");
          }
          return;
        }
        setError(err.message);
      }
    );

    const msgQuery = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("created_at", "asc")
    );
    const unsubMessages = onSnapshot(
      msgQuery,
      (snap) => {
        if (activeConversationIdRef.current !== conversationId) return;
        if (closingConversationRef.current) return;
        const items = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setMessages(items);
      },
      (err) => {
        if (activeConversationIdRef.current !== conversationId) return;
        if (isInternalAssertionError(err)) {
          transitionToClosedState();
          return;
        }
        if (err?.code === "permission-denied" || err?.message?.includes("permission")) {
          transitionToClosedState();
          if (customerMode !== "doctor") {
            setError("Session expired. Please start a new chat.");
          }
          return;
        }
        setError(err.message);
      }
    );

    liveUnsubscribersRef.current = {
      conversation: unsubConversation,
      messages: unsubMessages
    };

    return () => {
      if (activeConversationIdRef.current === conversationId) {
        teardownLiveListeners(true);
      } else {
        try {
          unsubConversation();
        } catch {
          // Ignore listener teardown errors.
        }
        try {
          unsubMessages();
        } catch {
          // Ignore listener teardown errors.
        }
      }
    };
  }, [authUser, conversationId, sessionRole, customerMode, appointmentId]);

  const handleConnect = async () => {
    setError(null);
    setStatus("connecting");
    try {
      if (authUser && sessionRole === "customer") {
        try {
          const tokenResult = await authUser.getIdTokenResult(true);
          if (tokenResult?.claims?.role === "customer") {
            setStatus("ready");
            return;
          }
        } catch { }
      }
      const payload = effectiveUserId
        ? await getAgentToken({ agentId: effectiveUserId, role: "customer" })
        : await getGuestToken();
      await signInWithCustomToken(auth, payload.token);
      setSessionRole("customer");
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  function resetArchivedView() {
    archivedFetchRef.current = "";
    setArchivedConversation(null);
    setArchivedMessages([]);
  }

  const clearSupportConversation = () => {
    teardownLiveListeners(true);
    closingConversationRef.current = false;
    if (sessionStorageRef) {
      sessionStorageRef.removeItem(LOCAL_KEYS.customerConversationSupport);
      sessionStorageRef.removeItem(LOCAL_KEYS.customerConversationSupportLegacy);
    }
    setConversationId("");
    setConversation(null);
    setMessages([]);
    resetArchivedView();
  };

  async function loadArchivedByAppointment(appointmentIdValue) {
    if (!authUser || sessionRole !== "customer") return;
    if (!appointmentIdValue) return;
    const key = `appointment:${appointmentIdValue}`;
    if (archivedFetchRef.current === key) return;
    archivedFetchRef.current = key;
    try {
      const idToken = await authUser.getIdToken();
      const payload = await getArchivedConversationByAppointment({
        idToken,
        appointmentId: appointmentIdValue
      });
      const convo = payload.conversation || null;
      const convoId = convo?.conversation_id || convo?.id || "";
      if (convoId && !conversationId) {
        setConversationId(convoId);
      }
      setArchivedConversation(convo ? { id: convoId || convo?.id, ...convo } : null);
      setArchivedMessages(payload.messages || []);
    } catch {
      resetArchivedView();
    }
  }

  const handleAttachmentChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const next = [];
    const rejected = [];
    files.forEach((file) => {
      if (!isAllowedAttachment(file)) {
        rejected.push(file);
        return;
      }
      next.push(buildPendingAttachment(file));
    });
    if (rejected.length) {
      setAttachmentError("Some files were skipped (type or size limit).");
    } else {
      setAttachmentError("");
    }
    setPendingAttachments((prev) => [...prev, ...next]);
    event.target.value = "";
  };

  const handleVoiceRecorded = (file) => {
    if (!isAllowedAttachment(file)) {
      setAttachmentError("Voice note format not supported or too large.");
      return;
    }
    setAttachmentError("");
    setPendingAttachments((prev) => [...prev, buildPendingAttachment(file)]);
  };

  const removePendingAttachment = (id) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearPendingAttachments = () => {
    setPendingAttachments((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
      return [];
    });
  };

  const uploadAttachments = async (conversationIdValue, messageId) => {
    if (!pendingAttachments.length) return [];
    const uploads = pendingAttachments.map(async (item) => {
      const file = item.file;
      const safeName = sanitizeFileName(file.name || `file_${messageId}`);
      const path = `attachments/${conversationIdValue}/${messageId}/${safeName}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type || undefined });
      const downloadUrl = await getDownloadURL(fileRef);
      return {
        kind: item.kind,
        file_name: file.name || safeName,
        content_type: file.type || "application/octet-stream",
        bytes: file.size,
        storage_path: path,
        download_url: downloadUrl
      };
    });
    return Promise.all(uploads);
  };

  const handleMessagesScroll = () => {
    if (!messagesListRef.current) return;
    isAutoScrollRef.current = isNearBottom(messagesListRef.current);
    if (isAutoScrollRef.current) {
      setUnreadCount(0);
      scheduleReadReceipt();
    }
  };

  const handleJumpToLatest = () => {
    if (!messagesListRef.current) return;
    isAutoScrollRef.current = true;
    messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    setUnreadCount(0);
    scheduleReadReceipt();
  };

  useEffect(() => {
    if (!authReady) return;
    if (autoConnectAttempted.current) return;
    autoConnectAttempted.current = true;
    handleConnect();
  }, [authReady, authUser, sessionRole, storedUserId]);

  const setTypingStatus = async (isTyping) => {
    if (!typingChannelKey || !authUser || sessionRole !== "customer") return;
    if (closingConversationRef.current) return;
    if (conversation?.status === "closed") return;
    const typingRef = ref(rtdb, `typing/${typingChannelKey}/${authUser.uid}`);
    typingActiveRef.current = isTyping;
    await set(typingRef, {
      typing: isTyping,
      role: "customer",
      updated_at: rtdbServerTimestamp()
    });
    if (isTyping) {
      onDisconnect(typingRef).set({
        typing: false,
        role: "customer",
        updated_at: rtdbServerTimestamp()
      });
    }
  };

  const handleTyping = () => {
    if (!typingChannelKey || !authUser || sessionRole !== "customer") return;
    if (closingConversationRef.current) return;
    if (conversation?.status === "closed") return;
    if (!typingActiveRef.current) {
      setTypingStatus(true);
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      setTypingStatus(false);
    }, TYPING_DEBOUNCE_MS);
  };

  const handleReset = async () => {
    setError(null);
    teardownLiveListeners(true);
    closingConversationRef.current = false;
    if (sessionStorageRef) {
      if (customerMode === "doctor" && appointmentId) {
        sessionStorageRef.removeItem(
          `${LOCAL_KEYS.customerConversationDoctorPrefix}${appointmentId}`
        );
      } else {
        sessionStorageRef.removeItem(LOCAL_KEYS.customerConversationSupport);
        sessionStorageRef.removeItem(LOCAL_KEYS.customerConversationSupportLegacy);
      }
    }
    setConversationId("");
    setConversation(null);
    setMessages([]);
    resetArchivedView();
    setDraft("");
    clearPendingAttachments();
    if (authUser && sessionRole === "customer") {
      await signOut(auth);
      setSessionRole(null);
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    if (typingActiveRef.current) {
      await setTypingStatus(false);
    }
    setStatus("idle");
    autoConnectAttempted.current = false;
  };

  const handleSend = async () => {
    if (!authUser || sessionRole !== "customer") {
      setError("Sign in as a customer to send messages.");
      return;
    }
    const messageText = draft.trim();
    const hasAttachments = pendingAttachments.length > 0;
    if (!messageText && !hasAttachments) return;
    if (customerMode === "doctor" && !appointmentId.trim()) {
      setError("Appointment ID is required for doctor chats.");
      return;
    }

    setError(null);
    setDraft("");
    setIsUploading(hasAttachments);

    try {
      const idToken = await authUser.getIdToken();
      const shouldStartNew =
        !conversationId ||
        (conversation?.status === "closed" && customerMode === "support") ||
        (conversation?.status === "closed" && customerMode === "doctor");

      if (shouldStartNew) {
        const response = await startConversation({
          idToken,
          type: customerMode,
          appointmentId: customerMode === "doctor" ? appointmentId.trim() : undefined,
          initialMessage:
            customerMode === "support" && !hasAttachments ? messageText : undefined,
          clientMessageId: randomId()
        });

        setConversationId(response.conversationId);

        if (customerMode === "doctor" || hasAttachments) {
          const messageRef = doc(
            collection(db, "conversations", response.conversationId, "messages")
          );
          const messageId = messageRef.id;
          const attachments = hasAttachments
            ? await uploadAttachments(response.conversationId, messageId)
            : [];
          const messageType = hasAttachments ? (messageText ? "text" : "attachment") : "text";
          const payload = {
            sender_id: authUser.uid,
            sender_role: "customer",
            type: messageType,
            body: messageText || "",
            client_message_id: randomId(),
            created_at: serverTimestamp(),
            updated_at: serverTimestamp()
          };
          if (attachments.length) {
            payload.attachments = attachments;
          }
          await setDoc(messageRef, payload);
        }
        clearPendingAttachments();
        await setTypingStatus(false);
        return;
      }

      const messageRef = doc(
        collection(db, "conversations", conversationId, "messages")
      );
      const messageId = messageRef.id;
      const attachments = hasAttachments
        ? await uploadAttachments(conversationId, messageId)
        : [];
      const messageType = hasAttachments ? (messageText ? "text" : "attachment") : "text";
      const payload = {
        sender_id: authUser.uid,
        sender_role: "customer",
        type: messageType,
        body: messageText || "",
        client_message_id: randomId(),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      if (attachments.length) {
        payload.attachments = attachments;
      }
      await setDoc(messageRef, payload);
      clearPendingAttachments();
      await setTypingStatus(false);
    } catch (err) {
      setError(err.message);
      if (messageText) {
        setDraft(messageText);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const isCustomerSession = sessionRole === "customer";

  return (
    <div
      className={`flex h-full w-full flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden ${isDarkMode ? "dark" : ""}`.trim()}
    >
      <header className="bg-white dark:bg-slate-950 flex w-full flex-wrap items-center justify-between space-x-4 px-4 py-2 shadow-sm">
        <div className="flex flex-col space-y-1 flex-1">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
            HEALTHASSURE SUPPORT
          </div>
        </div>
        <Spacer />
        <ThemeToggleCompact isDarkMode={isDarkMode} onChange={setIsDarkMode} />
        <Badge type="rounded" borderType="flat" color={isCustomerSession ? "green" : "red"} size="0">
          {isCustomerSession ? "Connected" : "Not connected"}
        </Badge>
        <button className={buttonClasses.ghost} onClick={handleReset}>
          Reset
        </button>
      </header>

      <div className="h-2 w-full" />

      <div className="w-full flex min-h-0 flex-1 flex-col px-2 overflow-hidden">
        <Card
          type="headerfooter"
          width="w-full"
          height="h-full"
          headerPadding=""
          footerPadding=""
          bgHeader=""
          classHeader="bg-white dark:bg-slate-950"
          bg=""
          classMain="bg-white dark:bg-slate-950"
          bgFooter=""
          classFooter="bg-white dark:bg-slate-950"
          headerContent={
            <div className="w-full flex items-center justify-between gap-3 p-2">
              {/* <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xxs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Session
                </span>
              </div>
              <p className="text-xxs text-slate-500">
                {effectiveUserId
                  ? "Logged-in user detected. Connecting as customer."
                  : "Guest session auto-connects via /auth/guest-token."}
              </p>
              <Divider margin="mx-0" /> */}

              {/* <div className="flex flex-col gap-2">
                <label className="text-xxs uppercase tracking-[0.2em] text-slate-500">
                  Chat type
                </label>
                <span className="text-xs text-slate-700 dark:text-slate-300">
                  {customerMode === "doctor" ? "Doctor (appointment)" : "Support"}
                </span>
              </div> */}



              <div className="flex flex-col gap-1">
                <label className="text-2xs uppercase tracking-[0.2em] text-slate-500">
                  Active conversation
                </label>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                  <span>{conversationId ? conversationId : "None"}</span>
                  {displayConversation?.status && (
                    <Badge
                      type="rounded"
                      borderType="flat"
                      color={displayConversation.status === "open" ? "green" : "red"}
                      size="-1"
                    >
                      {displayConversation.status.toUpperCase()}
                    </Badge>
                  )}
                  {isArchivedView && (
                    <Badge type="rounded" borderType="flat" color="gray" size="-1">
                      Archived
                    </Badge>
                  )}
                </div>
              </div>

              {customerMode === "doctor" && (
                <div className="flex flex-col gap-1">
                  <label className="text-2xs uppercase tracking-[0.2em] text-slate-500">
                    Appointment ID
                  </label>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {appointmentId || "—"}
                  </span>
                </div>
              )}
            </div>
          }
          footerContent={
            <div className="box-border w-full flex flex-col gap-2 p-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1 text-3xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:text-slate-800">
                  Add files
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,application/pdf,audio/*"
                    onChange={handleAttachmentChange}
                    disabled={!authUser || sessionRole !== "customer" || isUploading}
                  />
                </label>
                <VoiceRecorderButton
                  buttonClassName="rounded-md border border-slate-200 bg-white px-3 py-1 text-3xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  disabled={!authUser || sessionRole !== "customer" || isUploading}
                  onRecorded={handleVoiceRecorded}
                  onError={setAttachmentError}
                  label="Record"
                />
                {attachmentError && (
                  <span className="text-xs text-amber-600">{attachmentError}</span>
                )}
                {isUploading && (
                  <span className="text-xs text-slate-500">Uploading attachments…</span>
                )}
              </div>
              <PendingAttachmentList
                attachments={pendingAttachments}
                onRemove={removePendingAttachment}
              />
              <textarea
                className={`box-border ${inputBase} w-full min-h-[90px] resize-y`}
                placeholder="Type the first message..."
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  handleTyping();
                }}
                disabled={!authUser || sessionRole !== "customer" || isUploading}
              />
              <button
                className={buttonClasses.primary}
                onClick={handleSend}
                disabled={!authUser || sessionRole !== "customer" || isUploading}
              >
                Send message
              </button>
            </div>
          }
        >
          <div className="w-full h-full box-border flex flex-col items-center justify-center">
            <div className="mb-1 w-full flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-500 px-2 py-2">
              <strong className="text-xxs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Timeline
              </strong>
              <span>{displayMessages.length} messages</span>
            </div>
            <div className="mb-1 w-full flex items-center justify-center text-slate-500 px-2">
              {typingNotice && (
                <span className="text-xs">{typingNotice}</span>
              )}
              <Spacer />
              {conversationId && (
                <span className="text-xs">
                  {otherLastReadText}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                className="mb-1 inline-flex items-center gap-2 rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 cursor-pointer"
                onClick={handleJumpToLatest}
              >
                {unreadCount} new message{unreadCount === 1 ? "" : "s"} • Jump to
                latest
              </button>
            )}

            <div className="w-full h-[1px] bg-gray-300 dark:bg-gray-700 mt-2"></div>

            <ul
              className="w-full flex-1 min-h-0 space-y-4 overflow-y-auto px-2"
              ref={messagesListRef}
              onScroll={handleMessagesScroll}
            >
              <li className="w-full h-2"></li>
              {displayMessages.map((message) => {
                const senderRole = message.sender_role || "system";
                const isSelf = senderRole === "customer";
                const isSystem = senderRole === "system";
                const attachments = Array.isArray(message.attachments)
                  ? message.attachments
                  : [];
                const rowClass = isSystem
                  ? "justify-center"
                  : isSelf
                    ? "justify-end"
                    : "justify-start";
                const stackAlign = isSystem
                  ? "items-center"
                  : isSelf
                    ? "items-end"
                    : "items-start";
                const avatarLabel = isSelf
                  ? "Y"
                  : senderRole === "agent"
                    ? "A"
                    : senderRole === "doctor"
                      ? "D"
                      : senderRole === "customer"
                        ? "C"
                        : "S";
                const avatarClass = isSelf
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                  : senderRole === "doctor"
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200"
                    : senderRole === "agent"
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200"
                      : senderRole === "customer"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200";
                const bubbleClass = isSelf
                  ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  : isSystem
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300";
                return (
                  <li key={message.id} className={`flex ${rowClass}`}>
                    <div
                      className={`flex max-w-full items-end gap-2 ${isSelf ? "flex-row-reverse" : ""}`}
                    >
                      {!isSystem && (
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[0.55rem] font-semibold uppercase ${avatarClass}`}
                        >
                          {avatarLabel}
                        </div>
                      )}
                      <div className={`flex max-w-[75%] flex-col gap-1 ${stackAlign}`}>
                        <div className="flex items-center gap-2 text-3xs uppercase text-slate-500">
                          <span className="whitespace-nowrap">
                            {formatTime(message.created_at)}
                          </span>
                        </div>
                        <div className={`rounded-md px-2 py-2 shadow-xs ${bubbleClass}`}>
                          {message.body && (
                            <p
                              className={`text-xs leading-relaxed ${isSystem ? "whitespace-nowrap" : ""
                                }`}
                            >
                              {friendlyBody(message.body)}
                            </p>
                          )}
                          <AttachmentList
                            attachments={attachments}
                            className={message.body ? "mt-2" : ""}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
              <li className="w-full h-2"></li>
            </ul>
            {!displayMessages.length && (
              <div className="pt-2 text-sm text-slate-500 flex-1 flex items-center justify-center w-full">
                No messages yet. Start the conversation.
              </div>
            )}
          </div>
        </Card>

        {status === "connecting" && (
          <p className="text-xs text-slate-500">Connecting...</p>
        )}
        {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      </div>

      <div className="h-2 w-full" />
    </div>
  );
}
