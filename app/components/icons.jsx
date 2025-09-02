export const AssetIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    stroke="currentColor"
    width={props.size || 24}
    height={props.size || 24}
    {...props}
  >
    <path d="M16,6H10.5v4H1v5H3a3,3,0,0,0,6,0h6a3,3,0,0,0,6,0h2V12a2,2,0,0,0-2-2H19L16,6M12,7.5h3.5l2,2.5H12V7.5m-6,6A1.5,1.5,0,1,1,4.5,15,1.5,1.5,0,0,1,6,13.5m12,0A1.5,1.5,0,1,1,16.5,15,1.5,1.5,0,0,1,18,13.5Z"></path>
    <rect width="24" height="24" fill="none"></rect>
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
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={props.size || 24}
      height={props.size || 24}
      {...props}
    >
      <rect x="2" y="7" width="17" height="7" rx="2" />
      <rect x="19" y="10" width="3" height="4" rx="1" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
      <rect x="4" y="9" width="6" height="3" rx="1" />
    </svg>
  );
