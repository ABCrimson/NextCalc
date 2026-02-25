'use client';

import { motion } from 'framer-motion';

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background/95 to-background">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center space-y-6"
      >
        {/* Animated Logo/Spinner */}
        <div className="flex justify-center">
          <motion.div
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'linear',
            }}
            className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full"
          />
        </div>

        {/* Loading Text */}
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Loading NextCalc Pro
          </h2>
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
            }}
            className="text-muted-foreground"
          >
            Initializing calculator engine...
          </motion.p>
        </div>

        {/* Progress Dots */}
        <div className="flex gap-2 justify-center">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1,
                repeat: Number.POSITIVE_INFINITY,
                delay: index * 0.2,
              }}
              className="w-2 h-2 rounded-full bg-primary"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
