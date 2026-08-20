import * as React from "react";

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  prefetch?: boolean;
  scroll?: boolean;
  replace?: boolean;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, prefetch, scroll, replace, children, ...rest },
  ref
) {
  return (
    <a ref={ref} href={href} {...rest}>
      {children}
    </a>
  );
});

export default Link;
