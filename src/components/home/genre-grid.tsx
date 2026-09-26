"use client";

import Link from "next/link";
import type { Genre } from "@/lib/types";
import { StaggerGroup, staggerItem } from "@/components/motion/fade-in";
import { motion } from "framer-motion";

const TILE =
  "group panel panel-hover flex items-center justify-center px-4 py-3 text-center text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-primary-400/40 hover:text-white active:scale-[0.97]";

/** `showAllHref` adds a last tile that leads to the full list of categories, for a grid that shows only a selection. */
export function GenreGrid({ genres, showAllHref }: { genres: Genre[]; showAllHref?: string }) {
  return (
    <StaggerGroup className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {genres.map((genre) => (
        <motion.div key={genre.id} variants={staggerItem}>
          <Link href={`/search?genre=${genre.slug}`} className={`${TILE} text-lunex-gray`}>
            {genre.nameAr}
          </Link>
        </motion.div>
      ))}
      {showAllHref && (
        <motion.div variants={staggerItem}>
          <Link href={showAllHref} className={`${TILE} text-primary-300`}>
            كل التصنيفات
          </Link>
        </motion.div>
      )}
    </StaggerGroup>
  );
}
