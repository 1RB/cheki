import Image from "next/image";
import { PHOTOS, type PhotoId } from "@/lib/photos";

/**
 * A credited photograph (src/lib/photos.ts). Lazy by default and never on
 * the critical path: every use sits below the first screen. `sizes` is the
 * rendered width, so next/image sends the smallest file that fills it.
 */
export function Photo({ id, sizes, className }: { id: PhotoId; sizes: string; className?: string }) {
  const p = PHOTOS[id];
  return (
    <div className={className ? `photo ${className}` : "photo"}>
      <Image src={p.src} width={p.width} height={p.height} alt={p.alt} sizes={sizes} loading="lazy" decoding="async" />
    </div>
  );
}

/** The one credit line for the photographs a page shows. */
export function PhotoCredits({ ids }: { ids: PhotoId[] }) {
  const unique = [...new Set(ids)];
  return (
    <p className="photo-credits container">
      Photographs:{" "}
      {unique.map((id, i) => {
        const p = PHOTOS[id];
        return (
          <span key={id}>
            {i > 0 && "; "}
            <a href={p.source} target="_blank" rel="noopener noreferrer">{p.creator}</a>,{" "}
            <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer license">{p.license}</a>
          </span>
        );
      })}
      , via Wikimedia Commons.
    </p>
  );
}
