import React from 'react';
import { Product } from '../types';
import { cn } from '../lib/utils';
import { MoreVertical, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface InventoryListProps {
  products: Product[];
  onEdit?: (product: Product) => void;
}

export function InventoryList({ products, onEdit }: InventoryListProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">SKU</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((product) => {
              const isLowStock = product.currentStock <= product.reorderPoint;
              const isOutOfStock = product.currentStock === 0;

              return (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{product.sku}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-semibold",
                        isOutOfStock ? "text-red-600" : isLowStock ? "text-amber-600" : "text-slate-900"
                      )}>
                        {product.currentStock}
                      </span>
                      <span className="text-slate-400 text-xs">/ {product.reorderPoint} min</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">${product.unitPrice.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                      isOutOfStock 
                        ? "bg-red-50 text-red-700" 
                        : isLowStock 
                          ? "bg-amber-50 text-amber-700" 
                          : "bg-emerald-50 text-emerald-700"
                    )}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isOutOfStock ? "bg-red-600" : isLowStock ? "bg-amber-600" : "bg-emerald-600"
                      )} />
                      {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => onEdit?.(product)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {products.length === 0 && (
        <div className="p-12 text-center text-slate-400 italic">
          No products found. Add your first item to get started.
        </div>
      )}
    </div>
  );
}
