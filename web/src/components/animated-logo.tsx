'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';

export function AnimatedLogo() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex items-center justify-center relative"
    >
      <div className="relative h-52 w-52 overflow-hidden sm:h-64 sm:w-64 lg:h-80 lg:w-80">
        <Image
          src="/rallio.svg"
          alt="Rallio logo"
          width={240}
          height={240}
          className="h-full w-full object-contain"
          priority
        />
        <motion.div
          animate={{
            x: ['-180%', '220%'],
          }}
          transition={{
            duration: 2,
            ease: 'linear',
            repeat: Infinity,
          }}
          className="absolute inset-y-0 left-0 w-1/2 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)',
          }}
        />
      </div>
    </motion.div>
  );
}
