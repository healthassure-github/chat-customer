import clsx from "clsx";

export function ThemeToggleCompact({
  isDarkMode = false,
  onChange = () => {}
}) {
  return (
    <div className="isolate flex rounded-md shadow-xs">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={clsx(
          "relative inline-flex items-center justify-center rounded-l-md px-2 py-1 text-3xs ring-1 ring-inset transition cursor-pointer",
          isDarkMode
            ? "bg-gray-200 text-gray-400 ring-gray-200 hover:bg-gray-100"
            : "bg-gray-50 text-gray-700 ring-gray-200 font-semibold"
        )}
        aria-label="Light mode"
      >
        L
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={clsx(
          "relative -ml-px inline-flex items-center justify-center rounded-r-md px-2 py-1 text-3xs ring-1 ring-inset transition cursor-pointer",
          isDarkMode
            ? "bg-gray-800 text-gray-200 ring-gray-700 font-semibold"
            : "bg-gray-600 text-gray-400 ring-gray-700 hover:bg-gray-500"
        )}
        aria-label="Dark mode"
      >
        D
      </button>
    </div>
  );
}
