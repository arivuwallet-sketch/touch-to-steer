import { createFileRoute } from "@tanstack/react-router";
import { DocumentationPage } from "@/components/docs/DocumentationPage";
import { documentation } from "@/lib/documentation";
const page = documentation["troubleshooting"];
export const Route = createFileRoute("/troubleshooting")({
  head: () => ({
    meta: [
      { title: `${page.title} — TouchToSteer` },
      { name: "description", content: page.description },
      { property: "og:title", content: `${page.title} — TouchToSteer` },
      { property: "og:description", content: page.description },
    ],
  }),
  component: () => <DocumentationPage pageId="troubleshooting" />,
});
