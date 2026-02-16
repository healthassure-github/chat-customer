import clsx from "clsx";

export function Card({
  type = "plain",
  bg = "bg-white",
  bgHeader = "bg-white",
  bgFooter = "bg-white",
  headerContent = null,
  footerContent = null,
  extraClassNames = "",
  width,
  height,
  classMain = "",
  classHeader = "",
  classFooter = "",
  className = "",
  headerPadding = "",
  footerPadding = "",
  children
}) {
  const outer = clsx(
    "overflow-hidden rounded-lg flex flex-col items-stretch justify-start",
    type !== "plain" && "divide-y divide-gray-200 dark:divide-gray-700",
    width,
    height,
    bg,
    classMain,
    extraClassNames,
    className,
    "shadow-sm dark:shadow-gray-800"
  );

  return (
    <div className={outer}>
      {["header", "headerfooter"].includes(type) && (
        <div className={clsx("w-full", bgHeader, classHeader, headerPadding)}>{headerContent}</div>
      )}
      <div className="w-full flex-1 overflow-hidden">{children}</div>
      {["footer", "headerfooter"].includes(type) && (
        <div className={clsx("w-full", bgFooter, classFooter, footerPadding)}>{footerContent}</div>
      )}
    </div>
  );
}
