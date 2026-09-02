import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

// Product IDs matching App Store Connect
const PRODUCTS = {
  PRO_MONTHLY: 'college_org_pro_monthly',
  PRO_YEARLY: 'college_org_pro_yearly',
  PREMIUM_MONTHLY: 'college_org_premium_monthly',
  PREMIUM_YEARLY: 'college_org_premium_yearly',
};

// Map product IDs to plan names
const PRODUCT_TO_PLAN = {
  [PRODUCTS.PRO_MONTHLY]: 'pro',
  [PRODUCTS.PRO_YEARLY]: 'pro',
  [PRODUCTS.PREMIUM_MONTHLY]: 'premium',
  [PRODUCTS.PREMIUM_YEARLY]: 'premium',
};

let storeReady = false;
let storeInstance = null;

/**
 * Initialize the IAP store. Call once on app startup (iOS only).
 */
export const initializeIAP = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    console.log('[IAP] Not on iOS, skipping IAP initialization');
    return;
  }

  // Wait for CdvPurchase to be available
  const store = window.CdvPurchase?.store;
  if (!store) {
    console.warn('[IAP] CdvPurchase.store not available');
    return;
  }
  
  storeInstance = store;

  // Set verbosity for debugging (reduce in production)
  store.verbosity = store.DEBUG;

  // Register products
  store.register([{
    id: PRODUCTS.PRO_MONTHLY,
    type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
    platform: CdvPurchase.Platform.APPLE_APPSTORE,
  }, {
    id: PRODUCTS.PRO_YEARLY,
    type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
    platform: CdvPurchase.Platform.APPLE_APPSTORE,
  }, {
    id: PRODUCTS.PREMIUM_MONTHLY,
    type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
    platform: CdvPurchase.Platform.APPLE_APPSTORE,
  }, {
    id: PRODUCTS.PREMIUM_YEARLY,
    type: CdvPurchase.ProductType.PAID_SUBSCRIPTION,
    platform: CdvPurchase.Platform.APPLE_APPSTORE,
  }]);

  // Set up receipt validation via our Supabase Edge Function
  store.validator = async (receipt, callback) => {
    try {
      console.log('[IAP] Validating receipt...', receipt);
      const { data, error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: {
          receiptData: receipt.transaction?.appStoreReceipt || receipt,
          transactionId: receipt.transaction?.id,
          productId: receipt.transaction?.products?.[0]?.id || receipt.id,
        }
      });

      if (error || data?.error) {
        console.error('[IAP] Validation failed:', error || data?.error);
        callback({ ok: false, message: error?.message || data?.error });
        return;
      }

      console.log('[IAP] Validation successful:', data);
      callback({ ok: true, data: { transaction: receipt.transaction } });
    } catch (err) {
      console.error('[IAP] Validation error:', err);
      callback({ ok: false, message: err.message });
    }
  };

  // Listen for approved transactions
  store.when()
    .approved(transaction => {
      console.log('[IAP] Transaction approved:', transaction);
      transaction.verify();
    })
    .verified(receipt => {
      console.log('[IAP] Receipt verified:', receipt);
      receipt.finish();
      // Dispatch plan update event with product details
      const productId = receipt?.transaction?.products?.[0]?.id;
      const plan = productId ? PRODUCT_TO_PLAN[productId] : null;
      if (plan) {
        window.dispatchEvent(new CustomEvent('iap-plan-updated', { detail: { plan } }));
      }
      // Also trigger a full user data refresh from database
      window.dispatchEvent(new Event('refetch-user'));
    })
    .finished(transaction => {
      console.log('[IAP] Transaction finished:', transaction);
    })
    .unverified(receipt => {
      console.error('[IAP] Receipt unverified:', receipt);
    });

  // Initialize the store
  await store.initialize([CdvPurchase.Platform.APPLE_APPSTORE]);
  storeReady = true;
  console.log('[IAP] Store initialized successfully');
};

/**
 * Get product info (prices from App Store)
 */
export const getProducts = () => {
  if (!storeInstance || !storeReady) return [];
  return Object.values(PRODUCTS).map(id => {
    const product = storeInstance.get(id, CdvPurchase.Platform.APPLE_APPSTORE);
    return product ? {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.pricing?.price || '',
      priceMicros: product.pricing?.priceMicros,
      currency: product.pricing?.currency,
      plan: PRODUCT_TO_PLAN[product.id],
    } : null;
  }).filter(Boolean);
};

/**
 * Get the price string for a specific product
 */
export const getProductPrice = (productId) => {
  if (!storeInstance || !storeReady) return null;
  const product = storeInstance.get(productId, CdvPurchase.Platform.APPLE_APPSTORE);
  return product?.pricing?.price || null;
};

/**
 * Purchase a product by ID
 */
export const purchaseProduct = async (productId) => {
  if (!storeInstance || !storeReady) {
    throw new Error('Store not initialized');
  }

  const product = storeInstance.get(productId, CdvPurchase.Platform.APPLE_APPSTORE);
  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  const offer = product.getOffer();
  if (!offer) {
    throw new Error(`No offer found for ${productId}`);
  }

  console.log('[IAP] Starting purchase for:', productId);
  const result = await storeInstance.order(offer);
  
  if (result?.isError) {
    throw new Error(result.message || 'Purchase failed');
  }
  
  return result;
};

/**
 * Restore previous purchases
 */
export const restorePurchases = async () => {
  if (!storeInstance || !storeReady) {
    throw new Error('Store not initialized');
  }

  console.log('[IAP] Restoring purchases...');
  await storeInstance.restorePurchases();
};

/**
 * Check if IAP is available (running on iOS)
 */
export const isIAPAvailable = () => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios' && storeReady;
};

/**
 * Open iOS subscription management in Settings
 */
export const openSubscriptionManagement = () => {
  // This opens the iOS Settings > Subscriptions page
  if (Capacitor.getPlatform() === 'ios') {
    window.open('https://apps.apple.com/account/subscriptions', '_blank');
  }
};

export { PRODUCTS, PRODUCT_TO_PLAN };
