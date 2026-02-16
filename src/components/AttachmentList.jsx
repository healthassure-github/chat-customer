import clsx from "clsx";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const sanitizeFileName = (name = "") =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_");

export const isAllowedAttachment = (file) => {
  if (!file) return false;
  if (file.size > MAX_ATTACHMENT_BYTES) return false;
  const contentType = file.type || "";
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("audio/") ||
    contentType === "application/pdf"
  );
};

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes)) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
};

const getAttachmentKind = (attachment) => {
  if (!attachment) return "document";
  if (attachment.kind) return attachment.kind;
  const contentType = attachment.content_type || "";
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType === "application/pdf") return "document";
  const name = attachment.file_name || "";
  if (name.toLowerCase().endsWith(".pdf")) return "document";
  return "document";
};

export function AttachmentList({ attachments = [], className = "" }) {
  if (!attachments?.length) return null;
  return (
    <div className={clsx("flex flex-col gap-2", className)}>
      {attachments.map((attachment, index) => {
        const kind = getAttachmentKind(attachment);
        const label = attachment.file_name || `Attachment ${index + 1}`;
        const downloadUrl = attachment.download_url || "";
        const sizeLabel = formatBytes(attachment.bytes || 0);
        const metaLabel = [label, sizeLabel].filter(Boolean).join(" · ");

        if (kind === "image" && downloadUrl) {
          return (
            <div key={`${label}-${index}`} className="flex flex-col gap-1">
              <img
                src={downloadUrl}
                alt={label}
                className="max-h-48 max-w-[240px] rounded-md border border-slate-200 object-cover"
              />
              <span className="text-3xs uppercase tracking-[0.2em] text-slate-400">
                {metaLabel}
              </span>
            </div>
          );
        }

        if (kind === "audio" && downloadUrl) {
          return (
            <div key={`${label}-${index}`} className="flex flex-col gap-1">
              <audio controls src={downloadUrl} className="w-full max-w-[280px]" />
              <span className="text-3xs uppercase tracking-[0.2em] text-slate-400">
                {metaLabel}
              </span>
            </div>
          );
        }

        return (
          <div key={`${label}-${index}`} className="flex flex-col gap-1">
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                {label}
              </a>
            ) : (
              <span className="text-xs font-semibold text-slate-600">{label}</span>
            )}
            <span className="text-3xs uppercase tracking-[0.2em] text-slate-400">
              {sizeLabel || "Document"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function buildPendingAttachment(file) {
  const contentType = file?.type || "";
  let kind = "document";
  if (contentType.startsWith("image/")) kind = "image";
  if (contentType.startsWith("audio/")) kind = "audio";
  if (contentType === "application/pdf") kind = "document";
  const previewUrl =
    kind === "image" || kind === "audio" ? URL.createObjectURL(file) : "";
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    kind,
    previewUrl
  };
}

export function PendingAttachmentList({ attachments = [], onRemove }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {attachments.map((item) => {
        const label = item.file?.name || "Attachment";
        const sizeLabel = formatBytes(item.file?.size || 0);
        const metaLabel = [label, sizeLabel].filter(Boolean).join(" · ");
        return (
          <div
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs"
          >
            {item.kind === "image" && item.previewUrl && (
              <img
                src={item.previewUrl}
                alt={label}
                className="h-12 w-12 rounded-md object-cover"
              />
            )}
            {item.kind === "audio" && item.previewUrl && (
              <audio controls src={item.previewUrl} className="w-full max-w-[200px]" />
            )}
            <div className="flex flex-1 flex-col">
              <span className="font-semibold text-slate-700">{label}</span>
              <span className="text-3xs uppercase tracking-[0.2em] text-slate-400">
                {metaLabel}
              </span>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-2 py-1 text-3xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition hover:border-slate-300 hover:text-slate-700 cursor-pointer"
              onClick={() => onRemove?.(item.id)}
            >
              Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}
