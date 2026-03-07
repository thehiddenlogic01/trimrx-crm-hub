export const APP_PAGES: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/messages": "Messages",
  "/analytics": "Analytics",
  "/trimrx/cv-support": "CV Support",
  "/trimrx/cv-report": "CV Report",
  "/trimrx/retention-final-submit": "Retention Final Submit",
  "/trimrx/slack-messages": "Manage Slack Case",
  "/trimrx/rt-help": "RT Help",
  "/trimrx/cv-slack": "CV Slack",
  "/trimrx/dispute-report-yedid": "Dispute Report Yedid",
  "/trimrx/case-folders": "Case Folder",
  "/trimrx/disputes-doc": "Disputes Doc",
  "/trimrx/stripe-submit": "Stripe Submit",
  "/trimrx/patients-analysis": "Patients Analysis",
  "/trimrx/disputes-finder": "Disputes Finder",
  "/trimrx/dispute-settings": "Dispute Settings",
  "/admin/users": "User Management",
  "/admin/api-keys": "API Keys",
  "/slack": "Slack",
  "/gpt-chat": "GPT Chat",
  "/integrations": "Integrations",
  "/settings": "Settings",
  "/admin/settings": "Admin Settings",
  "/database/pt-finder": "PT Finder",
  "/database/stripe-payments": "Stripe Payment Details",
  "/communication/internal-bd": "Trimrx Internal (BD)",
};

export const APP_SECTIONS = [
  {
    key: "menu",
    label: "Menu",
    routes: ["/", "/clients", "/messages", "/analytics"],
  },
  {
    key: "trimrx-cv",
    label: "TrimRX CV",
    routes: ["/trimrx/cv-support", "/trimrx/cv-report", "/trimrx/retention-final-submit", "/trimrx/slack-messages", "/trimrx/rt-help", "/trimrx/cv-slack"],
  },
  {
    key: "trimrx-disputes",
    label: "TrimRX Disputes",
    routes: [
      "/trimrx/dispute-report-yedid",
      "/trimrx/disputes-finder",
      "/trimrx/case-folders",
      "/trimrx/disputes-doc",
      "/trimrx/stripe-submit",
      "/trimrx/patients-analysis",
      "/trimrx/dispute-settings",
    ],
  },
  {
    key: "communication",
    label: "Communication",
    routes: ["/communication/internal-bd"],
  },
  {
    key: "database",
    label: "Database",
    routes: ["/database/pt-finder", "/database/stripe-payments"],
  },
  {
    key: "admin",
    label: "Admin",
    routes: [
      "/admin/users",
      "/admin/api-keys",
      "/slack",
      "/gpt-chat",
      "/integrations",
      "/settings",
      "/admin/settings",
    ],
  },
] as const;

export type SectionKey = (typeof APP_SECTIONS)[number]["key"];

export interface FeatureDef {
  key: string;
  label: string;
}

export interface PageFeatures {
  page: string;
  label: string;
  section: string;
  route: string;
  features: FeatureDef[];
}

export const APP_FEATURES: PageFeatures[] = [
  {
    page: "slack-messages",
    label: "Manage Slack Case",
    section: "trimrx-cv",
    route: "/trimrx/slack-messages",
    features: [
      { key: "reply", label: "Reply to Messages" },
      { key: "mark-done", label: "Mark as Done" },
      { key: "send-to-cv", label: "Send to CV Report" },
      { key: "delete-message", label: "Delete Messages" },
      { key: "check-cv-status", label: "Check CV Status" },
      { key: "bulk-done", label: "Bulk Mark Done" },
    ],
  },
  {
    page: "cv-report",
    label: "CV Report",
    section: "trimrx-cv",
    route: "/trimrx/cv-report",
    features: [
      { key: "add", label: "Add Reports" },
      { key: "edit", label: "Edit Reports" },
      { key: "delete", label: "Delete Reports" },
      { key: "export", label: "Export / Download" },
      { key: "push-sheets", label: "Push to Google Sheets" },
      { key: "slack-lookup", label: "Slack Lookup" },
      { key: "all-edit-access", label: "All Edit Access (dropdowns & inline editing)" },
    ],
  },
  {
    page: "cv-support",
    label: "CV Support",
    section: "trimrx-cv",
    route: "/trimrx/cv-support",
    features: [
      { key: "submit-case", label: "Submit Cases to CV Report" },
      { key: "bulk-submit", label: "Bulk Submit Cases" },
      { key: "manage-gpt", label: "Manage GPT Settings" },
      { key: "import-export", label: "Import / Export CSV" },
    ],
  },
  {
    page: "rt-help",
    label: "RT Help",
    section: "trimrx-cv",
    route: "/trimrx/rt-help",
    features: [
      { key: "send-message", label: "Send Messages" },
      { key: "reply", label: "Reply in Threads" },
      { key: "mark-done", label: "Mark as Done" },
      { key: "create-group", label: "Create New Group" },
      { key: "edit-message", label: "Edit Messages" },
      { key: "delete-message", label: "Delete Messages" },
    ],
  },
  {
    page: "cv-slack",
    label: "CV Slack",
    section: "trimrx-cv",
    route: "/trimrx/cv-slack",
    features: [
      { key: "send-message", label: "Send Messages" },
      { key: "reply", label: "Reply in Threads" },
    ],
  },
  {
    page: "internal-bd",
    label: "Trimrx Internal (BD)",
    section: "communication",
    route: "/communication/internal-bd",
    features: [
      { key: "send-message", label: "Send Messages" },
      { key: "reply", label: "Reply in Threads" },
      { key: "mark-done", label: "Mark as Done" },
      { key: "edit-message", label: "Edit Messages" },
      { key: "delete-message", label: "Delete Messages" },
    ],
  },
  {
    page: "dispute-report-yedid",
    label: "Dispute Report Yedid",
    section: "trimrx-disputes",
    route: "/trimrx/dispute-report-yedid",
    features: [
      { key: "add", label: "Add Records" },
      { key: "edit", label: "Edit Records" },
      { key: "delete", label: "Delete Records" },
      { key: "import", label: "Import Data" },
    ],
  },
  {
    page: "case-folders",
    label: "Case Folder",
    section: "trimrx-disputes",
    route: "/trimrx/case-folders",
    features: [
      { key: "add", label: "Create Folders" },
      { key: "edit", label: "Edit Folders" },
      { key: "delete", label: "Delete Folders" },
      { key: "upload", label: "Upload Files" },
    ],
  },
  {
    page: "disputes-doc",
    label: "Disputes Doc",
    section: "trimrx-disputes",
    route: "/trimrx/disputes-doc",
    features: [
      { key: "add", label: "Add Documents" },
      { key: "edit", label: "Edit Documents" },
      { key: "delete", label: "Delete Documents" },
    ],
  },
  {
    page: "stripe-submit",
    label: "Stripe Submit",
    section: "trimrx-disputes",
    route: "/trimrx/stripe-submit",
    features: [
      { key: "submit", label: "Submit to Stripe" },
      { key: "edit", label: "Edit Submissions" },
    ],
  },
  {
    page: "patients-analysis",
    label: "Patients Analysis",
    section: "trimrx-disputes",
    route: "/trimrx/patients-analysis",
    features: [
      { key: "analyze", label: "Run Analysis" },
      { key: "export", label: "Export Data" },
    ],
  },
];

export function getAllSectionKeys(): string[] {
  return APP_SECTIONS.map((s) => s.key);
}

export function getAllRoutes(): string[] {
  return APP_SECTIONS.flatMap((s) => [...s.routes]);
}

export function getRoutesForSection(sectionKey: string): readonly string[] {
  const section = APP_SECTIONS.find((s) => s.key === sectionKey);
  return section ? section.routes : [];
}

export function getSectionForRoute(route: string): string | undefined {
  for (const section of APP_SECTIONS) {
    if (section.routes.includes(route)) return section.key;
  }
  return undefined;
}

export type FeaturePermissions = Record<string, string[]>;

export function hasRouteAccess(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
  route: string,
): boolean {
  if (role === "admin") return true;
  if (!permissions || permissions.length === 0) return route === "/";
  return permissions.includes(route) || route === "/";
}

export function hasSectionAccess(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
  sectionKey: string,
): boolean {
  if (role === "admin") return true;
  if (!permissions || permissions.length === 0) return false;
  const section = APP_SECTIONS.find((s) => s.key === sectionKey);
  if (!section) return false;
  return section.routes.some((r) => permissions.includes(r));
}

export function hasPageAccess(
  role: string | null | undefined,
  permissions: string[] | null | undefined,
  route: string,
): boolean {
  if (role === "admin") return true;
  if (!permissions || permissions.length === 0) return false;
  return permissions.includes(route);
}

export function hasFeatureAccess(
  role: string | null | undefined,
  featurePermissions: FeaturePermissions | null | undefined,
  page: string,
  feature: string,
): boolean {
  if (role === "admin") return true;
  if (role === "viewer") return false;
  if (!featurePermissions) return false;
  const pagePerms = featurePermissions[page];
  if (!pagePerms) return false;
  return pagePerms.includes(feature);
}

export function isEditorRole(role: string | null | undefined): boolean {
  return role === "editor";
}

export function parseFeaturePermissions(raw: string | null | undefined): FeaturePermissions {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
