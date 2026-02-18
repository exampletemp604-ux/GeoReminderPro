
import React, { useState, useEffect } from 'react';
import { X, MapPin, Send, Wand2, Loader2 } from 'lucide-react';
import { MapPicker } from './MapPicker';
import { Reminder } from '../types';
import { getSmartReminderInfo } from '../services/geminiService';

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reminder: Omit<Reminder, 'id' | 'createdAt' | 'status'>) => void;
  userLat: number;
  userLng: number;
}

export const AddReminderModal: React.FC<AddReminderModalProps> = ({ isOpen, onClose, onSave, userLat, userLng }) => {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [radius, setRadius] = useState(200);
  const [lat, setLat] = useState(userLat);
  const [lng, setLng] = useState(userLng);
  const [smartLoading, setSmartLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLat(userLat);
      setLng(userLng);
    }
  }, [isOpen, userLat, userLng]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    // We treat the current title and notes as the "original input" context
    const fullInput = notes ? `${title}: ${notes}` : title;
    
    onSave({ 
      title, 
      notes, 
      originalInput: fullInput,
      radiusMeters: radius, 
      lat, 
      lng 
    });
    
    setTitle('');
    setNotes('');
    onClose();
  };

  const handleSmartSuggest = async () => {
    if (!title.trim()) return;
    setSmartLoading(true);
    const combinedPrompt = title + (notes ? " " + notes : "");
    const result = await getSmartReminderInfo(combinedPrompt);
    if (result) {
      setTitle(result.title);
      setNotes(result.notes);
    }
    setSmartLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">New Reminder</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">What should I remind you?</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Buy cake near this place at 5pm"
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={handleSmartSuggest}
                  disabled={smartLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                  title="Optimize message with AI"
                >
                  {smartLoading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Additional Context (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specific store names or details..."
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Radius</label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value={100}>100m (Nearby)</option>
                  <option value={200}>200m (Walking)</option>
                  <option value={500}>500m (Standard)</option>
                  <option value={1000}>1km (Driving)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => { setLat(userLat); setLng(userLng); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm"
                >
                  <MapPin size={16} />
                  Current Location
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Set Reminder Location</label>
              <MapPicker 
                initialLat={lat} 
                initialLng={lng} 
                radius={radius}
                onLocationSelect={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              <Send size={18} />
              Set Reminder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
