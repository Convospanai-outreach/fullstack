import * as React from "react";

export interface ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
}

export default function Image({ src, alt, width, height, priority, fill, ...rest }: ImageProps) {
  return <img src={src} alt={alt} width={width} height={height} {...rest} />;
}
