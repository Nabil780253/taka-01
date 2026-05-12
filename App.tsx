/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, 
  ClipboardList, 
  Wallet, 
  User, 
  ChevronRight, 
  Eye, 
  Users, 
  BarChart3, 
  Coins, 
  BookOpen, 
  Info,
  Youtube,
  Send,
  PlayCircle,
  Bell, 
  LogOut,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit 
} from 'firebase/firestore';

// --- Types ---
type Tab = 'home' | 'tasks' | 'withdraw' | 'profile';

interface AppState {
  balance: number;
  totalAds: number;
  hourlyAds: number;
  referrals: number;
  totalIncome: number;
  isAuthenticated: boolean;
  name: string;
  phone: string;
}

// --- Components ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [state, setState] = useState<AppState>({
    balance: 0.00,
    totalAds: 0,
    hourlyAds: 0,
    referrals: 0,
    totalIncome: 0.00,
    isAuthenticated: false,
    name: 'User',
    phone: ''
  });

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Sync Auth State
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (user) {
        // Listen to Firestore for real-time data sync
        const userDocRef = doc(db, 'users', user.uid);
        unsubFirestore = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setState({
              balance: data.balance || 0,
              totalAds: data.totalAds || 0,
              hourlyAds: data.hourlyAds || 0,
              referrals: data.referrals || 0,
              totalIncome: data.totalIncome || 0,
              isAuthenticated: true,
              name: data.name || 'User',
              phone: data.phone || ''
            });
            setLoading(false);
          } else {
            // New user case if doc doesn't exist for some reason
            setState(s => ({ ...s, isAuthenticated: true }));
            setLoading(false);
          }
        }, (error) => {
          console.error("User Snapshot Error:", error);
          setLoading(false);
        });
      } else {
        setState(s => ({ ...s, isAuthenticated: false }));
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  const handleAuth = async () => {
    const cleanPhone = phone.trim();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (!cleanPhone || !cleanPassword || (authMode === 'register' && !cleanName)) {
      showToast('সবগুলো ঘর সঠিকভাবে পূরণ করুন!', 'error');
      return;
    }
    if (cleanPhone.length < 11) {
      showToast('মোবাইল নম্বরটি কমপক্ষে ১১ ডিজিটের হতে হবে!', 'error');
      return;
    }

    setLoading(true);
    const email = `${cleanPhone}@jobapp.com`;

    try {
      if (authMode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, cleanPassword);
        const uid = userCredential.user.uid;
        
        // Create user document in Firestore
        const newUser: any = {
          name: cleanName,
          phone: cleanPhone,
          balance: 0,
          totalAds: 0,
          hourlyAds: 0,
          referrals: 0,
          totalIncome: 0,
          createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', uid), newUser);
        showToast('রেজিস্ট্রেশন সফল হয়েছে! এখন আপনি কাজ শুরু করতে পারেন।');
      } else {
        await signInWithEmailAndPassword(auth, email, cleanPassword);
        showToast('সফলভাবে লগইন করা হয়েছে!');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/user-not-found') {
        showToast('এই নম্বর দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি। দয়া করে রেজিস্ট্রেশন করুন।', 'error');
      } else if (error.code === 'auth/wrong-password') {
        showToast('ভুল পাসওয়ার্ড দিয়েছেন! আবার চেষ্টা করুন।', 'error');
      } else if (error.code === 'auth/email-already-in-use') {
        showToast('এই মোবাইল নম্বরটি ইতিমধ্যে ব্যবহার করা হয়েছে। লগইন করার চেষ্টা করুন।', 'error');
      } else if (error.code === 'auth/weak-password') {
        showToast('পাসওয়ার্ডটি অন্তত ৬ ডিজিটের হতে হবে।', 'error');
      } else {
        showToast(`সমস্যা হয়েছে: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('লগআউট সফল হয়েছে!');
    } catch (error: any) {
      showToast('লগআউট করা যায়নি', 'error');
    }
  };

  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adTimer, setAdTimer] = useState(0);
  const [currentReward, setCurrentReward] = useState(0);

  const startAdTask = (type: string, reward: number) => {
    window.open("https://omg10.com/4/10175426", "_blank");
    setCurrentReward(reward);
    setIsWatchingAd(true);
    setAdTimer(30); 
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      // If user comes back to the app (visible) while ad is still supposed to be watching
      if (document.visibilityState === 'visible' && isWatchingAd && adTimer > 0) {
        setIsWatchingAd(false);
        setAdTimer(0);
        alert('আপনি সম্পূর্ণ অ্যাড দেখেন নি! টাকা পেতে অবশ্যই ৩০ সেকেন্ড অপেক্ষা করতে হবে।');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isWatchingAd, adTimer]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isWatchingAd && adTimer > 0) {
      interval = setInterval(() => {
        setAdTimer((prev) => prev - 1);
      }, 1000);
    } else if (isWatchingAd && adTimer === 0) {
      setIsWatchingAd(false);
      // Reward user in Firestore
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        updateDoc(userRef, {
          balance: state.balance + currentReward,
          totalAds: state.totalAds + 1,
          hourlyAds: state.hourlyAds + 1,
          totalIncome: state.totalIncome + currentReward
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser?.uid}`));
      }
      alert(`অভিনন্দন! আপনি সম্পূর্ণ অ্যাড দেখেছেন এবং ${currentReward} টাকা পেয়েছেন।`);
    }
    return () => clearInterval(interval);
  }, [isWatchingAd, adTimer, currentReward]);

  const [showRules, setShowRules] = useState(false);

  const simulateReferral = () => {
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(userRef, {
        referrals: state.referrals + 1,
        balance: state.balance + 100,
        totalIncome: state.totalIncome + 100
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser?.uid}`));
      alert('অভিনন্দন! আপনার রেফারেল লিংক ব্যবহার করে একজন জয়েন করেছেন। আপনি ১০০ টাকা বোনাস পেয়েছেন।');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeView state={state} onShowRules={() => setShowRules(true)} onSimulateReferral={simulateReferral} />;
      case 'tasks':
        return <TasksView state={state} onStartAd={startAdTask} />;
      case 'withdraw':
        return <WithdrawView state={state} />;
      case 'profile':
        return <ProfileView state={state} onLogout={handleLogout} />;
      default:
        return <HomeView state={state} onShowRules={() => setShowRules(true)} onSimulateReferral={simulateReferral} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fff7ed] flex items-center justify-center p-6">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#fff7ed] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm relative">
          <AnimatePresence>
            {notification && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                  notification.type === 'success' 
                    ? 'bg-green-50 text-green-700 border-green-100' 
                    : 'bg-red-50 text-red-700 border-red-100'
                }`}
              >
                {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {notification.message}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-100">
               <span className="text-3xl">💼</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">পার্ট টাইম জব</h1>
            <p className="text-slate-500 text-sm mt-1">লগইন অথবা রেজিস্ট্রেশন করুন</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100"
          >
            <div className="flex bg-slate-50 p-1.5 rounded-2xl mb-8">
              <button 
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${authMode === 'login' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}
              >
                লগইন
              </button>
              <button 
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${authMode === 'register' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-400'}`}
              >
                রেজিস্ট্রেশন
              </button>
            </div>

            <div className="space-y-4">
              {authMode === 'login' && (
                <p className="text-[11px] text-slate-500 text-center bg-orange-50 p-2 rounded-xl border border-orange-100">
                   তুমি যদি অ্যাপে নতুন হয়ে থাকো তাহলে <span className="text-orange-500 font-bold cursor-pointer" onClick={() => setAuthMode('register')}>রেজিস্টার করো</span>
                </p>
              )}
              {authMode === 'register' && (
                <div className="space-y-1.5">
                   <p className="text-[10px] uppercase font-bold text-slate-400 ml-1">আপনার নাম</p>
                   <input 
                     type="text" 
                     value={name}
                     onChange={(e) => setName(e.target.value)}
                     placeholder="নাম লিখুন"
                     className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                   />
                </div>
              )}
              <div className="space-y-1.5">
                 <p className="text-[10px] uppercase font-bold text-slate-400 ml-1">মোবাইল নম্বর</p>
                 <input 
                   type="tel" 
                   value={phone}
                   onChange={(e) => setPhone(e.target.value)}
                   placeholder="01xxxxxxxxx"
                   className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                 />
              </div>
              <div className="space-y-1.5">
                 <p className="text-[10px] uppercase font-bold text-slate-400 ml-1">পাসওয়ার্ড</p>
                 <div className="relative">
                   <input 
                     type={showPassword ? "text" : "password"} 
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••"
                     className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                   />
                   <button 
                     type="button"
                     onClick={() => setShowPassword(!showPassword)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-orange-500 transition-colors"
                   >
                     {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                 </div>
                 {authMode === 'login' && (
                   <div className="text-right mt-1">
                      <button 
                        onClick={() => alert('পাসওয়ার্ড উদ্ধারের জন্য আমাদের টেলিগ্রাম সাপোর্টে যোগাযোগ করুন।')}
                        className="text-[10px] text-slate-400 font-medium hover:text-orange-500 transition-colors"
                      >
                        ফরগেট পাসওয়ার্ড?
                      </button>
                   </div>
                 )}
              </div>

              <button 
                onClick={handleAuth}
                className="w-full bg-blue-600 text-white font-bold py-3.5 mt-4 rounded-2xl text-sm shadow-xl shadow-blue-100 active:scale-95 transition-all"
              >
                {authMode === 'login' ? 'লগইন করুন' : 'রেজিস্ট্রেশন করুন'}
              </button>
            </div>
          </motion.div>
          
          <p className="text-center text-slate-400 text-[10px] mt-8">
            © ২০২৪ পার্ট টাইম জব অ্যাপ | সকল অধিকার সংরক্ষিত
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff7ed] text-slate-800 font-sans pb-20 overflow-x-hidden select-none touch-manipulation">
      {/* Header */}
      <header className="bg-[#1e293b] p-3 flex items-center justify-between text-white sticky top-0 z-50 shadow-md h-14">
        <div className="flex items-center gap-2">
          <motion.span 
            animate={{ rotate: [0, 10, -10, 0] }} 
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-lg"
          >
            💼
          </motion.span>
          <h1 className="text-base font-bold font-sans tracking-tight">পার্ট টাইম জব</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
             <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
             অনলাইন
          </div>
          <div className="w-5 h-5 flex flex-col justify-center items-center gap-1 opacity-60">
             <div className="w-1 h-1 bg-white rounded-full"></div>
             <div className="w-1 h-1 bg-white rounded-full"></div>
             <div className="w-1 h-1 bg-white rounded-full"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        <motion.main
          key={activeTab}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="p-4 pt-4 max-w-md mx-auto"
        >
          {renderContent()}
        </motion.main>
      </AnimatePresence>

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[1.5rem] w-full max-w-xs p-6 shadow-2xl relative"
            >
              <button 
                onClick={() => setShowRules(false)}
                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 mb-4">
                 <div className="bg-green-100 p-1.5 rounded-lg">
                   <BookOpen className="w-6 h-6 text-green-600" />
                 </div>
                 <h2 className="text-xl font-bold">কাজ করার নিয়ম</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                 <p className="flex gap-2">
                   <span className="font-bold text-green-600 tracking-tighter">১.</span> 
                   প্রতিদিন ভিডিও এবং অ্যাড দেখে ইনকাম করা যাবে।
                 </p>
                 <p className="flex gap-2">
                   <span className="font-bold text-green-600 tracking-tighter">২.</span> 
                   ন্যূনতম ৫০০ টাকা হলে উইথড্র দেওয়া যাবে।
                 </p>
                 <p className="flex gap-2">
                   <span className="font-bold text-green-600 tracking-tighter">৩.</span> 
                   কমপক্ষে ২ জন বন্ধুকে রেফার করতে হবে।
                 </p>
                 <p className="flex gap-2">
                   <span className="font-bold text-green-600 tracking-tighter">৪.</span> 
                   মাল্টিপল অ্যাকাউন্ট করলে পেমেন্ট পাবেন না।
                 </p>
              </div>
              <button 
                onClick={() => setShowRules(false)}
                className="w-full mt-6 bg-green-600 text-white font-bold py-3 rounded-xl active:scale-95 transition-transform"
              >
                বুঝেছি
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad Overlay Modal */}
      <AnimatePresence>
        {isWatchingAd && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 text-center text-white"
          >
            <div className="w-full max-w-xs aspect-video bg-slate-800 rounded-xl mb-6 flex items-center justify-center border-2 border-orange-500 overflow-hidden relative">
               <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent"></div>
               <PlayCircle className="w-12 h-12 text-orange-500 animate-pulse" />
               <div className="absolute bottom-4 left-4 right-4 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 30, ease: "linear" }}
                    className="h-full bg-orange-500"
                  />
               </div>
            </div>
            <h2 className="text-xl font-bold mb-1">বিজ্ঞাপন দেখছেন...</h2>
            <p className="text-slate-400 mb-6 text-sm">সম্পূর্ণ টাকা পেতে এই পেইজ থেকে বের হবেন না।</p>
            <div className="text-4xl font-mono font-bold text-orange-500 tabular-nums">
              {adTimer}s
            </div>
            <p className="mt-8 text-xs text-slate-500 italic">বিজ্ঞাপন শেষ না হওয়া পর্যন্ত অন্য ট্যাবে যাবেন না</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 h-16 flex items-center justify-around px-2 z-[100] pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
        <NavButton 
          active={activeTab === 'home'} 
          onClick={() => setActiveTab('home')} 
          icon={<Home />} 
          label="হোম" 
        />
        <NavButton 
          active={activeTab === 'tasks'} 
          onClick={() => setActiveTab('tasks')} 
          icon={<ClipboardList />} 
          label="টাস্ক" 
        />
        <NavButton 
          active={activeTab === 'withdraw'} 
          onClick={() => setActiveTab('withdraw')} 
          icon={<Wallet />} 
          label="উইথড্র" 
        />
        <NavButton 
          active={activeTab === 'profile'} 
          onClick={() => setActiveTab('profile')} 
          icon={<User />} 
          label="প্রোফাইল" 
        />
      </nav>
    </div>
  );
}

// --- View Components ---

function HomeView({ state, onShowRules, onSimulateReferral }: { state: AppState, onShowRules: () => void, onSimulateReferral: () => void }) {
  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <motion.div 
        initial={{ scale: 0.95 }}
        whileInView={{ scale: 1 }}
        className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[2rem] p-5 text-white shadow-xl shadow-blue-200 relative overflow-hidden"
      >
        <div className="flex justify-between items-start">
           <div className="space-y-1">
             <div className="flex items-center gap-2">
                <span className="text-lg">💼</span>
                <span className="text-base font-medium">পার্ট টাইম জব</span>
             </div>
             <p className="text-blue-50/80 text-[10px]">আয় করুন সহজে</p>
           </div>
           <div className="bg-white/20 backdrop-blur-md p-2 rounded-full">
              <User className="w-5 h-5" />
           </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-blue-50/90 text-[10px] mb-1">আপনার ব্যালেন্স</p>
          <div className="text-4xl font-bold tracking-tight">
            {state.balance.toFixed(2)} টাকা
          </div>
          <p className="mt-3 text-blue-100/90 text-xs">স্বাগতম, {state.name}</p>
        </div>

        {/* Decorative Circles */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -top-10 -left-10 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
      </motion.div>

      {/* Rules Banner */}
      <motion.button 
        onClick={onShowRules}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white p-4 rounded-[1.2rem] flex items-center justify-between shadow-lg shadow-green-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="font-bold text-base leading-none">কাজ করার নিয়ম</p>
            <p className="text-xs text-green-50/80">নতুন ইউজার? এখানে ক্লিক করুন</p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5" />
      </motion.button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard 
          icon={<Eye className="w-4 h-4 text-orange-500" />} 
          label="এই ঘন্টায় এড" 
          value={`${state.hourlyAds}/10`} 
          subValue="রিসেট: 20 মিনিট" 
        />
        <StatCard 
          icon={<Users className="w-5 h-5 text-orange-500" />} 
          label="রেফারেল" 
          value={state.referrals.toString()} 
        />
        <StatCard 
          icon={<BarChart3 className="w-5 h-5 text-orange-500" />} 
          label="মোট এড" 
          value={state.totalAds.toString()} 
        />
        <StatCard 
          icon={<Coins className="w-5 h-5 text-orange-500" />} 
          label="মোট আয়" 
          value={`${state.totalIncome.toFixed(2)} টাকা`} 
        />
      </div>

      {/* Quick Links */}
      <div className="space-y-2">
         <QuickLink 
           icon={<Send className="w-4 h-4 text-green-600" />} 
           label="পেমেন্ট প্রুফ চ্যানেল" 
           subLabel="সকল পেমেন্ট এখানে দেখুন"
           color="bg-[#22c197]"
           external
           onClick={() => window.open("https://t.me/realearnningproof", "_blank")}
         />
         <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <h3 className="flex items-center gap-2 font-bold mb-3 text-sm">
              <ClipboardList className="w-4 h-4 text-slate-400" />
              দ্রুত কাজ
            </h3>
            <div className="space-y-3">
               <div className="flex items-center justify-between p-1 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="text-orange-500">
                       <ClipboardList className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">টাস্ক করুন</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
               </div>
               <div className="flex items-center justify-between p-1 border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="text-green-500">
                       <Wallet className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">টাকা উত্তোলন</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
               </div>
               <div className="flex items-center justify-between p-1">
                  <div className="flex items-center gap-3">
                    <div className="text-purple-500">
                       <Copy className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-700">রেফারেল লিঙ্ক কপি</span>
                  </div>
                  <Copy className="w-4 h-4 text-slate-300" />
               </div>
            </div>
         </div>
      </div>

      {/* Referral Bonus */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
         <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-base">রেফারেল বোনাস</h3>
         </div>
         <p className="text-[11px] text-slate-600 mb-3">
            প্রতি বন্ধু আনলে পাবেন <span className="text-green-600 font-bold">১০০ টাকা</span> | বন্ধু পাবে <span className="text-green-600 font-bold">৫০ টাকা</span>
         </p>
         <div className="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-500 font-mono break-all mb-3 text-center">
            {window.location.host}?ref=6671318864
         </div>
         <button 
           onClick={() => {
             const link = `${window.location.protocol}//${window.location.host}?ref=6671318864`;
             navigator.clipboard.writeText(link);
             onSimulateReferral();
           }}
           className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
         >
            <Users className="w-4 h-4" />
            লিঙ্ক শেয়ার করুন (বোনাস নিন)
         </button>
      </div>
    </div>
  );
}

function TasksView({ state, onStartAd }: { state: AppState, onStartAd: (t: string, r: number) => void }) {
  return (
    <div className="space-y-4">
      {/* Main Task Header */}
      <div className="bg-orange-500 rounded-[1.5rem] p-4 text-white shadow-lg shadow-orange-100 relative overflow-hidden">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList className="w-6 h-6" />
          <h2 className="text-xl font-bold">টাস্ক করুন</h2>
        </div>
        <p className="text-orange-100 text-[10px]">এড দেখে আয় করুন | রিসেট: প্রতি ঘন্টায় (পরবর্তী: ১৯ মিনিট)</p>
        <div className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full blur-xl"></div>
      </div>

      {/* Daily Bonus Section */}
      <TaskCard 
        reward="৫ টাকা/এড"
        title="দৈনিক বোনাস এড"
        description="প্রতিদিন ৫০টি এড দেখে ২৫০ টাকা পর্যন্ত আয় করুন!"
        stats={{ label: "আজকে:", value: "0/50", reset: "কাল সকাল ৬টায়" }}
        buttonLabel="দৈনিক বোনাস এড দেখুন"
        buttonColor="bg-gradient-to-r from-pink-500 to-rose-500"
        onAction={() => onStartAd('bonus', 5)}
        type="bonus"
      />

      <TaskCard 
        reward="৩০ টাকা/এড"
        title="এড দেখুন"
        description="প্রতি এড দেখে ৩০ টাকা উপার্জন করুন"
        stats={{ label: "এই ঘন্টায়:", value: "0/10", reset: "১৯ মিনিট" }}
        buttonLabel="এড দেখুন"
        buttonColor="bg-orange-500"
        onAction={() => onStartAd('ad', 30)}
        type="ad"
      />

      <TaskCard 
        reward="১০০ টাকা/ভিডিও"
        title="ভিডিও টাস্ক"
        description="৫ মিনিটের ভিডিও দেখে ১০০ টাকা আয় করুন!"
        stats={{ label: "আজকে দেখা:", value: "0/2", remaining: "বাকি ২ বার" }}
        buttonLabel="ভিডিও দেখে আয় করুন"
        buttonColor="bg-[#ef4444]"
        onAction={() => onStartAd('video', 100)}
        type="video"
      />

      {/* Social Tasks */}
      <div className="space-y-3">
         <SocialTaskCard 
           icon={<Send className="w-4 h-4" />}
           label="টেলিগ্রাম চ্যানেল জয়েন"
           reward="৫০ টাকা"
           color="bg-blue-500"
           onClick={() => window.open("https://t.me/realearnningproof", "_blank")}
         />
         <SocialTaskCard 
           icon={<Youtube className="w-4 h-4" />}
           label="ইউটিউব সাবস্ক্রাইব"
           reward="৫০ টাকা"
           color="bg-red-600"
         />
      </div>

      <div className="text-center py-4">
         <button className="text-slate-500 text-sm flex items-center justify-center gap-2 mx-auto">
            ← হোমে ফিরুন
         </button>
      </div>
    </div>
  );
}

function WithdrawView({ state }: { state: AppState }) {
  const [method, setMethod] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      const q = query(
        collection(db, 'rechargeRequests'),
        where('userId', '==', auth.currentUser.uid)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          // Check if any recent request is pending or approved
          const anyActive = snapshot.docs.some(doc => {
            const d = doc.data();
            return d.status === 'pending' || d.status === 'approved';
          });
          setIsPending(anyActive);
        }
      }, (error) => {
        console.error("Recharge Snapshot Error:", error);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleSubmitTransaction = async () => {
    if (!transactionId || transactionId.length < 5) {
      alert('সঠিক ট্রানজেকশন আইডি দিন!');
      return;
    }
    
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'rechargeRequests'), {
          transactionId,
          amount: 100,
          status: 'pending',
          userId: auth.currentUser.uid,
          createdAt: serverTimestamp()
        });
        setIsPending(true);
        alert('ট্রানজেকশন আইডি জমা হয়েছে। যাচাই শেষে আপনার উইথড্র রিকোয়েস্ট গ্রহণ করা হবে।');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'rechargeRequests');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-orange-500 rounded-[1.5rem] p-4 text-white shadow-lg shadow-orange-100 flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl">
          <Coins className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-sans">টাকা উত্তোলন</h2>
          <p className="text-orange-100 text-xs">আপনার আয় নিন</p>
        </div>
      </div>

      {/* Current Balance */}
      <div className="bg-white rounded-2xl p-4 text-center shadow-sm border border-slate-100">
         <p className="text-slate-400 text-[10px] mb-1">বর্তমান ব্যালেন্স</p>
         <div className="text-3xl font-bold text-green-600 font-sans">
            {state.balance.toFixed(2)} টাকা
         </div>
      </div>

      {/* Requirements (Always Visible) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
         <div className="flex items-center gap-2 mb-4 border-b pb-3 border-slate-50">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-base">উত্তোলনের শর্তাবলী</h3>
         </div>
         
         <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-700">ন্যূনতম উত্তোলন:</span>
              <span className="font-bold text-green-600">৫০০ টাকা</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <Users className="w-4 h-4 text-blue-500" />
                 <span className="font-medium text-slate-700">রেফারেল প্রয়োজন:</span>
              </div>
              <span className="text-red-500 font-bold">{state.referrals}/২</span>
            </div>

            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-slate-700" />
                  <span className="font-medium text-slate-700">মোট এড প্রয়োজন:</span>
               </div>
               <span className="text-red-500 font-bold">{state.totalAds}/৫০</span>
            </div>
         </div>
      </div>

      {/* Recharge Box & Withdraw Form (Only show when balance >= 500) */}
      {state.balance >= 500 ? (
        <>
          {!isPending ? (
            <div className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-100 relative overflow-hidden">
               <div className="flex items-center gap-2 mb-2 relative z-10">
                  <CheckCircle2 className="w-5 h-5" />
                  <h3 className="font-bold">রিচার্জ ভেরিফিকেশন (১০০ টাকা)</h3>
               </div>
               <p className="text-[11px] text-blue-100 mb-3 relative z-10 leading-relaxed">
                  উইথড্র করার জন্য অবশ্যই ১০০ টাকা রিচার্জ করতে হবে। নিচে দেওয়া নাম্বারে টাকা পাঠিয়ে ট্রানজেকশন আইডি দিন।
               </p>
               <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 mb-3 relative z-10">
                  <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">বিকাশ/নগদ (পার্সোনাল)</p>
                  <div className="flex items-center justify-between">
                     <span className="text-lg font-mono font-bold tracking-wider">01634102999</span>
                     <button 
                       onClick={() => {
                         navigator.clipboard.writeText('01634102999');
                         alert('নাম্বার কপি হয়েছে!');
                       }}
                       className="bg-white text-blue-600 text-[10px] font-bold px-3 py-1 rounded-lg"
                     >
                       কপি
                     </button>
                  </div>
               </div>
               
               <div className="space-y-2 relative z-10">
                 <input 
                   type="text" 
                   value={transactionId}
                   onChange={(e) => setTransactionId(e.target.value)}
                   placeholder="ট্রানজেকশন আইডি দিন" 
                   className="w-full bg-white text-slate-800 rounded-xl p-3 text-sm outline-none placeholder:text-slate-400"
                 />
                 <button 
                   onClick={handleSubmitTransaction}
                   className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md"
                 >
                   আইডি সাবমিট করুন
                 </button>
               </div>
               {/* Decorative Circle */}
               <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-yellow-500 text-white rounded-2xl p-4 text-center font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-yellow-100">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                ১০০ টাকা রিচার্জ যাচাই পেন্ডিং...
              </div>

              {/* Withdrawal Form (Only visible after recharge skip or submission) */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                 <div className="flex items-center gap-2 mb-4">
                    <ClipboardList className="w-5 h-5 text-slate-400" />
                    <h3 className="font-bold text-base">উত্তোলন ফর্ম</h3>
                 </div>

                 <div className="grid grid-cols-2 gap-3 mb-4">
                    <PaymentMethodCard 
                      id="bkash" 
                      label="bKash" 
                      subLabel="বিকাশ" 
                      selected={method === 'bkash'} 
                      onClick={() => setMethod('bkash')}
                      icon="💸"
                    />
                    <PaymentMethodCard 
                      id="nagad" 
                      label="Nagad" 
                      subLabel="নগদ" 
                      selected={method === 'nagad'} 
                      onClick={() => setMethod('nagad')}
                      icon="📱"
                    />
                    <PaymentMethodCard 
                      id="rocket" 
                      label="Rocket" 
                      subLabel="রকেট" 
                      selected={method === 'rocket'} 
                      onClick={() => setMethod('rocket')}
                      icon="🚀"
                    />
                    <PaymentMethodCard 
                      id="usdt" 
                      label="USDT" 
                      subLabel="ইউএসডিটি" 
                      badge="ক্রিপ্টো"
                      selected={method === 'usdt'} 
                      onClick={() => setMethod('usdt')}
                      icon="₿"
                    />
                 </div>

                 <div className="space-y-3">
                    <input 
                       type="text" 
                       placeholder="আ্যাকাউন্ট নম্বর" 
                       className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                    <input 
                       type="number" 
                       placeholder="পরিমাণ (টাকা)" 
                       className="w-full bg-slate-50 border-0 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                    <button 
                       onClick={() => alert('আপনার উত্তোলনের আবেদনটি পেন্ডিং এ আছে। ২৪ ঘন্টার মধ্যে পেমেন্ট পাবেন।')}
                       className="w-full bg-[#22c55e] text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-green-100"
                    >
                      💸 উত্তোলন করুন
                    </button>
                 </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 text-center">
           <AlertCircle className="w-8 h-8 text-orange-500 mx-auto mb-3" />
           <p className="text-sm text-orange-800 font-bold mb-1">উইথড্র করার জন্য ৫০০ টাকা প্রয়োজন</p>
           <p className="text-[11px] text-orange-600">আপনার ব্যালেন্স ৫০০ টাকা হলে এখানে উইথড্র ফর্ম ও পেমেন্ট মেথড দেখতে পাবেন।</p>
        </div>
      )}


      <div className="text-center py-4">
         <button className="text-slate-500 text-sm flex items-center justify-center gap-2 mx-auto">
            ← হোমে ফিরুন
         </button>
      </div>
    </div>
  );
}

function ProfileView({ state, onLogout }: { state: AppState, onLogout: () => void }) {
  return (
    <div className="space-y-4">
       <div className="flex flex-col items-center py-4">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center border-4 border-white shadow-md relative">
             <User className="w-10 h-10 text-orange-500" />
             <div className="absolute bottom-0 right-0 w-5 h-5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <h2 className="mt-2 text-lg font-bold">{state.name}</h2>
          <p className="text-slate-500 text-xs">ID: {state.phone}</p>
       </div>

       <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
          <ProfileItem icon={<User className="w-4 h-4 text-blue-500" />} label="প্রোফাইল ইনফো" />
          <ProfileItem icon={<Wallet className="w-4 h-4 text-green-500" />} label="পেমেন্ট হিস্ট্রি" />
          <ProfileItem icon={<Users className="w-4 h-4 text-purple-500" />} label="রেফারেল লিস্ট" />
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-between p-4 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="flex items-center gap-3">
               <LogOut className="w-4 h-4 text-red-500" />
               <span className="font-bold text-sm text-red-600 tracking-tight">লগআউট</span>
            </div>
            <ChevronRight className="w-4 h-4 text-red-300" />
          </button>
       </div>

       {/* Notifications */}
       <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
             <Bell className="w-5 h-5 text-yellow-500 font-sans" />
             <h3 className="font-bold text-base">নোটিফিকেশন</h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed italic border-l-2 border-blue-500 pl-3">
             নতুন এড, বোনাস ও রেফারেলের আপডেট পেতে নিয়মিত অ্যাপটি চেক করুন। 
          </p>
       </div>

       {/* Referral Again */}
       <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-3">
             <Users className="w-5 h-5 text-blue-500" />
             <h3 className="font-bold text-base">আপনার রেফারেল লিঙ্ক</h3>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-[10px] text-slate-700 font-mono break-all mb-3 text-center">
             {window.location.host}?ref=6671318864
          </div>
          <button 
            onClick={() => {
              const link = `${window.location.protocol}//${window.location.host}?ref=6671318864`;
              navigator.clipboard.writeText(link);
              alert('লিঙ্ক কপি হয়েছে!');
            }}
            className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
             <Copy className="w-4 h-4" />
             কপি লিঙ্ক
          </button>
       </div>
    </div>
  );
}

// --- Helper Components ---

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 flex-1 transition-all ${active ? 'text-orange-500 scale-105' : 'text-slate-400'}`}
    >
      <div className={`p-1 rounded-lg ${active ? 'bg-orange-50' : 'bg-transparent'}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      <span className={`text-[9px] font-bold ${active ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="w-1 h-1 bg-orange-500 rounded-full"
        />
      )}
    </button>
  );
}

function StatCard({ icon, label, value, subValue }: { icon: React.ReactNode, label: string, value: string, subValue?: string }) {
  return (
    <div className="bg-white p-4 rounded-[1.2rem] shadow-sm border border-slate-100 flex flex-col items-center text-center">
      <div className="bg-orange-50 p-1.5 rounded-lg mb-2">
        {icon}
      </div>
      <p className="text-slate-400 text-[9px] uppercase font-bold tracking-wider mb-1">{label}</p>
      <div className="font-bold text-lg">{value}</div>
      {subValue && <p className="text-[9px] text-slate-400 mt-1">{subValue}</p>}
    </div>
  );
}

function QuickLink({ icon, label, subLabel, color, external, onClick }: { icon: React.ReactNode, label: string, subLabel: string, color: string, external?: boolean, onClick?: () => void }) {
  return (
    <motion.div 
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={`${color} text-white p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-opacity-20 transition-all cursor-pointer`}
    >
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-xl">
           {icon}
        </div>
        <div>
           <p className="font-bold text-base leading-none">{label}</p>
           <p className="text-[10px] opacity-80 mt-1">{subLabel}</p>
        </div>
      </div>
      {external ? <ExternalLink className="w-4 h-4 opacity-70" /> : <ChevronRight className="w-4 h-4 opacity-70" />}
    </motion.div>
  );
}

function TaskCard({ title, description, reward, stats, buttonLabel, buttonColor, onAction, type }: any) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 border-l-[6px] border-l-orange-500">
      <div className="flex justify-between items-start mb-3">
         <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-50 text-orange-500 rounded-lg">
              {type === 'bonus' ? <LogOut className="rotate-90 w-4 h-4" /> : type === 'video' ? <PlayCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            </div>
            <h3 className="font-bold text-base">{title}</h3>
         </div>
         <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${type === 'bonus' ? 'bg-purple-100 text-purple-600' : type === 'video' ? 'bg-green-100 text-green-600' : 'bg-green-100 text-green-600'}`}>
           {reward}
         </span>
      </div>

      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        {description}
      </p>

      <div className="flex items-center justify-between mb-4 text-[11px]">
         <div className="flex flex-col">
            <span className="text-slate-400 text-[9px] font-bold uppercase">{stats.label}</span>
            <span className="font-bold text-slate-800">{stats.value}</span>
         </div>
         <div className="text-right flex flex-col">
            <span className="text-slate-400 text-[9px] font-bold uppercase">{stats.remaining ? 'অবশিষ্ট' : 'রিসেট'}</span>
            <span className={`font-bold ${stats.remaining ? 'text-blue-500' : 'text-orange-500'}`}>{stats.remaining || stats.reset}</span>
         </div>
      </div>

      <button 
        onClick={onAction}
        className={`w-full ${buttonColor} text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md`}
      >
        🌟 {buttonLabel}
      </button>
      
      {type === 'bonus' && (
        <div className="mt-3 flex items-start gap-2 bg-yellow-50 p-2.5 rounded-lg border border-yellow-100">
           <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
           <p className="text-[9px] text-orange-800 leading-tight">এড দেখার পর ৩০ সেকেন্ড অপেক্ষা করুন</p>
        </div>
      )}
    </div>
  );
}

function SocialTaskCard({ icon, label, reward, color, onClick }: any) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-50 flex items-center justify-between">
       <div className="flex items-center gap-3">
          <div className={`${color} text-white p-2 rounded-xl`}>
             {icon}
          </div>
          <div>
             <p className="font-bold text-sm text-slate-800">{label}</p>
             <button 
               onClick={onClick}
               className="text-[10px] bg-blue-600 text-white px-3 py-1.5 font-bold rounded-lg mt-1.5 flex items-center gap-1.5"
             >
                📢 ক্লেইম বোনাস
             </button>
          </div>
       </div>
       <div className="text-right">
          <span className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{reward}</span>
       </div>
    </div>
  );
}

function PaymentMethodCard({ label, subLabel, badge, selected, onClick, icon }: any) {
  return (
    <button 
      onClick={onClick}
      className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 text-center ${selected ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-white hover:border-slate-200'}`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="font-bold text-xs text-slate-800">{label}</div>
      <div className="text-[9px] text-slate-400">{subLabel}</div>
      {badge && (
        <span className="absolute -bottom-1.5 bg-green-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-full uppercase">
          {badge}
        </span>
      )}
    </button>
  );
}

function ProfileItem({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer group">
       <div className="flex items-center gap-3">
          <div className="group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-700">{label}</span>
       </div>
       <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 transition-colors" />
    </div>
  );
}
