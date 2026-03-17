function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function HorizontalScrollTabs({ children, className = "", railClassName = "", innerClassName = "" }) {
  return (
    <div className={joinClasses("relative min-w-0", className)}>
      <div
        className={joinClasses(
          "overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          railClassName
        )}
      >
        <div className={joinClasses("flex w-max min-w-full items-center gap-2 [&>*]:shrink-0 [&>*]:whitespace-nowrap", innerClassName)}>{children}</div>
      </div>
    </div>
  );
}