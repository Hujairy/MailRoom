/* eslint-disable */
import * as React from 'react';
/** A picture across the top of a page. `crop` trims a photo to a fixed height; otherwise the whole picture shows. */
export function PageBanner({ src, crop = false }: { src: string; crop?: boolean }) {
  return (
    <div className={`page-banner${crop ? ' is-crop' : ''}`}>
      <img src={src} alt="" />
    </div>
  );
}
