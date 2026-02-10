"use client";
import Link from "next/link";
import { useState } from "react";

export default function Nav() {
    const [open, setOpen] = useState(false);

    return (
        <nav>
            <button onClick={() => setOpen(!open)} className="md:hidden text-gray-300">☰</button>

            <ul className={`md:flex gap-8 ${open ? "block" : "hidden"} md:block`}>
                <li><Link href="/about">About</Link></li>
                <li className="md:hidden"><Link href="/pricing">Pricing</Link></li>
                <li><Link href="/faq">FAQ</Link></li>
                <li><Link href="/dashboard">Dashboard</Link></li>
            </ul>
        </nav>
    );
}
