import { db } from "./utils/firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  MapPin,
  Trash2,
  CheckCircle2,
  Activity,
  Moon,
  Sun,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Reminder, UserLocation, GeoStatus } from "./types";
import { calculateDistance, formatDistance } from "./utils/geoUtils";
import { AddReminderModal } from "./components/AddReminderModal";
import { TriggeredReminderModal } from "./components/TriggeredReminderModal";
import { speakReminder } from "./services/ttsService";

const App: React.FC = () => {
  /* ================= UI STATE ================= */

  const [dark, setDark] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTriggeredReminder, setActiveTriggeredReminder] =
    useState<Reminder | null>(null);

  /* ================= PWA INSTALL STATE ================= */

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  /* ================= APP STATE ================= */

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [filter, setFilter] = useState<"active" | "triggered" | "completed">(
    "active",
  );

  const [trackingStatus, setTrackingStatus] = useState<GeoStatus>({
    active: false,
    error: null,
    lastUpdate: null,
  });

  const watchIdRef = useRef<number | null>(null);

  /* ================= LOAD REMINDERS ================= */

  useEffect(() => {
    const fetchReminders = async () => {
      const snapshot = await getDocs(collection(db, "reminders"));
      const loaded = snapshot.docs.map((doc) => doc.data());
      setReminders(loaded as Reminder[]);
    };
    fetchReminders();
  }, []);

  /* ================= PWA INSTALL LOGIC ================= */

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();

      // If already installed → don't show
      if (window.matchMedia("(display-mode: standalone)").matches) return;

      // If already shown once → don't show again
      if (localStorage.getItem("pwa-install-seen")) return;

      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  useEffect(() => {
    if (!deferredPrompt) return;

    const timer = setTimeout(async () => {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;

      localStorage.setItem("pwa-install-seen", "true");
      setDeferredPrompt(null);
    }, 1000);

    return () => clearTimeout(timer);
  }, [deferredPrompt]);

  useEffect(() => {
    window.addEventListener("appinstalled", () => {
      localStorage.setItem("pwa-install-seen", "true");
    });
  }, []);

  /* ================= TRACKING ================= */

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) return;

    setTrackingStatus((prev) => ({ ...prev, active: true }));

    watchIdRef.current = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      setUserLoc({
        lat: latitude,
        lng: longitude,
        accuracy,
        timestamp: Date.now(),
      });

      setReminders((prev) =>
        prev.map((r) => {
          if (r.status !== "active") return r;

          const dist = calculateDistance(latitude, longitude, r.lat, r.lng);

          if (dist <= r.radiusMeters) {
            speakReminder(r.originalInput || r.title);

            const updated = {
              ...r,
              status: "triggered" as const,
              triggeredAt: Date.now(),
              lastDistance: dist,
            };

            setActiveTriggeredReminder(updated);
            return updated;
          }

          return { ...r, lastDistance: dist };
        }),
      );
    });
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingStatus((prev) => ({ ...prev, active: false }));
  }, []);

  /* ================= CRUD ================= */

  const handleAddReminder = async (
    data: Omit<Reminder, "id" | "createdAt" | "status">,
  ) => {
    const newReminder: Reminder = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: "active",
    };

    await addDoc(collection(db, "reminders"), newReminder);
    setReminders((prev) => [newReminder, ...prev]);
  };

  const deleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const completeReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "completed" } : r)),
    );
  };

  const filteredReminders = reminders.filter((r) => r.status === filter);

  /* ================= UI ================= */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`min-h-screen transition-all duration-500 ${
        dark
          ? "bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white"
          : "bg-gradient-to-br from-indigo-50 via-white to-purple-50"
      } font-[Inter] relative overflow-hidden`}
    >
      {/* Background blobs */}
      <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-indigo-400/30 rounded-full blur-3xl" />
      <div className="absolute top-40 -right-20 w-[400px] h-[400px] bg-purple-400/30 rounded-full blur-3xl" />

      <div className="w-full min-h-screen flex justify-center">
        <div className="w-full max-w-xl px-6 py-10 relative z-10">
          {/* Header */}
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-5xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                GeoReminder
              </h1>
              <p className="text-slate-500 text-sm mt-2 font-medium">
                Smart location alerts that trigger exactly when you arrive.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDark(!dark)}
                className="p-2 rounded-xl bg-white/70 backdrop-blur shadow-md hover:scale-110 transition"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <motion.button
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => setIsModalOpen(true)}
                className="h-14 w-14 flex items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-xl shadow-purple-400/30 transition-all duration-300"
              >
                <Plus size={24} />
              </motion.button>
            </div>
          </div>

          {/* Tracking Card */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-6 rounded-3xl backdrop-blur-xl bg-white/70 border border-white/40 shadow-xl mb-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity
                  className={`${
                    trackingStatus.active
                      ? "text-green-500 animate-pulse"
                      : "text-gray-400"
                  }`}
                />
                <span className="font-semibold">
                  {trackingStatus.active ? "Tracking Active" : "Tracking Off"}
                </span>
              </div>

              <button
                onClick={trackingStatus.active ? stopTracking : startTracking}
                className={`px-4 py-2 text-sm font-semibold rounded-full ${
                  trackingStatus.active
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {trackingStatus.active ? "Stop" : "Start"}
              </button>
            </div>
          </motion.div>

          {/* Filter Tabs */}
          <div className="flex bg-white/60 backdrop-blur-xl border rounded-2xl p-1 shadow-md mb-6">
            {(["active", "triggered", "completed"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  filter === type
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Reminder List */}
          <AnimatePresence>
            <div className="space-y-4">
              {filteredReminders.map((reminder) => (
                <motion.div
                  key={reminder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  whileHover={{ y: -4 }}
                  className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200 shadow-xl transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{reminder.title}</h3>

                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="opacity-50 hover:text-red-500 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {reminder.notes && (
                    <p className="text-sm opacity-70 mb-3">{reminder.notes}</p>
                  )}

                  <div className="flex gap-3 text-xs font-medium">
                    <div className="flex items-center gap-1 bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md">
                      <MapPin size={12} />
                      {reminder.radiusMeters}m
                    </div>

                    {reminder.lastDistance && (
                      <div className="bg-gray-100 px-2 py-1 rounded-md">
                        {formatDistance(reminder.lastDistance)}
                      </div>
                    )}
                  </div>

                  {reminder.status === "triggered" && (
                    <button
                      onClick={() => completeReminder(reminder.id)}
                      className="mt-4 w-full py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      Mark as Done
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </div>
      </div>

      <AddReminderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddReminder}
        userLat={userLoc?.lat || 0}
        userLng={userLoc?.lng || 0}
      />

      <TriggeredReminderModal
        reminder={activeTriggeredReminder}
        onClose={() => setActiveTriggeredReminder(null)}
        onComplete={completeReminder}
        onDelete={deleteReminder}
      />
    </motion.div>
  );
};

export default App;
