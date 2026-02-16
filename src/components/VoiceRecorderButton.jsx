import { useEffect, useMemo, useRef, useState } from "react";

const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4"
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const baseMimeType = (mimeType = "") => mimeType.split(";")[0] || "";

const extensionFromMime = (mimeType = "") => {
  const baseType = baseMimeType(mimeType);
  if (baseType === "audio/webm") return "webm";
  if (baseType === "audio/ogg") return "ogg";
  if (baseType === "audio/mp4" || baseType === "audio/m4a") return "m4a";
  return "audio";
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const canRecordAudio = () => {
  if (typeof window === "undefined") return false;
  return Boolean(
    navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"
  );
};

export default function VoiceRecorderButton({
  onRecorded,
  onError,
  disabled = false,
  buttonClassName = "",
  label = "Record"
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const supportsRecording = useMemo(() => canRecordAudio(), []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setElapsed(0);
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const handleStart = async () => {
    if (!supportsRecording || disabled || isRecording) return;
    onError?.("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const baseType = baseMimeType(recorder.mimeType || mimeType || "audio/webm");
        const blob = new Blob(chunksRef.current, { type: baseType || "audio/webm" });
        if (!blob.size) {
          onError?.("Recording failed. Please try again.");
          cleanup();
          return;
        }
        const extension = extensionFromMime(baseType);
        const filename = `voice-note-${Date.now()}.${extension}`;
        const file = new File([blob], filename, { type: baseType });
        onRecorded?.(file);
        cleanup();
      };
      recorder.onerror = () => {
        onError?.("Recording failed. Please try again.");
        cleanup();
      };
      recorder.start();
      setIsRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError") {
        onError?.("Microphone access denied.");
      } else if (name === "NotFoundError") {
        onError?.("No microphone detected.");
      } else if (name === "NotReadableError") {
        onError?.("Microphone is already in use.");
      } else {
        onError?.("Unable to access microphone.");
      }
      cleanup();
    }
  };

  const handleStop = () => {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      cleanup();
      return;
    }
    recorderRef.current.stop();
  };

  const handleClick = () => {
    if (isRecording) {
      handleStop();
    } else {
      handleStart();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={buttonClassName}
        onClick={handleClick}
        disabled={disabled || !supportsRecording}
        title={supportsRecording ? "" : "Recording not supported in this browser"}
      >
        {isRecording ? "Stop" : label}
      </button>
      {isRecording && (
        <span className="text-xs text-amber-600">Recording {formatDuration(elapsed)}</span>
      )}
    </div>
  );
}
