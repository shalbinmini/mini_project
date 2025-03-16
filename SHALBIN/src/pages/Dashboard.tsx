import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Plus, RefreshCw, LogOut, Key, MessageSquare, Settings, Shield, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface SmartLock {
  _id: string;
  name: string;
  status: 'locked' | 'unlocked';
  otp?: string;
  otpExpiresAt?: string;
  lastUpdated: string;
  permanentlyLocked: boolean;
  failedAttempts: number;
  cooldownUntil?: string;
}

const API_URL = 'https://mini-project-ih7a.onrender.com/api';

export default function Dashboard() {
  // ... existing state variables ...
  const [locks, setLocks] = useState<SmartLock[]>([]);
  const [newLockName, setNewLockName] = useState('');
  const [showAddLock, setShowAddLock] = useState(false);
  const [selectedLock, setSelectedLock] = useState<string | null>(null);
  const [pinNumber, setPinNumber] = useState<number>(1);
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [recipientNumber, setRecipientNumber] = useState('');
  const { token, signOut } = useAuthStore();
  const navigate = useNavigate();

  // ... existing useEffect and functions ...
  useEffect(() => {
    fetchLocks();
    const interval = setInterval(fetchLocks, 1000); // Poll every second
    return () => clearInterval(interval);
  }, []);

  const fetchLocks = async () => {
    try {
      const response = await fetch(`${API_URL}/locks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch locks');
      
      const data = await response.json();
      setLocks(data);
    } catch (error) {
      console.error('Error fetching locks:', error);
    }
  };

  // New functions for permanent lock control
  const togglePermanentLock = async (lockId: string, action: 'lock' | 'unlock') => {
    try {
      const response = await fetch(`${API_URL}/locks/${lockId}/permanent-${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error(`Failed to ${action} device`);
      fetchLocks();
    } catch (error) {
      console.error(`Error ${action}ing device:`, error);
    }
  };

  // ... rest of your existing functions ...
  const handleAddLock = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${API_URL}/locks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newLockName })
      });

      if (!response.ok) throw new Error('Failed to add lock');

      setNewLockName('');
      setShowAddLock(false);
      fetchLocks();
    } catch (error) {
      console.error('Error adding lock:', error);
    }
  };

  const generateOTP = async (lockId: string) => {
    try {
      const response = await fetch(`${API_URL}/locks/${lockId}/otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to generate OTP');

      const data = await response.json();
      setWhatsappMessage(data.whatsappMessage);
      setRecipientNumber(data.userWhatsapp || '');
      setShowWhatsAppModal(true);
      fetchLocks();
    } catch (error) {
      console.error('Error generating OTP:', error);
    }
  };

  const updatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLock) return;

    try {
      const response = await fetch(`${API_URL}/locks/${selectedLock}/pins`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pinNumber, pin })
      });

      if (!response.ok) throw new Error('Failed to update PIN');

      setPin('');
      setShowPinModal(false);
      fetchLocks();
    } catch (error) {
      console.error('Error updating PIN:', error);
    }
  };

  const updateWhatsAppNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/user/whatsapp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ whatsappNumber })
      });

      if (!response.ok) throw new Error('Failed to update WhatsApp number');

      setShowSettingsModal(false);
    } catch (error) {
      console.error('Error updating WhatsApp number:', error);
    }
  };

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  const calculateTimeRemaining = (expiresAt: string) => {
    const remaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
    return remaining;
  };

  const calculateCooldownRemaining = (cooldownUntil: string) => {
    const remaining = Math.max(0, Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 1000));
    return remaining;
  };

  const openWhatsApp = () => {
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappUrl = `https://wa.me/${recipientNumber.replace(/[^0-9]/g, '')}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    setShowWhatsAppModal(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ... existing nav section ... */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Lock className="h-8 w-8 text-indigo-600" />
              <h1 className="ml-2 text-xl font-bold text-gray-900">Smart Lock Manager</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* ... existing add lock section ... */}
        <div className="px-4 py-4 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Smart Locks</h2>
            <button
              onClick={() => setShowAddLock(true)}
              className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5 mr-1" />
              Add Lock
            </button>
          </div>

          {showAddLock && (
            <div className="mb-6 bg-white shadow sm:rounded-lg p-4">
              <form onSubmit={handleAddLock} className="flex gap-4">
                <input
                  type="text"
                  value={newLockName}
                  onChange={(e) => setNewLockName(e.target.value)}
                  placeholder="Enter lock name"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLock(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}

          {/* ... existing modals ... */}
          {showPinModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">Set PIN {pinNumber}</h3>
                <form onSubmit={updatePin}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Enter 6-digit PIN
                    </label>
                    <input
                      type="text"
                      pattern="\d{6}"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPinModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                    >
                      Save PIN
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showSettingsModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">Settings</h3>
                <form onSubmit={updateWhatsAppNumber}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Default WhatsApp Number (with country code)
                    </label>
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+1234567890"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSettingsModal(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showWhatsAppModal && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <h3 className="text-lg font-medium mb-4">Send OTP via WhatsApp</h3>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Recipient WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={recipientNumber}
                    onChange={(e) => setRecipientNumber(e.target.value)}
                    placeholder="+1234567890"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Message
                  </label>
                  <textarea
                    value={whatsappMessage}
                    readOnly
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowWhatsAppModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={openWhatsApp}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Open WhatsApp
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locks.map((lock) => (
              <div key={lock._id} className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">{lock.name}</h3>
                    <div className="flex items-center space-x-2">
                      {lock.permanentlyLocked && (
                        <span className="px-2 py-1 text-sm rounded-full bg-red-100 text-red-800">
                          <Shield className="h-4 w-4 inline mr-1" />
                          Permanent Lock
                        </span>
                      )}
                      <span className={`px-2 py-1 text-sm rounded-full ${
                        lock.status === 'locked' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {lock.status}
                      </span>
                    </div>
                  </div>
                  
                  {/* Security Status Section */}
                  {(lock.failedAttempts > 0 || lock.cooldownUntil) && (
                    <div className="mt-2 p-2 bg-yellow-50 rounded-md">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-yellow-400 mr-2" />
                        <span className="text-sm text-yellow-700">
                          Failed attempts: {lock.failedAttempts}
                          {lock.cooldownUntil && new Date(lock.cooldownUntil) > new Date() && (
                            <span className="ml-2">
                              (Cooldown: {calculateCooldownRemaining(lock.cooldownUntil)}s)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-4">
                    {/* Permanent Lock Controls */}
                    <div className="flex justify-end">
                      {!lock.permanentlyLocked ? (
                        <button
                          onClick={() => togglePermanentLock(lock._id, 'lock')}
                          className="flex items-center px-3 py-1 text-sm border border-red-300 rounded-md text-red-700 hover:bg-red-50"
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Enable Permanent Lock
                        </button>
                      ) : (
                        <button
                          onClick={() => togglePermanentLock(lock._id, 'unlock')}
                          className="flex items-center px-3 py-1 text-sm border border-green-300 rounded-md text-green-700 hover:bg-green-50"
                        >
                          <Shield className="h-4 w-4 mr-1" />
                          Disable Permanent Lock
                        </button>
                      )}
                    </div>

                    {/* Existing OTP Section */}
                    {!lock.permanentlyLocked && (
                      <>
                        {lock.otp && lock.otpExpiresAt && new Date(lock.otpExpiresAt) > new Date() ? (
                          <div>
                            <p className="text-sm text-gray-500">One-Time Password:</p>
                            <p className="text-2xl font-mono font-bold text-indigo-600">{lock.otp}</p>
                            <p className="text-xs text-gray-500">
                              Expires in {calculateTimeRemaining(lock.otpExpiresAt)}s
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => generateOTP(lock._id)}
                            className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            disabled={lock.permanentlyLocked}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Generate OTP
                          </button>
                        )}

                        {/* Existing PIN buttons */}
                        <div className="grid grid-cols-2 gap-2">
                          {[1, 2, 3, 4].map((num) => (
                            <button
                              key={num}
                              onClick={() => {
                                setSelectedLock(lock._id);
                                setPinNumber(num);
                                setShowPinModal(true);
                              }}
                              className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                              disabled={lock.permanentlyLocked}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              PIN {num}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
