import clsx from "clsx";

export function Divider({
  width = "w-full",
  margin = "mx-4",
  colorClass = "border-gray-300 dark:border-gray-700"
}) {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute inset-0 flex items-center">
        <div className={clsx("border-t", width, margin, colorClass)} />
      </div>
    </div>
  );
}
