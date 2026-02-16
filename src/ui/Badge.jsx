import clsx from "clsx";

const sizeClasses = {
  "-3": "px-1.5 py-0.5 text-3xs/3",
  "-2": "px-1.5 py-0.5 text-2xs/3",
  "-1": "px-1.5 py-0.5 text-xxs/4",
  "0": "px-2 py-1 text-xs/4",
  small: "px-1.5 py-0.5 text-xxs/4",
  medium: "px-2 py-1 text-xs/4",
  large: "px-3 py-1.5 text-sm/4"
};

const colorClasses = {
  gray: "text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800",
  red: "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40",
  green: "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40",
  yellow: "text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/40",
  blue: "text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40"
};

export default function Badge({
  type = "rounded",
  size = "medium",
  color = "gray",
  borderType = "flat",
  margin = "",
  className = "",
  children
}) {
  const radiusClass = type === "pill" ? "rounded-full" : "rounded-md";
  const ringClass =
    borderType === "solid"
      ? "ring-1 ring-inset ring-black/10 dark:ring-white/15"
      : "";

  return (
    <span
      className={clsx(
        "inline-flex items-center font-medium",
        sizeClasses[size] || sizeClasses.medium,
        colorClasses[color] || colorClasses.gray,
        radiusClass,
        ringClass,
        margin,
        className
      )}
    >
      {children}
    </span>
  );
}
