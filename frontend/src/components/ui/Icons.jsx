const Ico = (path, vb = 24) => ({ size = 16, style, className, ...p } = {}) => (
  <svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`}
    fill="none" stroke="currentColor" strokeWidth={1.5}
    strokeLinecap="round" strokeLinejoin="round"
    style={style} className={className} {...p}
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

export const IcoHome     = Ico('<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V9.5z"/>');
export const IcoCpu      = Ico('<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>');
export const IcoData     = Ico('<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-7"/>');
export const IcoMap      = Ico('<path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2-6-2z"/><path d="M9 3v16M15 5v16"/>');
export const IcoBell     = Ico('<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>');
export const IcoFileChart= Ico('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 17v-2M12 17v-4M16 17v-6"/>');
export const IcoMonitor  = Ico('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>');
export const IcoFilm     = Ico('<rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 8h20M2 16h20M7 3v18M17 3v18"/>');
export const IcoCalendar = Ico('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>');
export const IcoUsers    = Ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>');
export const IcoSettings = Ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');
export const IcoSearch   = Ico('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>');
export const IcoPlus     = Ico('<path d="M12 5v14M5 12h14"/>');
export const IcoFilter   = Ico('<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>');
export const IcoDownload = Ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>');
export const IcoUpload   = Ico('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>');
export const IcoRefresh  = Ico('<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>');
export const IcoMore     = Ico('<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>');
export const IcoX        = Ico('<path d="M18 6 6 18M6 6l12 12"/>');
export const IcoCheck    = Ico('<path d="M20 6 9 17l-5-5"/>');
export const IcoChevDown = Ico('<path d="m6 9 6 6 6-6"/>');
export const IcoArrowUp  = Ico('<path d="M12 19V5M5 12l7-7 7 7"/>');
export const IcoArrowDown= Ico('<path d="M12 5v14M19 12l-7 7-7-7"/>');
export const IcoArrowRight=Ico('<path d="M5 12h14M12 5l7 7-7 7"/>');
export const IcoZap      = Ico('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>');
export const IcoSun      = Ico('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>');
export const IcoMoon     = Ico('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');
export const IcoPin      = Ico('<path d="M12 22s-8-7-8-13a8 8 0 0 1 16 0c0 6-8 13-8 13z"/><circle cx="12" cy="9" r="3"/>');
export const IcoShield   = Ico('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>');
export const IcoAlert    = Ico('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/>');
export const IcoInfo     = Ico('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>');
export const IcoHistory  = Ico('<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>');
export const IcoExt      = Ico('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>');
export const IcoLayers   = Ico('<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 16 10 6 10-6M2 12l10 6 10-6"/>');
export const IcoLayoutGrid=Ico('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>');
export const IcoList     = Ico('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>');
export const IcoBellOff  = Ico('<path d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M1 1l22 22"/>');
export const IcoBookmark = Ico('<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>');
export const IcoShare    = Ico('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>');
export const IcoGroup    = Ico('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>');
export const IcoMenu     = Ico('<path d="M3 6h18M3 12h18M3 18h18"/>');
export const IcoStar     = Ico('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>');
export const IcoExternal = Ico('<path d="M7 7h10v10M7 17 17 7"/>');
export const IcoFlame    = Ico('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>');
export const IcoKey      = Ico('<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>');
export const IcoCopy     = Ico('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
export const IcoBell2    = Ico('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>');
