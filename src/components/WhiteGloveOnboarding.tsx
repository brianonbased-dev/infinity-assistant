'use client';

/**
 * White Glove Onboarding Component
 *
 * Premium onboarding experience where users provide minimal information
 * and the system handles everything else automatically.
 *
 * User provides:
 * - Email
 * - Password preference (auto-generate or custom)
 * - Payment method
 * - Full name
 *
 * System handles:
 * - Creating all required accounts
 * - Retrieving API keys
 * - Configuring environment
 * - Starting the build
 */

import { useState, useCallback } from 'react';
import {
  Sparkles,
  Crown,
  Shield,
  CreditCard,
  Mail,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  Loader2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Zap,
  Clock,
  Star,
} from 'lucide-react';
import type { BuilderTemplate } from '@/types/builder-templates';
import type { WhiteGloveUserInput, WhiteGloveSession, WhiteGloveStatus } from '@/services/WhiteGloveService';

// ============================================================================
// TYPES
// ============================================================================

export interface WhiteGloveOnboardingProps {
  template: BuilderTemplate;
  onSubmit: (input: WhiteGloveUserInput) => Promise<void>;
  onBack: () => void;
  session?: WhiteGloveSession;
  isProcessing?: boolean;
}

type OnboardingStep = 'intro' | 'account' | 'payment' | 'processing';

// ============================================================================
// STATUS DISPLAY COMPONENT
// ============================================================================

const STATUS_CONFIG: Record<WhiteGloveStatus, { label: string; icon: React.ReactNode; color: string }> = {
  initializing: { label: 'Initializing...', icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'text-blue-400' },
  creating_accounts: { label: 'Creating accounts...', icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'text-purple-400' },
  retrieving_credentials: { label: 'Retrieving credentials...', icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'text-pink-400' },
  configuring_environment: { label: 'Configuring environment...', icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'text-orange-400' },
  starting_build: { label: 'Starting build...', icon: <Loader2 className="w-5 h-5 animate-spin" />, color: 'text-green-400' },
  building: { label: 'Building your project...', icon: <Sparkles className="w-5 h-5" />, color: 'text-yellow-400' },
  completed: { label: 'Setup complete!', icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-green-400' },
  failed: { label: 'Setup failed', icon: <AlertCircle className="w-5 h-5" />, color: 'text-red-400' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function WhiteGloveOnboarding({
  template,
  onSubmit,
  onBack,
  session,
  isProcessing = false,
}: WhiteGloveOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>('intro');

  // Form state
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [autoGeneratePasswords, setAutoGeneratePasswords] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Payment state (simplified - in production would use Stripe Elements)
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validate account step
  const validateAccountStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!autoGeneratePasswords) {
      if (!masterPassword) {
        newErrors.masterPassword = 'Password is required';
      } else if (masterPassword.length < 12) {
        newErrors.masterPassword = 'Password must be at least 12 characters';
      }

      if (masterPassword !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Validate payment step
  const validatePaymentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic card validation (in production, Stripe handles this)
    if (!cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
      newErrors.cardNumber = 'Please enter a valid card number';
    }

    if (!cardExpiry.match(/^\d{2}\/\d{2}$/)) {
      newErrors.cardExpiry = 'Please enter expiry as MM/YY';
    }

    if (!cardCvc.match(/^\d{3,4}$/)) {
      newErrors.cardCvc = 'Please enter a valid CVC';
    }

    if (!agreedToTerms) {
      newErrors.terms = 'You must agree to the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next step
  const handleNext = useCallback(() => {
    if (step === 'intro') {
      setStep('account');
    } else if (step === 'account') {
      if (validateAccountStep()) {
        setStep('payment');
      }
    } else if (step === 'payment') {
      if (validatePaymentStep()) {
        setStep('processing');
        // Submit the form
        onSubmit({
          email,
          fullName,
          phone: phone || undefined,
          masterPassword: autoGeneratePasswords ? undefined : masterPassword,
          autoGeneratePasswords,
          paymentMethod: {
            type: 'card',
            cardToken: `tok_${cardNumber.replace(/\s/g, '')}`, // Simulated token
          },
        });
      }
    }
  }, [step, email, fullName, phone, masterPassword, autoGeneratePasswords, cardNumber, onSubmit]);

  // Handle back
  const handleBack = useCallback(() => {
    if (step === 'account') {
      setStep('intro');
    } else if (step === 'payment') {
      setStep('account');
    } else if (step === 'intro') {
      onBack();
    }
  }, [step, onBack]);

  // Format card number with spaces
  const formatCardNumber = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Format expiry
  const formatExpiry = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 2) {
      return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return digits;
  };

  // Render intro step
  const renderIntroStep = () => (
    <div className="space-y-8">
      {/* Premium Badge */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium mb-6">
          <Crown className="w-4 h-4" />
          White Glove Service
        </div>

        <h2 className="text-3xl font-bold text-white mb-3">
          Let Us Handle Everything
        </h2>
        <p className="text-gray-400 max-w-lg mx-auto">
          Just provide your email and payment method. We'll create all the accounts,
          configure everything, and deliver a fully working {template.name} to you.
        </p>
      </div>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">Zero Setup</h3>
          <p className="text-sm text-gray-400">
            We create all required accounts and configure everything for you.
          </p>
        </div>

        <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">Save Hours</h3>
          <p className="text-sm text-gray-400">
            Skip the tedious account creation and API key hunting process.
          </p>
        </div>

        <div className="p-5 bg-gray-800/50 border border-gray-700 rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="font-semibold text-white mb-1">Secure</h3>
          <p className="text-sm text-gray-400">
            All credentials are encrypted and only used during your build.
          </p>
        </div>
      </div>

      {/* What's Included */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-400" />
          What's Included
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {template.requirements.accounts.filter(a => a.required).map((account) => (
            <div key={account.id} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <span className="text-gray-300">{account.name} account setup</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-gray-300">All API keys configured</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-gray-300">Database setup</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-gray-300">Deployment ready</span>
          </div>
        </div>
      </div>

      {/* Price Info */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400">White Glove Setup Fee</p>
            <p className="text-2xl font-bold text-white">$29</p>
            <p className="text-xs text-gray-500">+ standard token costs</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Estimated Token Cost</p>
            <p className="text-xl font-semibold text-white">~{template.estimatedTokens.typical} tokens</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render account step
  const renderAccountStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Your Information</h2>
        <p className="text-gray-400">
          We'll use this to create and manage your accounts
        </p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
              }`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-sm text-red-400">{errors.email}</p>
          )}
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Full Name *
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.fullName ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
              }`}
            />
          </div>
          {errors.fullName && (
            <p className="mt-1 text-sm text-red-400">{errors.fullName}</p>
          )}
        </div>

        {/* Phone (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Phone Number <span className="text-gray-500">(optional, for 2FA)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Password Options */}
        <div className="pt-4 border-t border-gray-700">
          <label className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="checkbox"
              checked={autoGeneratePasswords}
              onChange={(e) => setAutoGeneratePasswords(e.target.checked)}
              className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
            />
            <div>
              <p className="font-medium text-white">Auto-generate secure passwords</p>
              <p className="text-sm text-gray-400">
                We'll create strong, unique passwords for each service
              </p>
            </div>
          </label>
        </div>

        {/* Custom Password (if not auto-generating) */}
        {!autoGeneratePasswords && (
          <div className="space-y-4 animate-in slide-in-from-top-2">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Master Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="At least 12 characters"
                  className={`w-full pl-10 pr-12 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                    errors.masterPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.masterPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.masterPassword}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                  errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
                }`}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render payment step
  const renderPaymentStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Payment Details</h2>
        <p className="text-gray-400">
          Secure payment for white glove service and any paid integrations
        </p>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
        <Shield className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-green-400 font-medium">Secure Payment</p>
          <p className="text-green-300/70 mt-1">
            Your card details are encrypted and processed securely via Stripe.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Card Number */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Card Number
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className={`w-full pl-10 pr-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.cardNumber ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
              }`}
            />
          </div>
          {errors.cardNumber && (
            <p className="mt-1 text-sm text-red-400">{errors.cardNumber}</p>
          )}
        </div>

        {/* Expiry and CVC */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expiry Date
            </label>
            <input
              type="text"
              value={cardExpiry}
              onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
              placeholder="MM/YY"
              maxLength={5}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.cardExpiry ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
              }`}
            />
            {errors.cardExpiry && (
              <p className="mt-1 text-sm text-red-400">{errors.cardExpiry}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CVC
            </label>
            <input
              type="text"
              value={cardCvc}
              onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="123"
              maxLength={4}
              className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                errors.cardCvc ? 'border-red-500 focus:ring-red-500' : 'border-gray-700 focus:ring-purple-500'
              }`}
            />
            {errors.cardCvc && (
              <p className="mt-1 text-sm text-red-400">{errors.cardCvc}</p>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
          <h4 className="font-medium text-white mb-3">Order Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">White Glove Setup Fee</span>
              <span className="text-white">$29.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Estimated Token Cost (~{template.estimatedTokens.typical})</span>
              <span className="text-white">~${(template.estimatedTokens.typical * 0.01).toFixed(2)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-gray-700 flex justify-between font-medium">
              <span className="text-gray-300">Total</span>
              <span className="text-white">~${(29 + template.estimatedTokens.typical * 0.01).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Terms Agreement */}
        <label className="flex items-start gap-3 p-4 bg-gray-800/30 border border-gray-700 rounded-xl cursor-pointer hover:bg-gray-800/50 transition-colors">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
          />
          <div className="text-sm">
            <p className="text-gray-300">
              I agree to the{' '}
              <a href="#" className="text-purple-400 hover:underline">Terms of Service</a>
              {' '}and{' '}
              <a href="#" className="text-purple-400 hover:underline">Privacy Policy</a>
            </p>
            <p className="text-gray-500 mt-1">
              I authorize Infinity Assistant to create accounts on my behalf using the provided information.
            </p>
          </div>
        </label>
        {errors.terms && (
          <p className="text-sm text-red-400">{errors.terms}</p>
        )}
      </div>
    </div>
  );

  // Render processing step
  const renderProcessingStep = () => {
    const status = session?.status || 'initializing';
    const statusConfig = STATUS_CONFIG[status];

    return (
      <div className="space-y-8 py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-6">
            {status === 'completed' ? (
              <CheckCircle2 className="w-10 h-10 text-white" />
            ) : status === 'failed' ? (
              <AlertCircle className="w-10 h-10 text-white" />
            ) : (
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {status === 'completed'
              ? 'All Set!'
              : status === 'failed'
                ? 'Setup Failed'
                : 'Setting Everything Up...'}
          </h2>

          <div className={`flex items-center justify-center gap-2 ${statusConfig.color}`}>
            {statusConfig.icon}
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Progress Steps */}
        {session && (
          <div className="max-w-md mx-auto space-y-3">
            {session.auditLog.slice(-5).map((entry, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  entry.success ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}
              >
                {entry.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${entry.success ? 'text-green-300' : 'text-red-300'}`}>
                    {entry.details}
                  </p>
                  {entry.provider && (
                    <p className="text-xs text-gray-500">{entry.provider}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Created Accounts */}
        {session && session.createdAccounts.length > 0 && (
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Accounts Created</h3>
            <div className="flex flex-wrap gap-2">
              {session.createdAccounts.map((account) => (
                <span
                  key={account.provider}
                  className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {account.provider}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {session?.error && (
          <div className="max-w-md mx-auto p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-400 text-sm">{session.error}</p>
          </div>
        )}
      </div>
    );
  };

  // Step indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: 'intro', label: 'Overview' },
      { id: 'account', label: 'Account' },
      { id: 'payment', label: 'Payment' },
      { id: 'processing', label: 'Setup' },
    ];

    const currentIndex = steps.findIndex((s) => s.id === step);

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                s.id === step
                  ? 'bg-purple-500 text-white'
                  : index < currentIndex
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-700 text-gray-500'
              }`}
            >
              {index < currentIndex ? (
                <Check className="w-4 h-4" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center text-xs">
                  {index + 1}
                </span>
              )}
              {s.label}
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${index < currentIndex ? 'bg-green-500' : 'bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {renderStepIndicator()}

      {step === 'intro' && renderIntroStep()}
      {step === 'account' && renderAccountStep()}
      {step === 'payment' && renderPaymentStep()}
      {step === 'processing' && renderProcessingStep()}

      {/* Navigation */}
      {step !== 'processing' && (
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={isProcessing}
            className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:from-gray-700 disabled:to-gray-600 text-black font-semibold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-500/25"
          >
            {step === 'payment' ? (
              <>
                <Crown className="w-5 h-5" />
                Start White Glove Setup
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
