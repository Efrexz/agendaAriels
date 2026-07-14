import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  errors: string[];
  mascotSrc?: string;
  mascotAlt?: string;
  title?: string;
  buttonText?: string;
}

export function ErrorModal({
  open,
  onClose,
  errors,
  mascotSrc = "/images/vetMascot/error-dog.png",
  mascotAlt = "Mascota veterinaria",
  title = "¡Guau! Esto necesita atención",
  buttonText = "Entendido",
}: ErrorModalProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="error-modal-title"
        >
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
          />

          <motion.div
            className="relative z-10 flex w-full max-w-lg flex-col items-center gap-5 overflow-hidden rounded-3xl border-2 border-orange-200 bg-white p-6 shadow-2xl sm:max-w-xl sm:flex-row sm:gap-6 sm:p-8"
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="flex max-h-[90vh] w-full flex-col items-center gap-5 sm:flex-row sm:gap-6">
              <motion.div
                className="flex h-28 w-28 shrink-0 items-center justify-center sm:h-44 sm:w-44"
                initial={{ y: 10, rotate: -2 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <motion.img
                  src={mascotSrc}
                  alt={mascotAlt}
                  className="h-full w-full object-contain"
                  animate={{ y: [0, -4, 0], rotate: [-1, 1, -1] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </motion.div>

              <motion.div
                className="relative w-full flex-1 rounded-2xl bg-blue-50 p-4 sm:p-5"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <span className="absolute -left-2 top-6 hidden h-0 w-0 border-y-8 border-r-8 border-y-transparent border-r-blue-50 sm:block" />
                <span className="absolute -top-2 left-10 h-0 w-0 border-x-8 border-b-8 border-x-transparent border-b-blue-50 sm:hidden" />
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-1 w-5 rounded-full bg-orange-500" />
                  <h3 id="error-modal-title" className="text-sm font-bold uppercase tracking-wide text-orange-600">
                    {title}
                  </h3>
                </div>

                <ul className="mb-4 space-y-2">
                  {errors.map((err, idx) => (
                    <motion.li
                      key={`${err}-${idx}`}
                      className="flex items-start gap-2 text-sm font-medium leading-snug text-[#1A2238] sm:text-base"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, delay: 0.15 + idx * 0.06 }}
                    >
                      <span className="mt-0.5 text-orange-500" aria-hidden>🐾</span>
                      <span>{err}</span>
                    </motion.li>
                  ))}
                </ul>

                <button
                  ref={buttonRef}
                  type="button"
                  onClick={onClose}
                  className="w-full cursor-pointer rounded-xl bg-blue-600 py-3 text-base font-bold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] sm:py-3.5"
                >
                  {buttonText}
                </button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}