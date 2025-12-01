/**
 * Monetization Components Export
 *
 * All $BRIAN, USDC, and USD payment-related components
 * Supports Base network for crypto payments
 */

// Payment Mode Toggle & Context
export {
  PaymentModeProvider,
  PaymentModeToggle,
  PriceDisplay,
  usePaymentMode,
  type PaymentMode,
  type PricingTier,
} from '../PaymentModeToggle';

// Pricing Page
export { PricingPage } from '../PricingPage';

// Upgrade Modal
export { UpgradeModal, type UpgradePlan } from '../UpgradeModal';

// $BRIAN Logo Components
export { BrianLogo, BrianIcon, BrianBadge } from '../BrianLogo';

// Network Components (Base, Ethereum, Polygon, etc.)
export {
  NetworkIndicator,
  NetworkBadge,
  NetworkSelector,
  NetworkInfoBanner,
  BaseNetworkIndicator,
  NETWORKS,
  DEFAULT_NETWORK,
  type SupportedNetwork,
  type NetworkConfig,
} from '../NetworkIndicator';
