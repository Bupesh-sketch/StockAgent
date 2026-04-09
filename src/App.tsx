/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare, 
  Settings, 
  Plus,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  LogIn,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  History,
  ArrowDownRight,
  User as UserIcon,
  Shield,
  Building2,
  Globe
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  setDoc,
  query, 
  orderBy, 
  limit,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { Product, InventoryAlert, PredictionResult, Transaction } from './types';
import { cn } from './lib/utils';
import { InventoryList } from './components/InventoryList';
import { ProductModal } from './components/ProductModal';
import { SellModal } from './components/SellModal';
import { predictShortages, getInventoryAdvice } from './lib/gemini';
import ReactMarkdown from 'react-markdown';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'alerts' | 'predictions' | 'chat' | 'settings'>('dashboard');
  const [selectedProductType, setSelectedProductType] = useState<'all' | 'medicine' | 'electronics' | 'general'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // UI State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sellingProduct, setSellingProduct] = useState<Product | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      
      if (user) {
        // Ensure user profile exists in Firestore
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const initialProfile = {
              email: user.email,
              displayName: user.displayName || 'User',
              role: user.email === "bupeshkattri0@gmail.com" ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              pharmacyName: 'StockSage Medical Center',
              warningThreshold: 90,
              currency: 'USD ($)'
            };
            await setDoc(userRef, initialProfile);
            setUserProfile(initialProfile);
          } else {
            setUserProfile(userSnap.data());
          }
        } catch (e) {
          console.error("Error checking user profile", e);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) return;

    const productsUnsubscribe = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(productsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    const alertsUnsubscribe = onSnapshot(
      query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(20)),
      (snapshot) => {
        const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryAlert));
        setAlerts(alertsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'alerts')
    );

    const transactionsUnsubscribe = onSnapshot(
      query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(50)),
      (snapshot) => {
        const transactionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(transactionsData);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'transactions')
    );

    return () => {
      productsUnsubscribe();
      alertsUnsubscribe();
      transactionsUnsubscribe();
    };
  }, [user]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          lastRestocked: new Date().toISOString()
        });
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!user) {
      setNotification({ type: 'error', message: 'You must be logged in to delete items.' });
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', id));
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setNotification({ type: 'success', message: 'Product deleted successfully.' });
    } catch (error) {
      console.error("Delete failed:", error);
      setNotification({ type: 'error', message: 'Failed to delete product. Please check your permissions.' });
      handleFirestoreError(error, OperationType.DELETE, 'products');
    }
  };

  const handleRunPredictions = async () => {
    if (products.length === 0) return;
    setIsPredicting(true);
    try {
      const results = await predictShortages(products);
      setPredictions(results);
      
      // Create alerts for high-risk shortages
      for (const res of results) {
        if (res.confidence > 0.7 && res.predictedShortageDate) {
          const existingAlert = alerts.find(a => a.productId === res.productId && a.severity === 'high');
          if (!existingAlert) {
            await addDoc(collection(db, 'alerts'), {
              productId: res.productId,
              productName: res.productName,
              message: `AI Prediction: Potential shortage around ${new Date(res.predictedShortageDate).toLocaleDateString()}. ${res.reasoning}`,
              severity: 'high',
              timestamp: new Date().toISOString()
            });
          }
        }
      }
      setActiveTab('predictions');
    } catch (error) {
      console.error("Prediction failed", error);
    } finally {
      setIsPredicting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);

    try {
      const aiResponse = await getInventoryAdvice(userMsg, products);
      setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'ai', content: "I'm sorry, I'm having trouble connecting to my brain right now." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-8">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-xl shadow-indigo-200">
          <Package size={32} />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">StockSage AI</h1>
        <p className="text-slate-500 text-center max-w-md mb-8 text-lg">
          Intelligent inventory management with predictive supply shortage alerts and AI-driven insights.
        </p>
        <button 
          onClick={handleLogin}
          className="flex items-center gap-3 bg-white border border-slate-200 px-8 py-3 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
        >
          <LogIn size={20} />
          Sign in with Google
        </button>
      </div>
    );
  }

  const lowStockItems = products.filter(p => p.currentStock <= p.reorderPoint);
  const outOfStockItems = products.filter(p => p.currentStock === 0);

  // Calculate sales by type
  const salesByType = transactions
    .filter(t => t.type === 'out')
    .reduce((acc, t) => {
      const product = products.find(p => p.id === t.productId);
      if (product) {
        acc[product.type] = (acc[product.type] || 0) + t.quantity;
      }
      return acc;
    }, {} as Record<string, number>);

  const totalSold = Object.values(salesByType).reduce((a, b) => a + b, 0);

  const handleUpdateProfile = async (updates: any) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, updates);
      setUserProfile(prev => ({ ...prev, ...updates }));
      setNotification({ type: 'success', message: 'Profile updated successfully!' });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleRecordSale = async (productId: string, quantity: number) => {
    if (!user) return;
    try {
      const productRef = doc(db, 'products', productId);
      const product = products.find(p => p.id === productId);
      if (!product) return;

      const newStock = product.currentStock - quantity;
      
      // Update product stock
      await updateDoc(productRef, {
        currentStock: newStock
      });

      // Record transaction
      await addDoc(collection(db, 'transactions'), {
        productId,
        type: 'out',
        quantity,
        timestamp: new Date().toISOString()
      });

      setNotification({ 
        type: 'success', 
        message: `Successfully sold ${quantity} units of ${product.name}.` 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Notifications */}
      {notification && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-right-full duration-300",
          notification.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {notification.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <p className="font-medium">{notification.message}</p>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-slate-200 transition-all duration-300 flex flex-col z-40",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shrink-0">
            <Package size={20} />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl tracking-tight truncate">StockSage</span>}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'alerts', label: 'Alerts', icon: AlertTriangle, count: alerts.length },
            { id: 'predictions', label: 'AI Predictions', icon: TrendingUp },
            { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group relative",
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-700 font-medium" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={20} className={cn(
                activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              {isSidebarOpen && <span className="truncate">{item.label}</span>}
              {item.count && item.count > 0 && isSidebarOpen && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 transition-colors rounded-lg",
              activeTab === 'settings' 
                ? "bg-indigo-50 text-indigo-700 font-medium" 
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Settings size={20} />
            {isSidebarOpen && <span>Settings</span>}
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold capitalize">{activeTab}</h1>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleRunPredictions}
              disabled={isPredicting || products.length === 0}
              className={cn(
                "hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                isPredicting 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              {isPredicting ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              <span>Predict Shortages</span>
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
              <Bell size={20} />
              {alerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-900">{user.displayName}</p>
                <p className="text-[10px] text-slate-500">{user.email}</p>
              </div>
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                alt="Profile" 
                className="w-8 h-8 rounded-full border border-slate-200"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Overview</h2>
                    <p className="text-slate-500">Real-time status of your inventory ecosystem.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingProduct(null);
                      setIsProductModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
                  >
                    <Plus size={20} />
                    <span>Add Item</span>
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Items', value: products.length, icon: Package, color: 'indigo' },
                    { label: 'Low Stock', value: lowStockItems.length, icon: AlertTriangle, color: 'amber' },
                    { label: 'Out of Stock', value: outOfStockItems.length, icon: X, color: 'red' },
                    { label: 'Total Sold', value: totalSold, icon: ArrowDownRight, color: 'emerald' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className={cn(
                          "p-2 rounded-xl",
                          stat.color === 'indigo' && "bg-indigo-50 text-indigo-600",
                          stat.color === 'amber' && "bg-amber-50 text-amber-600",
                          stat.color === 'red' && "bg-red-50 text-red-600",
                          stat.color === 'rose' && "bg-rose-50 text-rose-600",
                          stat.color === 'emerald' && "bg-emerald-50 text-emerald-600",
                        )}>
                          <stat.icon size={24} />
                        </div>
                      </div>
                      <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Charts & Sales Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-slate-900">Stock Levels by Category</h3>
                      <div className="flex gap-4">
                        {Object.entries(salesByType).map(([type, count]) => (
                          <div key={type} className="text-right">
                            <p className="text-[10px] text-slate-400 uppercase font-bold">{type} Sold</p>
                            <p className="text-sm font-bold text-slate-900">{count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={products.slice(0, 8)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="currentStock" radius={[4, 4, 0, 0]}>
                            {products.slice(0, 8).map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.currentStock <= entry.reorderPoint ? '#f59e0b' : '#4f46e5'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-6">Recent Activity</h3>
                    <div className="space-y-6">
                      {transactions.slice(0, 5).map((t, i) => {
                        const product = products.find(p => p.id === t.productId);
                        return (
                          <div key={i} className="flex gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                              t.type === 'in' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                            )}>
                              {t.type === 'in' ? <Plus size={18} /> : <X size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {t.type === 'in' ? 'Restocked' : 'Sold'} {product?.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {t.quantity} units • {new Date(t.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {transactions.length === 0 && (
                        <div className="text-center py-12 text-slate-400 italic text-sm">
                          No recent activity recorded.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">Inventory Management</h2>
                    <p className="text-slate-500 text-sm">Manage and track your stock across different categories.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setEditingProduct(null);
                        setIsProductModalOpen(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
                    >
                      <Plus size={20} />
                      <span>Add Item</span>
                    </button>
                  </div>
                </div>

                {/* Type Switcher */}
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit">
                  {(['all', 'medicine', 'electronics', 'general'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedProductType(type)}
                      className={cn(
                        "px-6 py-2 rounded-lg text-sm font-bold transition-all capitalize",
                        selectedProductType === type 
                          ? "bg-white text-indigo-600 shadow-sm" 
                          : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <InventoryList 
                  products={products.filter(p => selectedProductType === 'all' || p.type === selectedProductType)} 
                  onEdit={(p) => {
                    setEditingProduct(p);
                    setIsProductModalOpen(true);
                  }}
                  onSell={(p) => {
                    setSellingProduct(p);
                    setIsSellModalOpen(true);
                  }}
                />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-2xl font-bold">System Alerts</h2>
                <div className="grid grid-cols-1 gap-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={cn(
                      "p-6 rounded-2xl border flex gap-4 items-start",
                      alert.severity === 'high' ? "bg-red-50 border-red-100" : 
                      alert.severity === 'medium' ? "bg-amber-50 border-amber-100" : "bg-blue-50 border-blue-100"
                    )}>
                      <div className={cn(
                        "p-2 rounded-xl",
                        alert.severity === 'high' ? "bg-red-100 text-red-600" : 
                        alert.severity === 'medium' ? "bg-amber-100 text-amber-600" : "bg-blue-100 text-blue-600"
                      )}>
                        <AlertCircle size={24} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-slate-900">{alert.productName}</h4>
                          <span className="text-xs text-slate-500">{new Date(alert.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                  {alerts.length === 0 && (
                    <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="font-bold text-slate-900">All Clear!</h3>
                      <p className="text-slate-500">No critical alerts or shortages detected at the moment.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'predictions' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">AI Shortage Predictions</h2>
                  <button 
                    onClick={handleRunPredictions}
                    disabled={isPredicting || products.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    {isPredicting ? <Loader2 size={20} className="animate-spin" /> : <TrendingUp size={20} />}
                    <span>Refresh Analysis</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {predictions.map((pred, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-slate-900">{pred.productName}</h3>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold",
                          pred.confidence > 0.8 ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {Math.round(pred.confidence * 100)}% Risk
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <AlertTriangle size={18} className="text-amber-500" />
                          <span>Predicted Shortage: <strong>{pred.predictedShortageDate ? new Date(pred.predictedShortageDate).toLocaleDateString() : 'Unknown'}</strong></span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 italic leading-relaxed">
                          "{pred.reasoning}"
                        </div>
                      </div>
                    </div>
                  ))}
                  {predictions.length === 0 && !isPredicting && (
                    <div className="col-span-full bg-indigo-50 p-12 rounded-2xl border border-indigo-100 text-center">
                      <TrendingUp size={48} className="text-indigo-400 mx-auto mb-4" />
                      <h3 className="font-bold text-indigo-900">Run AI Analysis</h3>
                      <p className="text-indigo-600 max-w-md mx-auto">
                        Click the button above to let StockSage analyze your inventory patterns and predict potential supply gaps.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Settings</h2>
                  <p className="text-slate-500 mt-1">Manage your profile and system preferences.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Personal Details */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <UserIcon size={20} />
                      </div>
                      <h3 className="font-bold text-slate-900">Personal Details</h3>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Full Name</label>
                        <input 
                          type="text" 
                          value={userProfile?.displayName || ''} 
                          onChange={(e) => handleUpdateProfile({ displayName: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Email Address</label>
                        <input 
                          type="email" 
                          disabled
                          value={userProfile?.email || ''} 
                          className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Role</label>
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 capitalize">
                          <Shield size={14} />
                          {userProfile?.role || 'User'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Management */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                        <Building2 size={20} />
                      </div>
                      <h3 className="font-bold text-slate-900">System Management</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Pharmacy/Store Name</label>
                        <input 
                          type="text" 
                          value={userProfile?.pharmacyName || ''} 
                          onChange={(e) => handleUpdateProfile({ pharmacyName: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Default Currency</label>
                        <div className="relative">
                          <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <select 
                            value={userProfile?.currency || 'USD ($)'}
                            onChange={(e) => handleUpdateProfile({ currency: e.target.value })}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm appearance-none"
                          >
                            <option>USD ($)</option>
                            <option>EUR (€)</option>
                            <option>GBP (£)</option>
                            <option>INR (₹)</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase">Expiry Warning Threshold (Days)</label>
                        <input 
                          type="number" 
                          value={userProfile?.warningThreshold || 90} 
                          onChange={(e) => handleUpdateProfile({ warningThreshold: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="h-[calc(100vh-12rem)] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">StockSage Assistant</h3>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">AI Online</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare size={32} />
                      </div>
                      <h3 className="font-bold text-slate-900">How can I help you today?</h3>
                      <p className="text-slate-500 max-w-xs mx-auto text-sm mt-2">
                        Ask me about stock levels, reorder suggestions, or inventory trends.
                      </p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        {['What items are low?', 'Predict shortages', 'Show electronics stock'].map(q => (
                          <button 
                            key={q}
                            onClick={() => setChatInput(q)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs transition-colors"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn(
                      "flex gap-4 max-w-[85%]",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}>
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        msg.role === 'user' ? "bg-slate-200 text-slate-600" : "bg-indigo-600 text-white"
                      )}>
                        {msg.role === 'user' ? user.displayName?.[0] : <Package size={16} />}
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-slate-100 text-slate-800 rounded-tl-none"
                      )}>
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex gap-4 max-w-[85%]">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Package size={16} />
                      </div>
                      <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-slate-100">
                  <form 
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                  >
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask StockSage anything..."
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    />
                    <button 
                      type="submit"
                      disabled={!chatInput.trim() || isChatLoading}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-50 transition-all"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <ProductModal 
        isOpen={isProductModalOpen}
        product={editingProduct}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
      />

      <SellModal
        isOpen={isSellModalOpen}
        product={sellingProduct}
        onClose={() => {
          setIsSellModalOpen(false);
          setSellingProduct(null);
        }}
        onSell={handleRecordSale}
      />
    </div>
  );
}


