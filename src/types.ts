export interface Product {
  id: string;
  name: string;
  category: string;
  type: 'medicine' | 'electronics' | 'general';
  currentStock: number;
  reorderPoint: number;
  unitPrice: number;
  lastRestocked: string; // ISO date
  sku: string;
  // Medical specific fields
  expiryDate?: string;
  batchNumber?: string;
  requiresPrescription?: boolean;
  isColdChain?: boolean;
  dosageForm?: string; // e.g., Tablet, Syrup, Injection
}

export interface Transaction {
  id: string;
  productId: string;
  productName?: string;
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
  type?: 'system' | 'ai';
}

export interface PredictionResult {
  productId: string;
  productName: string;
  predictedShortageDate: string | null;
  confidence: number;
  reasoning: string;
}
