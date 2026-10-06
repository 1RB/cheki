// The x:image card shares the root Open Graph art. Next resolves these two
// routes independently, so twitter-image re-exports the same generator rather
// than letting the twitter card fall back to no image at all.
export { default, alt, size, contentType } from "./opengraph-image";
