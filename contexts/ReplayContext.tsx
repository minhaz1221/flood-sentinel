"use client";

import {
  createContext, useContext, useState, useRef, useCallback, useEffect,
} from "react";
import {
  interpolateFrame, MIN_HOUR, MAX_HOUR, HERO_HOUR,
} from "@/lib/replay-data";
import type { ReplayFrame } from "@/lib/replay-data";

interface ReplayState {
  isActive: boolean;
  currentHour: number;
  isPlaying: boolean;
  speed: 1 | 2 | 4 | 8;
  currentFrame: ReplayFrame;
  showHeroModal: boolean;
  start: () => void;
  stop: () => void;
  play: () => void;
  pause: () => void;
  seek: (hour: number) => void;
  setSpeed: (s: 1 | 2 | 4 | 8) => void;
  dismissHeroModal: () => void;
}

const ReplayContext = createContext<ReplayState | null>(null);

export function useReplay() {
  const ctx = useContext(ReplayContext);
  if (!ctx) throw new Error("useReplay must be inside ReplayProvider");
  return ctx;
}

export function ReplayProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive]         = useState(false);
  const [currentHour, setCurrentHour]   = useState(MIN_HOUR);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [speed, setSpeedState]          = useState<1 | 2 | 4 | 8>(1);
  const [showHeroModal, setShowHeroModal] = useState(false);

  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef      = useRef<1 | 2 | 4 | 8>(1);
  const heroFiredRef  = useRef(false);
  const prevHourRef   = useRef(MIN_HOUR);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setCurrentHour((h) => {
        const next = Math.min(h + speedRef.current, MAX_HOUR);
        return next;
      });
    }, 1000);
  }, [clearTimer]);

  // Auto-stop when reaching end
  useEffect(() => {
    if (isPlaying && currentHour >= MAX_HOUR) {
      clearTimer();
      setIsPlaying(false);
    }
  }, [currentHour, isPlaying, clearTimer]);

  // Detect crossing HERO_HOUR for the first time
  useEffect(() => {
    if (
      isActive &&
      !heroFiredRef.current &&
      prevHourRef.current < HERO_HOUR &&
      currentHour >= HERO_HOUR
    ) {
      heroFiredRef.current = true;
      setShowHeroModal(true);
    }
    prevHourRef.current = currentHour;
  }, [currentHour, isActive]);

  const start = useCallback(() => {
    heroFiredRef.current = false;
    prevHourRef.current = MIN_HOUR;
    setCurrentHour(MIN_HOUR);
    setShowHeroModal(false);
    setIsActive(true);
    setIsPlaying(true);
    startTimer();
  }, [startTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setIsActive(false);
    setCurrentHour(MIN_HOUR);
    setIsPlaying(false);
    setShowHeroModal(false);
    heroFiredRef.current = false;
    prevHourRef.current = MIN_HOUR;
  }, [clearTimer]);

  const play = useCallback(() => {
    if (!isActive) return;
    setIsPlaying(true);
    startTimer();
  }, [isActive, startTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setIsPlaying(false);
  }, [clearTimer]);

  const seek = useCallback((hour: number) => {
    const clamped = Math.max(MIN_HOUR, Math.min(MAX_HOUR, Math.round(hour)));
    setCurrentHour(clamped);
    // restart timer if playing
    if (isPlaying) startTimer();
  }, [isPlaying, startTimer]);

  const setSpeed = useCallback((s: 1 | 2 | 4 | 8) => {
    speedRef.current = s;
    setSpeedState(s);
    if (isPlaying) startTimer();
  }, [isPlaying, startTimer]);

  const dismissHeroModal = useCallback(() => {
    setShowHeroModal(false);
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const currentFrame = interpolateFrame(currentHour);

  return (
    <ReplayContext.Provider value={{
      isActive, currentHour, isPlaying, speed, currentFrame, showHeroModal,
      start, stop, play, pause, seek, setSpeed, dismissHeroModal,
    }}>
      {children}
    </ReplayContext.Provider>
  );
}
