export interface Product {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  reorderPoint: number;
  unitPrice: number;
  lastRestocked: string; // ISO date
  sku: string;
}

export interface Transaction {
  id: string;
  productId: string;
  type: 'in' | 'out';
  quantity: number;
  timestamp: string; // ISO date
}

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string; // ISO date
}

export interface PredictionResult {
  productId: string;
  productName: string;
  predictedShortageDate: string | null;
  confidence: number;
  reasoning: string;
}
