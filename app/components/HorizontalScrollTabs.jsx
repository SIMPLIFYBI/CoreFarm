function joinClasses(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function HorizontalScrollTabs({
  children,
  className = "",
  railClassName = "",
  innerClassName = "",
  hint = "Swipe for more",
  showHint = true,
  edgeFadeLeftClassName = "from-slate-950/95 via-slate-950/72 to-transparent",
  edgeFadeRightClassName = "from-transparent via-slate-950/72 to-slate-950/95",
  hintClassName = "text-slate-500",
}) {
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
      <div className={joinClasses("pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r sm:hidden", edgeFadeLeftClassName)} />
      <div className={joinClasses("pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l sm:hidden", edgeFadeRightClassName)} />
      {showHint ? (
        <div className={joinClasses("mt-2 flex items-center justify-end gap-2 text-[10px] uppercase tracking-[0.18em] sm:hidden", hintClassName)}>
          <span className="h-px w-6 bg-current/35" />
          <span>{hint}</span>
        </div>
      ) : null}
    </div>
  );
}