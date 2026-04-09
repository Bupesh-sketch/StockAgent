import React, { useState } from 'react';
import { X, ArrowDownRight, Loader2 } from 'lucide-react';
import { Product } from '../types';

interface SellModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onSell: (productId: string, quantity: number) => Promise<void>;
}

export function SellModal({ isOpen, product, onClose, onSell }: SellModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 || quantity > product.currentStock) return;

    setIsSubmitting(true);
    try {
      await onSell(product.id, quantity);
      onClose();
      setQuantity(1);
    } catch (error) {
      console.error("Sale failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <ArrowDownRight size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 text-left">Record Sale</h2>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider text-left">Inventory Outflow</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 text-left">Product</p>
            <p className="text-lg font-bold text-slate-900 text-left">{product.name}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-medium text-slate-500">Current Stock:</span>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {product.currentStock} units
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block text-left">Quantity to Sell</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max={product.currentStock}
                required
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all text-2xl font-bold text-slate-900"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                Units
              </div>
            </div>
            {quantity > product.currentStock && (
              <p className="text-xs font-bold text-red-500 mt-1 text-left">Cannot sell more than available stock!</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || quantity <= 0 || quantity > product.currentStock}
              className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ArrowDownRight size={20} />}
              Confirm Sale
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
