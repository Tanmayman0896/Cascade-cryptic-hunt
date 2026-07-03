"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  name: z.string().min(1, 'Agent designation required'),
  email: z.string().email('Valid comm-link required'),
  teamName: z.string().min(1, 'Team designation required'),
  password: z.string().min(1, 'Password required'),
});

export type AuthFormValues = z.infer<typeof schema>;

interface LandingAuthProps {
  onSubmit: (data: AuthFormValues) => void;
  isLoading?: boolean;
}

export default function LandingAuth({ onSubmit, isLoading = false }: LandingAuthProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AuthFormValues>({
    resolver: zodResolver(schema)
  });

  const loading = isLoading || isSubmitting;

  return (
    <motion.div
      className="min-h-[100dvh] w-full relative flex items-center justify-center overflow-hidden bg-[#050508] p-4 text-[#2c1a1a]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      data-testid="screen-login"
    >
      {/* Background Poster */}
      <Image
        src="/poster.avif"
        alt="Poster Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center z-0"
      />
      {/* Dark overlay for ambient contrast & readability */}
      <div className="absolute inset-0 z-0 bg-black/65 pointer-events-none" />

      {/* Red string decoration */}
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none opacity-40">
        <line x1="0" y1="10%" x2="100%" y2="80%" stroke="#CC0000" strokeWidth="2" strokeDasharray="10 5" />
        <line x1="0" y1="90%" x2="100%" y2="20%" stroke="#CC0000" strokeWidth="2" strokeDasharray="15 5" />
      </svg>

      {/* Case File Card */}
      <motion.div
        className="relative z-10 w-full max-w-md bg-parchment rounded shadow-2xl overflow-hidden text-[#2c1a1a]"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
      >
        {/* Loading Progress Bar at top of parchment card */}
        {loading && (
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#8B1A1A]/20 overflow-hidden z-40">
            <div className="w-full h-full bg-[#8B1A1A] animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
        )}

        {/* Paperclip */}
        <div className="absolute top-2 right-4 w-6 h-16 border-2 border-gray-500/80 rounded-full bg-transparent transform rotate-12 shadow-sm z-20 pointer-events-none" />
        <div className="absolute top-4 right-5 w-4 h-12 border-2 border-gray-500/80 rounded-full bg-transparent transform rotate-12 z-20 pointer-events-none border-t-0" />

        <div className="p-8 pb-12 relative border-[1px] border-[#2c1a1a]/10 m-2">

          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-primary/40 pb-4">
            <p className="font-space-mono text-xs font-bold tracking-widest text-[#8B1A1A]/80 mb-2">
              IEEE COMPUTER SOCIETY MUJ PRESENTS
            </p>
            <h1 className="font-oswald text-6xl font-bold text-[#8B1A1A] tracking-tighter uppercase distress-text leading-none drop-shadow-sm">
              CASCADE
            </h1>
            <p className="font-special-elite text-sm tracking-[0.2em] mt-3 font-bold">
              A 12 HOUR CRYPTIC HUNT
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 relative z-30">
            <div>
              <label className="block font-special-elite text-sm mb-1 font-bold">NAME</label>
              <input
                {...register("name")}
                disabled={loading}
                className="w-full bg-transparent border-b-2 border-[#2c1a1a]/40 focus:border-[#8B1A1A] outline-none py-2 font-space-mono text-lg transition-colors disabled:opacity-60"
                placeholder="Agent designation..."
                data-testid="input-name"
              />
              {errors.name && <p className="text-[#CC0000] text-xs mt-1 font-space-mono font-bold">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block font-special-elite text-sm mb-1 font-bold">EMAIL</label>
              <input
                {...register("email")}
                disabled={loading}
                className="w-full bg-transparent border-b-2 border-[#2c1a1a]/40 focus:border-[#8B1A1A] outline-none py-2 font-space-mono text-lg transition-colors disabled:opacity-60"
                placeholder="Secure email..."
                data-testid="input-email"
              />
              {errors.email && <p className="text-[#CC0000] text-xs mt-1 font-space-mono font-bold">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block font-special-elite text-sm mb-1 font-bold">TEAM NAME</label>
              <input
                {...register("teamName")}
                disabled={loading}
                className="w-full bg-transparent border-b-2 border-[#2c1a1a]/40 focus:border-[#8B1A1A] outline-none py-2 font-space-mono text-lg transition-colors disabled:opacity-60"
                placeholder="Team designation..."
                data-testid="input-team-name"
              />
              {errors.teamName && <p className="text-[#CC0000] text-xs mt-1 font-space-mono font-bold">{errors.teamName.message}</p>}
            </div>

            <div>
              <label className="block font-special-elite text-sm mb-1 font-bold">PASSWORD</label>
              <input
                type="password"
                {...register("password")}
                disabled={loading}
                className="w-full bg-transparent border-b-2 border-[#2c1a1a]/40 focus:border-[#8B1A1A] outline-none py-2 font-space-mono text-lg transition-colors disabled:opacity-60"
                placeholder="Secure password..."
                data-testid="input-password"
              />
              {errors.password && <p className="text-[#CC0000] text-xs mt-1 font-space-mono font-bold">{errors.password.message}</p>}
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#8B1A1A] text-[#e8e0d0] font-special-elite text-xl py-4 uppercase tracking-widest hover:bg-[#5a0c0c] disabled:bg-[#5a0c0c]/85 disabled:cursor-not-allowed transition-all duration-300 relative overflow-hidden group cursor-pointer flex items-center justify-center gap-3"
                data-testid="button-enter"
              >
                {loading ? (
                  <span className="relative z-10 flex items-center justify-center gap-3 font-bold text-lg tracking-widest text-[#e8e0d0]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#e8e0d0]" />
                    <span className="animate-pulse">AUTHENTICATING...</span>
                  </span>
                ) : (
                  <span className="relative z-10 block group-hover:scale-105 transition-transform font-bold">
                    ENTER
                  </span>
                )}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-30 mix-blend-overlay"></div>
              </button>
            </div>
          </form>

          {/* Fingerprint decoration at bottom corner */}
          <div className="absolute bottom-2 right-2 opacity-[0.15] pointer-events-none rotate-[-15deg]">
            <svg width="60" height="80" viewBox="0 0 60 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 40C15 31.7157 21.7157 25 30 25C38.2843 25 45 31.7157 45 40" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 4" />
              <path d="M10 40C10 28.9543 18.9543 20 30 20C41.0457 20 50 28.9543 50 40" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 3" />
              <path d="M5 40C5 26.1929 16.1929 15 30 15C43.8071 15 55 26.1929 55 40" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2 8 4" />
              <path d="M20 40C20 34.4772 24.4772 30 30 30C35.5228 30 40 34.4772 40 40" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M25 40C25 37.2386 27.2386 35 30 35C32.7614 35 35 37.2386 35 40" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M30 40V42" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M15 40V55C15 58 17 62 22 65" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 3" />
              <path d="M10 40V60C10 65 14 70 20 72" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="7 2" />
              <path d="M5 40V65C5 72 11 78 18 80" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" />
              <path d="M45 40V55C45 58 43 62 38 65" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="6 3" />
              <path d="M50 40V60C50 65 46 70 40 72" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="5 4" />
              <path d="M55 40V65C55 72 49 78 42 80" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="8 2" />
              <path d="M20 40V50C20 53 22 56 26 58" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M25 40V45C25 47 27 49 30 50" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M40 40V50C40 53 38 56 34 58" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M35 40V45C35 47 33 49 30 50" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M30 46V65" stroke="#2c1a1a" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 2" />
            </svg>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
