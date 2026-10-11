import { createFileRoute } from "@tanstack/react-router";

import { Desktop } from "@/components/minios/Desktop";
import { DesktopProvider } from "@/lib/minios/store";

const title = "Gesture OS AI";
const description =
  "An AI-native browser desktop shell with draggable windows, three window modes, workspaces, tiling, notes, and local persistence.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <DesktopProvider>
      <Desktop />
    </DesktopProvider>
  );
}
