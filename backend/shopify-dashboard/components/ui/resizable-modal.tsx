"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type ResizeHandle =
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

interface Size {
  width: number;
  height: number;
}

interface Position {
  top: number;
  left: number;
}

export interface ResizableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  persistKey?: string;
  maintainAspectRatio?: boolean;
  closeOnOverlay?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidthRatio?: number;
  maxHeightRatio?: number;
  disableResize?: boolean;
  className?: string;
  contentClassName?: string;
  resetSignal?: number;
  onSizeChange?: (size: Size) => void;
}

const MIN_MARGIN = 24;
const DEFAULT_MIN_WIDTH = 600;
const DEFAULT_MIN_HEIGHT = 400;
const KEYBOARD_RESIZE_STEP = 24;

const DEFAULT_STORAGE_KEY = "resizable-modal-size";

const storage =
  typeof window !== "undefined"
    ? window.localStorage ?? window.sessionStorage
    : undefined;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computeDefaultSize = (viewportWidth: number, viewportHeight: number): Size => {
  if (!viewportWidth || !viewportHeight) {
    return { width: 960, height: 640 };
  }
  if (viewportWidth < 768) {
    return { width: viewportWidth, height: viewportHeight };
  }
  if (viewportWidth < 1024) {
    return {
      width: Math.min(Math.round(viewportWidth * 0.85), viewportWidth - MIN_MARGIN * 2),
      height: Math.min(Math.round(viewportHeight * 0.85), viewportHeight - MIN_MARGIN * 2),
    };
  }
  return {
    width: Math.min(Math.round(viewportWidth * 0.7), viewportWidth - MIN_MARGIN * 2),
    height: Math.min(Math.round(viewportHeight * 0.8), viewportHeight - MIN_MARGIN * 2),
  };
};

const centerPosition = (size: Size, viewportWidth: number, viewportHeight: number): Position => {
  const left = clamp(Math.round((viewportWidth - size.width) / 2), MIN_MARGIN, Math.max(MIN_MARGIN, viewportWidth - size.width - MIN_MARGIN));
  const top = clamp(Math.round((viewportHeight - size.height) / 2), MIN_MARGIN, Math.max(MIN_MARGIN, viewportHeight - size.height - MIN_MARGIN));
  return { left, top };
};

const getStoredSize = (key?: string): Size | null => {
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.width === "number" && typeof parsed?.height === "number") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

const persistSize = (key: string | undefined, size: Size) => {
  if (!key || !storage) return;
  try {
    storage.setItem(key, JSON.stringify(size));
  } catch {
    // no-op
  }
};

const clearStoredSize = (key?: string) => {
  if (!key || !storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // no-op
  }
};

export default function ResizableModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  headerActions,
  persistKey = DEFAULT_STORAGE_KEY,
  maintainAspectRatio = false,
  closeOnOverlay = true,
  minWidth = DEFAULT_MIN_WIDTH,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxWidthRatio = 0.9,
  maxHeightRatio = 0.9,
  disableResize,
  className,
  contentClassName,
  resetSignal,
  onSizeChange,
}: ResizableModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialisedRef = useRef(false);
  const lastResetSignalRef = useRef<number | undefined>(resetSignal);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [size, setSize] = useState<Size>(() => ({ width: 960, height: 640 }));
  const sizeRef = useRef(size);
  const [position, setPosition] = useState<Position>({ left: 0, top: 0 });
  const positionRef = useRef(position);
  const [isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingDeltaRef = useRef<{ handle: ResizeHandle; deltaX: number; deltaY: number } | null>(null);

  const isMobileViewport = viewport.width > 0 && viewport.width < 768;
  const effectiveDisableResize = disableResize || isMobileViewport;

  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const maxWidth = useMemo(() => {
    if (!viewport.width) return minWidth;
    return Math.min(viewport.width * maxWidthRatio, viewport.width - MIN_MARGIN * 2);
  }, [viewport.width, maxWidthRatio, minWidth]);

  const maxHeight = useMemo(() => {
    if (!viewport.height) return minHeight;
    return Math.min(viewport.height * maxHeightRatio, viewport.height - MIN_MARGIN * 2);
  }, [viewport.height, maxHeightRatio, minHeight]);

  const initializeSize = useCallback(
    (shouldClearPersisted?: boolean) => {
      if (!viewport.width || !viewport.height) return;
      if (shouldClearPersisted) {
        clearStoredSize(persistKey);
      }
      const stored = getStoredSize(persistKey);
      const baseline = stored ?? computeDefaultSize(viewport.width, viewport.height);
      const clampedWidth = clamp(baseline.width, minWidth, maxWidth);
      const clampedHeight = clamp(baseline.height, minHeight, maxHeight);
      const nextSize = isMobileViewport
        ? { width: viewport.width, height: viewport.height }
        : { width: clampedWidth, height: clampedHeight };
      const nextPosition = isMobileViewport
        ? { left: 0, top: 0 }
        : centerPosition(nextSize, viewport.width, viewport.height);
      setSize(nextSize);
      sizeRef.current = nextSize;
      setPosition(nextPosition);
      positionRef.current = nextPosition;
      initialisedRef.current = true;
    },
    [persistKey, viewport.width, viewport.height, isMobileViewport, minWidth, maxWidth, minHeight, maxHeight],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const shouldClear = typeof resetSignal === "number" && resetSignal !== lastResetSignalRef.current;
    initializeSize(shouldClear);
    lastResetSignalRef.current = resetSignal;
  }, [isOpen, initializeSize, resetSignal]);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const modal = containerRef.current;
    const firstFocusable = modal.querySelector<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
    );
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !containerRef.current || !onSizeChange) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries.at(0);
      if (entry) {
        const { width, height } = entry.contentRect;
        onSizeChange({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isOpen, onSizeChange]);

  useEffect(() => {
    if (!isOpen) return;
    if (!viewport.width || !viewport.height) return;
    if (!initialisedRef.current) return;

    if (isMobileViewport) {
      const full = { width: viewport.width, height: viewport.height };
      setSize(full);
      sizeRef.current = full;
      const origin = { left: 0, top: 0 };
      setPosition(origin);
      positionRef.current = origin;
      return;
    }

    setSize(prev => {
      const newWidth = clamp(prev.width, minWidth, maxWidth);
      const newHeight = clamp(prev.height, minHeight, maxHeight);
      const updated = { width: newWidth, height: newHeight };
      sizeRef.current = updated;
      return updated;
    });

    setPosition(prev => {
      const maxLeft = Math.max(MIN_MARGIN, viewport.width - sizeRef.current.width - MIN_MARGIN);
      const maxTop = Math.max(MIN_MARGIN, viewport.height - sizeRef.current.height - MIN_MARGIN);
      const next = {
        left: clamp(prev.left, MIN_MARGIN, maxLeft),
        top: clamp(prev.top, MIN_MARGIN, maxTop),
      };
      positionRef.current = next;
      return next;
    });
  }, [viewport.width, viewport.height, isOpen, isMobileViewport, minWidth, maxWidth, minHeight, maxHeight]);

  const stopResize = useCallback(() => {
    setIsResizing(false);
    setActiveHandle(null);
    lastPointerRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingDeltaRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (!effectiveDisableResize) {
      persistSize(persistKey, sizeRef.current);
    }
  }, [effectiveDisableResize, persistKey]);

  useEffect(() => {
    if (!isOpen || !isResizing) return;
    const handleMouseUp = () => stopResize();
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    window.addEventListener("touchcancel", handleMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchcancel", handleMouseUp);
    };
  }, [isOpen, isResizing, stopResize]);

  const applyResize = useCallback(
    (handle: ResizeHandle, deltaX: number, deltaY: number) => {
      const currentSize = sizeRef.current;
      const currentPosition = positionRef.current;
      if (!currentSize || !currentPosition) return;

      let left = currentPosition.left;
      let top = currentPosition.top;
      let right = currentPosition.left + currentSize.width;
      let bottom = currentPosition.top + currentSize.height;

      if (handle.includes("left")) {
        left += deltaX;
      }
      if (handle.includes("right")) {
        right += deltaX;
      }
      if (handle.includes("top")) {
        top += deltaY;
      }
      if (handle.includes("bottom")) {
        bottom += deltaY;
      }

      let newWidth = right - left;
      let newHeight = bottom - top;

      const aspectRatio = currentSize.width / currentSize.height || 1.3;

      if (maintainAspectRatio && !effectiveDisableResize) {
        if (!handle.includes("left") && !handle.includes("right")) {
          newWidth = newHeight * aspectRatio;
          right = left + newWidth;
        } else if (!handle.includes("top") && !handle.includes("bottom")) {
          newHeight = newWidth / aspectRatio;
          bottom = top + newHeight;
        } else {
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            newHeight = newWidth / aspectRatio;
            if (handle.includes("top")) {
              top = bottom - newHeight;
            } else {
              bottom = top + newHeight;
            }
          } else {
            newWidth = newHeight * aspectRatio;
            if (handle.includes("left")) {
              left = right - newWidth;
            } else {
              right = left + newWidth;
            }
          }
        }
      }

      const minAllowedWidth = Math.min(minWidth, maxWidth);
      const minAllowedHeight = Math.min(minHeight, maxHeight);

      if (newWidth < minAllowedWidth) {
        if (handle.includes("left")) {
          left = right - minAllowedWidth;
        } else {
          right = left + minAllowedWidth;
        }
        newWidth = minAllowedWidth;
      }
      if (newHeight < minAllowedHeight) {
        if (handle.includes("top")) {
          top = bottom - minAllowedHeight;
        } else {
          bottom = top + minAllowedHeight;
        }
        newHeight = minAllowedHeight;
      }

      if (newWidth > maxWidth) {
        if (handle.includes("left")) {
          left = right - maxWidth;
        } else {
          right = left + maxWidth;
        }
        newWidth = maxWidth;
      }
      if (newHeight > maxHeight) {
        if (handle.includes("top")) {
          top = bottom - maxHeight;
        } else {
          bottom = top + maxHeight;
        }
        newHeight = maxHeight;
      }

      const minLeft = MIN_MARGIN;
      const minTop = MIN_MARGIN;
      const maxRightEdge = viewport.width - MIN_MARGIN;
      const maxBottomEdge = viewport.height - MIN_MARGIN;

      if (left < minLeft) {
        const offset = minLeft - left;
        left += offset;
        right += offset;
      }
      if (right > maxRightEdge) {
        const offset = right - maxRightEdge;
        left -= offset;
        right -= offset;
      }
      if (top < minTop) {
        const offset = minTop - top;
        top += offset;
        bottom += offset;
      }
      if (bottom > maxBottomEdge) {
        const offset = bottom - maxBottomEdge;
        top -= offset;
        bottom -= offset;
      }

      const finalWidth = clamp(right - left, minAllowedWidth, maxWidth);
      const finalHeight = clamp(bottom - top, minAllowedHeight, maxHeight);
      const finalPosition = {
        left: clamp(left, MIN_MARGIN, Math.max(MIN_MARGIN, viewport.width - finalWidth - MIN_MARGIN)),
        top: clamp(top, MIN_MARGIN, Math.max(MIN_MARGIN, viewport.height - finalHeight - MIN_MARGIN)),
      };

      const nextSize = { width: Math.round(finalWidth), height: Math.round(finalHeight) };
      setSize(nextSize);
      sizeRef.current = nextSize;
      setPosition(finalPosition);
      positionRef.current = finalPosition;
    },
    [maintainAspectRatio, effectiveDisableResize, minWidth, maxWidth, minHeight, maxHeight, viewport.width, viewport.height],
  );

  const scheduleResize = useCallback(
    (handle: ResizeHandle, deltaX: number, deltaY: number) => {
      if (!isOpen) return;
      if (pendingDeltaRef.current) {
        pendingDeltaRef.current.deltaX += deltaX;
        pendingDeltaRef.current.deltaY += deltaY;
      } else {
        pendingDeltaRef.current = { handle, deltaX, deltaY };
      }
      if (rafIdRef.current === null) {
        rafIdRef.current = window.requestAnimationFrame(() => {
          if (pendingDeltaRef.current) {
            const current = pendingDeltaRef.current;
            pendingDeltaRef.current = null;
            applyResize(current.handle, current.deltaX, current.deltaY);
          }
          if (rafIdRef.current) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
          }
        });
      }
    },
    [applyResize, isOpen],
  );

  const startResize = useCallback(
    (handle: ResizeHandle, clientX: number, clientY: number, cursor: string) => {
      if (effectiveDisableResize) return;
      setIsResizing(true);
      setActiveHandle(handle);
      lastPointerRef.current = { x: clientX, y: clientY };
      document.body.style.cursor = cursor;
      document.body.style.userSelect = "none";
    },
    [effectiveDisableResize],
  );

  const processPointerMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!isResizing || !activeHandle || effectiveDisableResize) return;
      const point = "touches" in event ? event.touches[0] : event;
      if (!lastPointerRef.current) {
        lastPointerRef.current = { x: point.clientX, y: point.clientY };
        return;
      }
      const deltaX = point.clientX - lastPointerRef.current.x;
      const deltaY = point.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: point.clientX, y: point.clientY };
      scheduleResize(activeHandle, deltaX, deltaY);
    },
    [isResizing, activeHandle, scheduleResize, effectiveDisableResize],
  );

  useEffect(() => {
    if (!isOpen || !isResizing) return;
    window.addEventListener("mousemove", processPointerMove);
    window.addEventListener("touchmove", processPointerMove, { passive: false });
    return () => {
      window.removeEventListener("mousemove", processPointerMove);
      window.removeEventListener("touchmove", processPointerMove);
    };
  }, [isOpen, isResizing, processPointerMove]);

  const handleKeyboardResize = useCallback(
    (handle: ResizeHandle, event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (effectiveDisableResize) return;
      const step = event.shiftKey ? KEYBOARD_RESIZE_STEP * 2 : KEYBOARD_RESIZE_STEP;
      if (event.key === "ArrowLeft") {
        scheduleResize(handle, handle.includes("left") ? -step : handle.includes("right") ? step : -step, 0);
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        scheduleResize(handle, handle.includes("left") ? step : handle.includes("right") ? -step : step, 0);
        event.preventDefault();
      } else if (event.key === "ArrowUp") {
        scheduleResize(handle, 0, handle.includes("top") ? -step : handle.includes("bottom") ? step : -step);
        event.preventDefault();
      } else if (event.key === "ArrowDown") {
        scheduleResize(handle, 0, handle.includes("top") ? step : handle.includes("bottom") ? -step : step);
        event.preventDefault();
      }
    },
    [scheduleResize, effectiveDisableResize],
  );

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingDeltaRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const shadowStrength = viewport.width
    ? 0.18 + Math.min(size.width / viewport.width, 1) * 0.07
    : 0.24;

  const handles: Array<{
    id: ResizeHandle;
    className: string;
    cursor: string;
    ariaLabel: string;
  }> = [
    {
      id: "top",
      className: "top-0 left-0 flex w-full h-[12px] -translate-y-1/2 cursor-ns-resize",
      cursor: "ns-resize",
      ariaLabel: "Resize from top edge",
    },
    {
      id: "right",
      className: "right-0 top-0 flex h-full w-[12px] translate-x-1/2 cursor-ew-resize",
      cursor: "ew-resize",
      ariaLabel: "Resize from right edge",
    },
    {
      id: "bottom",
      className: "bottom-0 left-0 flex w-full h-[12px] translate-y-1/2 cursor-ns-resize",
      cursor: "ns-resize",
      ariaLabel: "Resize from bottom edge",
    },
    {
      id: "left",
      className: "left-0 top-0 flex h-full w-[12px] -translate-x-1/2 cursor-ew-resize",
      cursor: "ew-resize",
      ariaLabel: "Resize from left edge",
    },
    {
      id: "top-left",
      className: "left-0 top-0 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
      cursor: "nwse-resize",
      ariaLabel: "Resize from top left corner",
    },
    {
      id: "top-right",
      className: "right-0 top-0 h-5 w-5 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
      cursor: "nesw-resize",
      ariaLabel: "Resize from top right corner",
    },
    {
      id: "bottom-left",
      className: "left-0 bottom-0 h-5 w-5 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
      cursor: "nesw-resize",
      ariaLabel: "Resize from bottom left corner",
    },
    {
      id: "bottom-right",
      className: "right-0 bottom-0 h-5 w-5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
      cursor: "nwse-resize",
      ariaLabel: "Resize from bottom right corner",
    },
  ];

  const handleMouseDown = (handle: ResizeHandle, cursor: string) => (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    const point = "touches" in event ? event.touches[0] : event;
    startResize(handle, point.clientX, point.clientY, cursor);
  };

  const dimensionTooltip = `${size.width}px × ${size.height}px`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={closeOnOverlay ? onClose : undefined} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resizable-modal-title"
        className={cn(
          "absolute flex max-h-[90vh] w-full max-w-full flex-col rounded-2xl border border-white/10 bg-white shadow-2xl transition-[box-shadow,border] duration-200",
          isResizing ? "ring-2 ring-[#D4A574]" : "ring-1 ring-black/5",
          className,
        )}
        style={
          {
            width: isMobileViewport ? "100vw" : `${size.width}px`,
            height: isMobileViewport ? "100vh" : `${size.height}px`,
            left: isMobileViewport ? 0 : `${position.left}px`,
            top: isMobileViewport ? 0 : `${position.top}px`,
            boxShadow: `0 30px 90px rgba(15,23,42,${shadowStrength})`,
            borderRadius: isMobileViewport ? "0px" : "24px",
            "--resizable-modal-width": `${size.width}px`,
            "--resizable-modal-height": `${size.height}px`,
          } as React.CSSProperties
        }
      >
        <header className="flex flex-wrap items-start gap-4 border-b border-[#E8E4DE] px-6 py-5">
          <div className="flex-1 min-w-[200px] pr-8">
            <h2 id="resizable-modal-title" className="text-2xl font-semibold text-[#2B2118]">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm text-[#7A6A5A]">{subtitle}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 transition hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D4A574] rounded-full"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className={cn("flex-1 overflow-hidden px-6 py-5", contentClassName)}>{children}</div>

        {footer ? <div className="border-t border-[#E8E4DE] bg-[#FAF9F6] px-6 py-4">{footer}</div> : null}

        {!effectiveDisableResize
          ? handles.map(handle => {
              const indicatorClass =
                handle.id === "top" || handle.id === "bottom"
                  ? "h-0.5 w-12 rounded-full bg-[#D4A574]"
                  : handle.id === "left" || handle.id === "right"
                    ? "h-12 w-0.5 rounded-full bg-[#D4A574]"
                    : "h-2 w-2 rounded-full bg-[#D4A574]";
              const isActive = activeHandle === handle.id;
              return (
                <button
                  key={handle.id}
                  type="button"
                  aria-label={handle.ariaLabel}
                  className={cn(
                    "group absolute z-20 flex items-center justify-center rounded-full border border-transparent bg-transparent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A574] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                    handle.className,
                  )}
                  onMouseDown={handleMouseDown(handle.id, handle.cursor)}
                  onTouchStart={handleMouseDown(handle.id, handle.cursor)}
                  tabIndex={0}
                  onKeyDown={event => handleKeyboardResize(handle.id, event)}
                >
                  <span
                    className={cn(
                      "pointer-events-none opacity-0 transition duration-150",
                      indicatorClass,
                      isActive ? "opacity-90" : "group-hover:opacity-70",
                    )}
                  />
                </button>
              );
            })
          : null}

        {isResizing ? (
          <div className="pointer-events-none absolute -top-10 right-6 rounded-full border border-white/60 bg-gray-900 px-3 py-1 text-xs font-semibold text-white shadow-lg">
            {dimensionTooltip}
          </div>
        ) : null}
      </div>
    </div>
  );
}


