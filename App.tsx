
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  Navigation, 
  NavigationOff, 
  Bell, 
  MapPin, 
  CheckCircle2, 
  Trash2, 
  Activity,
  AlertTriangle,
  Info
} from 'lucide-react';
import { Reminder, UserLocation, GeoStatus } from './types';
import { calculateDistance, formatDistance } from './utils/geoUtils';
import { AddReminderModal } from './components/AddReminderModal';
import { TriggeredReminderModal } from './components/TriggeredReminderModal';
import { speakReminder } from './services/ttsService';

const App: React.FC = () => {
  // State
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const saved = localStorage.getItem('georeminders');
    return saved ? JSON.parse(saved) : [];
  });
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null);
  const [trackingStatus, setTrackingStatus] = useState<GeoStatus>({
    active: false,
    error: null,
    lastUpdate: null
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTriggeredReminder, setActiveTriggeredReminder] = useState<Reminder | null>(null);
  const [filter, setFilter] = useState<'active' | 'triggered' | 'completed'>('active');

  // Refs for tracking
  const watchIdRef = useRef<number | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('georeminders', JSON.stringify(reminders));
  }, [reminders]);

  // Request Notification Permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /**
   * Notification and Vibration logic
   */
  useEffect(() => {
    if (activeTriggeredReminder) {
      // Physical Feedback (Vibration)
      if ('vibrate' in navigator) {
        navigator.vibrate([400, 200, 400]);
      }

      // System Push Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`📍 Arrival Alert`, {
          body: activeTriggeredReminder.originalInput,
          icon: 'https://cdn-icons-png.flaticon.com/512/252/252025.png'
        });
      }
    }
  }, [activeTriggeredReminder]);

  // Tracking Logic
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setTrackingStatus(prev => ({ ...prev, error: "Geolocation not supported" }));
      return;
    }

    setTrackingStatus(prev => ({ ...prev, active: true, error: null }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLoc = { lat: latitude, lng: longitude, accuracy, timestamp: Date.now() };
        setUserLoc(newLoc);
        setTrackingStatus(prev => ({ ...prev, lastUpdate: Date.now() }));
        
        // Geofencing Check
        setReminders(prevReminders => {
          let updated = false;
          let newlyFound: Reminder | null = null;

          const next = prevReminders.map(r => {
            if (r.status !== 'active') return r;
            
            const dist = calculateDistance(latitude, longitude, r.lat, r.lng);
            const isTriggered = dist <= r.radiusMeters;
            
            if (!isTriggered) return { ...r, lastDistance: dist };

            // IMMEDIATE ACTION: Trigger Voice Alert before state finishes updating
            // to minimize network latency perceived by the user.
            speakReminder(r.originalInput || r.title);

            // Mark as triggered
            updated = true;
            newlyFound = { ...r, status: 'triggered' as const, triggeredAt: Date.now(), lastDistance: dist };
            return newlyFound;
          });

          // Show Modal
          if (newlyFound) {
            setActiveTriggeredReminder(newlyFound);
          }

          return updated ? [...next] : next;
        });
      },
      (err) => {
        setTrackingStatus(prev => ({ ...prev, active: false, error: err.message }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTrackingStatus(prev => ({ ...prev, active: false }));
  }, []);

  // Handlers
  const handleAddReminder = (data: Omit<Reminder, 'id' | 'createdAt' | 'status'>) => {
    const newReminder: Reminder = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      status: 'active'
    };
    setReminders([newReminder, ...reminders]);
  };

  const deleteReminder = (id: string) => {
    setReminders(reminders.filter(r => r.id !== id));
    if (activeTriggeredReminder?.id === id) setActiveTriggeredReminder(null);
  };

  const completeReminder = (id: string) => {
    setReminders(reminders.map(r => r.id === id ? { ...r, status: 'completed' as const } : r));
    if (activeTriggeredReminder?.id === id) setActiveTriggeredReminder(null);
  };

  const filteredReminders = reminders.filter(r => r.status === filter);

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-slate-50 border-x border-slate-200 shadow-sm font-sans">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
            <Bell size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">GeoReminder</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Smart Location Alerts</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          <Plus size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
        <div className={`p-4 rounded-2xl border transition-all ${trackingStatus.active ? 'bg-blue-50 border-blue-100 shadow-sm' : 'bg-slate-100 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={18} className={trackingStatus.active ? 'text-blue-600 animate-pulse' : 'text-slate-400'} />
              <span className="font-bold text-slate-700">Location Tracking</span>
            </div>
            <button
              onClick={trackingStatus.active ? stopTracking : startTracking}
              className={`px-4 py-1.5 rounded-lg font-bold text-sm transition-all ${
                trackingStatus.active 
                ? 'bg-white text-blue-600 border border-blue-200 shadow-sm hover:bg-blue-100' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
              }`}
            >
              {trackingStatus.active ? 'Stop Tracking' : 'Start Tracking'}
            </button>
          </div>
          
          {trackingStatus.error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-2 rounded-lg text-xs font-medium border border-red-100 mb-3">
              <AlertTriangle size={14} />
              {trackingStatus.error}
            </div>
          )}

          {userLoc ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/50 p-2 rounded-xl border border-blue-50 flex items-center gap-2">
                <Navigation size={14} className="text-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Accuracy: {Math.round(userLoc.accuracy)}m</span>
              </div>
              <div className="bg-white/50 p-2 rounded-xl border border-blue-50 flex items-center gap-2">
                <Activity size={14} className="text-blue-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Update: {new Date(userLoc.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic flex items-center gap-2">
              <Info size={14} />
              Waiting for GPS signal...
            </div>
          )}
        </div>

        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {(['active', 'triggered', 'completed'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                filter === type ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredReminders.length === 0 ? (
            <div className="text-center py-12 px-6">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <Bell size={32} />
              </div>
              <h3 className="font-bold text-slate-400">No {filter} reminders</h3>
              <p className="text-sm text-slate-400">Your location alerts will appear here.</p>
            </div>
          ) : (
            filteredReminders.map(reminder => (
              <div key={reminder.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                {reminder.status === 'triggered' && (
                  <div className="absolute top-0 right-0 left-0 h-1 bg-orange-500" />
                )}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{reminder.title}</h3>
                  <button 
                    onClick={() => deleteReminder(reminder.id)}
                    className="text-slate-300 hover:text-red-500 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                {reminder.notes && <p className="text-slate-500 text-sm mb-4 line-clamp-2">{reminder.notes}</p>}
                
                <div className="flex flex-wrap gap-2 items-center text-[10px] font-bold uppercase tracking-tight">
                  <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    <MapPin size={10} />
                    {reminder.radiusMeters}m radius
                  </div>
                  {reminder.lastDistance !== undefined && (
                    <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                      Distance: {formatDistance(reminder.lastDistance)}
                    </div>
                  )}
                  {reminder.status === 'completed' && (
                    <div className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-md">
                      <CheckCircle2 size={10} />
                      Completed
                    </div>
                  )}
                </div>

                {reminder.status === 'triggered' && (
                  <button
                    onClick={() => completeReminder(reminder.id)}
                    className="mt-4 w-full py-2 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={14} />
                    Mark as Done
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </main>

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
    </div>
  );
};

export default App;
