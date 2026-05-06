
"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ImageOff } from "lucide-react";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    fallbackSrc?: string;
    fallbackComponent?: React.ReactNode;
}

export function SafeImage({
    src,
    alt,
    className,
    fallbackSrc = "/placeholder-reel.jpg",
    fallbackComponent,
    ...props
}: SafeImageProps) {
    const [error, setError] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // If src changes, reset error state
    useEffect(() => {
        setError(false);
    }, [src]);

    if (!mounted) return <div className={cn("bg-slate-100 animate-pulse", className)} />;

    if (error || !src) {
        if (fallbackComponent) {
            return <>{fallbackComponent}</>;
        }

        // If fallbackSrc is also failing (circular), we show a simple icon
        // But for now assumes fallbackSrc is local and safe
        return (
            <img
                src={fallbackSrc}
                alt={alt}
                className={cn("object-cover", className)}
                {...props}
            />
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            className={cn("object-cover", className)}
            referrerPolicy="no-referrer"
            onError={() => setError(true)}
            {...props}
        />
    );
}
