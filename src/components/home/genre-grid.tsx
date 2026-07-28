"use client";

import Link from "next/link";
import type { Genre } from "@/lib/types";
import { StaggerGroup, staggerItem } from "@/components/motion/fade-in";
import { motion } from "framer-motion";

export function GenreGrid({ genres }: { genres: Genre[] }) {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {genres.map((genre) => (
        <motion.div key={genre.id} variants={staggerItem}>
          <Link
            href={`/search?genre=${genre.slug}`}
            className="group flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-semibold text-lunex-gray backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-primary-400/40 hover:text-white hover:shadow-glow"
          >
            {genre.nameAr}
          </Link>
        </motion.div>
      ))}
    </StaggerGroup>
  );
}
