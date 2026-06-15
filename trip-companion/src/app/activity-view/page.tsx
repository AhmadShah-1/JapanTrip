import { readFile } from "node:fs/promises";
import path from "node:path";

export default async function ActivityViewPage() {
  const htmlPath = path.join(
    process.cwd(),
    "src",
    "data",
    "source",
    "japan-korea.html",
  );
  const html = await readFile(htmlPath, "utf8");

  return (
    <main className="activity-view-page">
      <iframe
        title="Japan Korea activity view"
        srcDoc={html}
        className="activity-view-frame"
      />
    </main>
  );
}
