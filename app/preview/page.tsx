import LivePreviewWorkspace from "@/components/live-preview-workspace";

export const metadata = {
  title: "Live Preview | LUXORA AI",
  description: "Edit HTML and inspect a rendered preview in an isolated sandbox."
};

export default function PreviewPage() {
  return <LivePreviewWorkspace />;
}
