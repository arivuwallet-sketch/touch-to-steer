export const docNavigation = [
  { id: "privacy", title: "Privacy policy" },
  { id: "legal", title: "Legal & licensing" },
  { id: "troubleshooting", title: "Troubleshooting" },
  { id: "downloads", title: "Downloads" },
  { id: "tutorials", title: "Tutorials" },
  { id: "game-setup", title: "Game-specific setup" },
  { id: "support", title: "Contact support" },
] as const;
export type DocId = (typeof docNavigation)[number]["id"];
