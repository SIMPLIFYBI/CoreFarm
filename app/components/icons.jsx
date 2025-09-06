export const AssetIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    width={props.size || 24}
    height={props.size || 24}
    fill="none"
    {...props}
  >
    <g stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <line x1="15.34" y1="16.77" x2="7.7" y2="16.77" />
      <path d="M3.89,16.77H1.5V11.05h9.55V5.32h4.34a1.9,1.9,0,0,1,1.81,1.3l1.48,4.43,2.37.59a1.9,1.9,0,0,1,1.45,1.85v3.28H19.16" />
      <circle cx="17.25" cy="16.77" r="1.91" />
      <circle cx="5.8" cy="16.77" r="1.91" />
      <line x1="13.91" y1="11.05" x2="18.68" y2="11.05" />
    </g>
  </svg>
);
export function IconCore(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconAdmin(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 2l3 5 6 .9-4.3 4.2 1 6-5.7-3-5.7 3 1-6L3 7.9 9 7l3-5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

export function IconTeam(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <circle cx="16" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconUser(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M10 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M15 12H3m0 0 3-3m-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconLogin(props) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M9 12h12m0 0-3-3m3 3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

export function IconReport(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8 15v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M12 15V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M16 15v-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M7 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

export function IconClipboard(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 4.5V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 9h6M9 12h6M9 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconCoreTasks(props) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 7v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
      <path d="M9 15l6-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}
  export const VehicleIcon = (props) => (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      width={props.size || 24}
      height={props.size || 24}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Reuse hammer icon for page header to match nav */}
      <path d="M3 21l7-7" stroke="currentColor" fill="none" />
      <path d="M10 14l8-8 2 2-8 8z" stroke="currentColor" fill="none" />
      <path d="M12 6l4 4" stroke="currentColor" fill="none" />
    </svg>
  );
