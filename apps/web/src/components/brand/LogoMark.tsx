import Image from "next/image";

type LogoMarkProps = {
    className?: string;
    priority?: boolean;
    sizes?: string;
};

export function LogoMark({ className = "h-8 w-8", priority = false, sizes = "32px" }: LogoMarkProps) {
    return (
        <Image
            src="/craftmyfunnel-logo.png"
            alt="CraftMyFunnel logo"
            width={96}
            height={96}
            priority={priority}
            sizes={sizes}
            className={`shrink-0 rounded-lg object-contain ${className}`}
        />
    );
}
