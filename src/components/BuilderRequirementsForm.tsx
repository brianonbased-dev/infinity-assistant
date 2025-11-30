'use client';

/**
 * Builder Requirements Form
 *
 * Collects all required accounts, credentials, and variables UPFRONT
 * before starting the build process.
 *
 * Flow:
 * 1. User selects template or describes project
 * 2. System shows what's needed (accounts, variables, tokens)
 * 3. User provides all credentials
 * 4. Assistant validates and stores securely
 * 5. Orchestration handles the rest autonomously
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Check,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  AlertCircle,
  Info,
  Coins,
  Shield,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import type {
  BuilderTemplate,
  AccountRequirement,
  VariableRequirement,
  OptionalRequirement,
} from '@/types/builder-templates';
import {
  calculateTotalTokens,
  getAllRequiredAccounts,
  getAllRequiredVariables,
} from '@/types/builder-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface RequirementsFormData {
  templateId: string;
  variables: Record<string, string>;
  enabledOptionals: string[];
  estimatedTokens: number;
}

export interface BuilderRequirementsFormProps {
  template: BuilderTemplate;
  userTokenBalance: number;
  onSubmit: (data: RequirementsFormData) => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

interface VariableInputState {
  value: string;
  isValid: boolean;
  isTouched: boolean;
  showPassword: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function BuilderRequirementsForm({
  template,
  userTokenBalance,
  onSubmit,
  onBack,
  isSubmitting = false,
}: BuilderRequirementsFormProps) {
  // Track enabled optional features
  const [enabledOptionals, setEnabledOptionals] = useState<string[]>(
    template.requirements.optional
      .filter((o) => o.enabledByDefault)
      .map((o) => o.id)
  );

  // Track variable values
  const [variables, setVariables] = useState<Record<string, VariableInputState>>(() => {
    const initial: Record<string, VariableInputState> = {};
    const allVars = getAllRequiredVariables(template, enabledOptionals);
    allVars.forEach((v) => {
      initial[v.id] = {
        value: '',
        isValid: !v.required,
        isTouched: false,
        showPassword: false,
      };
    });
    return initial;
  });

  // Track account setup completion
  const [completedAccounts, setCompletedAccounts] = useState<Set<string>>(new Set());

  // Current step
  const [currentStep, setCurrentStep] = useState<'overview' | 'accounts' | 'variables' | 'confirm'>('overview');

  // Calculate derived values
  const estimatedTokens = useMemo(
    () => calculateTotalTokens(template, enabledOptionals),
    [template, enabledOptionals]
  );

  const requiredAccounts = useMemo(
    () => getAllRequiredAccounts(template, enabledOptionals),
    [template, enabledOptionals]
  );

  const requiredVariables = useMemo(
    () => getAllRequiredVariables(template, enabledOptionals),
    [template, enabledOptionals]
  );

  const hasEnoughTokens = userTokenBalance >= estimatedTokens;

  const allAccountsComplete = requiredAccounts.every((a) => completedAccounts.has(a.id));

  const allVariablesValid = requiredVariables.every((v) => {
    const state = variables[v.id];
    return !v.required || (state && state.value.trim() !== '');
  });

  // Handle optional feature toggle
  const toggleOptional = useCallback((optionalId: string) => {
    setEnabledOptionals((prev) =>
      prev.includes(optionalId)
        ? prev.filter((id) => id !== optionalId)
        : [...prev, optionalId]
    );
  }, []);

  // Handle variable change
  const handleVariableChange = useCallback((variableId: string, value: string) => {
    setVariables((prev) => ({
      ...prev,
      [variableId]: {
        ...prev[variableId],
        value,
        isTouched: true,
        isValid: value.trim() !== '',
      },
    }));
  }, []);

  // Toggle password visibility
  const togglePasswordVisibility = useCallback((variableId: string) => {
    setVariables((prev) => ({
      ...prev,
      [variableId]: {
        ...prev[variableId],
        showPassword: !prev[variableId]?.showPassword,
      },
    }));
  }, []);

  // Mark account as complete
  const markAccountComplete = useCallback((accountId: string) => {
    setCompletedAccounts((prev) => new Set([...prev, accountId]));
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    const variableValues: Record<string, string> = {};
    Object.entries(variables).forEach(([id, state]) => {
      variableValues[id] = state.value;
    });

    onSubmit({
      templateId: template.id,
      variables: variableValues,
      enabledOptionals,
      estimatedTokens,
    });
  }, [template.id, variables, enabledOptionals, estimatedTokens, onSubmit]);

  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { id: 'overview', label: 'Overview' },
      { id: 'accounts', label: 'Accounts' },
      { id: 'variables', label: 'Credentials' },
      { id: 'confirm', label: 'Confirm' },
    ];

    const currentIndex = steps.findIndex((s) => s.id === currentStep);

    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => {
                // Allow going back to previous steps
                if (index <= currentIndex) {
                  setCurrentStep(step.id as typeof currentStep);
                }
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                step.id === currentStep
                  ? 'bg-purple-500 text-white'
                  : index < currentIndex
                    ? 'bg-green-500/20 text-green-400 cursor-pointer hover:bg-green-500/30'
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
              {step.label}
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-600 mx-1" />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Render overview step
  const renderOverviewStep = () => (
    <div className="space-y-6">
      {/* Template Info */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{template.icon}</div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-white">{template.name}</h3>
            <p className="text-gray-400 mt-1">{template.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-2 py-1 rounded-full text-xs ${
                template.difficulty === 'beginner' ? 'bg-green-500/20 text-green-400' :
                template.difficulty === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {template.difficulty}
              </span>
              <span className="px-2 py-1 bg-gray-700 rounded-full text-xs text-gray-300">
                {template.estimatedBuildTime}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* What's Included */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <h4 className="font-medium text-white mb-4">Features Included</h4>
        <div className="grid grid-cols-2 gap-2">
          {template.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Optional Features */}
      {template.requirements.optional.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h4 className="font-medium text-white mb-4">Optional Features</h4>
          <div className="space-y-3">
            {template.requirements.optional.map((optional) => (
              <label
                key={optional.id}
                className="flex items-start gap-3 p-3 bg-gray-700/30 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={enabledOptionals.includes(optional.id)}
                  onChange={() => toggleOptional(optional.id)}
                  className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{optional.name}</span>
                    <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                      +{optional.additionalTokens} tokens
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{optional.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Token Estimate */}
      <div className={`border rounded-xl p-6 ${
        hasEnoughTokens
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-red-500/10 border-red-500/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Coins className={`w-6 h-6 ${hasEnoughTokens ? 'text-green-400' : 'text-red-400'}`} />
            <div>
              <p className="font-medium text-white">Estimated Token Usage</p>
              <p className="text-sm text-gray-400">
                {template.estimatedTokens.minimum} - {template.estimatedTokens.maximum} tokens
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-white">{estimatedTokens}</p>
            <p className={`text-sm ${hasEnoughTokens ? 'text-green-400' : 'text-red-400'}`}>
              Balance: {userTokenBalance} tokens
            </p>
          </div>
        </div>
        {!hasEnoughTokens && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>You need {estimatedTokens - userTokenBalance} more tokens</span>
            <button className="ml-auto px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors">
              Buy Tokens
            </button>
          </div>
        )}
      </div>

      {/* Continue Button */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep('accounts')}
          disabled={!hasEnoughTokens}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Render accounts step
  const renderAccountsStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white">Set Up Required Accounts</h3>
        <p className="text-gray-400 mt-1">
          Create these accounts before continuing. Check each one when done.
        </p>
      </div>

      {requiredAccounts.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>No additional accounts required!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requiredAccounts.map((account) => (
            <div
              key={account.id}
              className={`border rounded-xl p-5 transition-colors ${
                completedAccounts.has(account.id)
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-gray-800/50 border-gray-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{account.name}</h4>
                    {account.freeAvailable && (
                      <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
                        Free tier available
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{account.description}</p>

                  {/* Instructions */}
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-300">Setup instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-400">
                      {account.instructions.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ol>
                  </div>

                  {/* What you need */}
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-300">What you&apos;ll need:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {account.whatYouNeed.map((item, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-gray-700/50 rounded text-xs text-gray-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 ml-4">
                  <a
                    href={account.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    Open {account.provider}
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => markAccountComplete(account.id)}
                    className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                      completedAccounts.has(account.id)
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                    }`}
                  >
                    {completedAccounts.has(account.id) ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Mark as Done
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep('overview')}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep('variables')}
          disabled={!allAccountsComplete && requiredAccounts.length > 0}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Render variables step
  const renderVariablesStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white">Enter Your Credentials</h3>
        <p className="text-gray-400 mt-1">
          Enter the API keys and credentials from the accounts you set up
        </p>
      </div>

      {/* Security Notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
        <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-blue-400 font-medium">Your credentials are secure</p>
          <p className="text-blue-300/70 mt-1">
            Sensitive data is encrypted and only used during the build process.
            We never store your credentials in plain text.
          </p>
        </div>
      </div>

      {requiredVariables.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400" />
          <p>No credentials required!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requiredVariables.map((variable) => {
            const state = variables[variable.id] || {
              value: '',
              isValid: true,
              isTouched: false,
              showPassword: false,
            };
            const isPassword = variable.type === 'password' || variable.sensitive;

            return (
              <div key={variable.id} className="space-y-2">
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {variable.name}
                    {variable.required && <span className="text-red-400 ml-1">*</span>}
                  </span>
                  {variable.relatedAccount && (
                    <span className="text-xs text-gray-500">
                      From {variable.relatedAccount}
                    </span>
                  )}
                </label>

                <div className="relative">
                  <input
                    type={isPassword && !state.showPassword ? 'password' : 'text'}
                    value={state.value}
                    onChange={(e) => handleVariableChange(variable.id, e.target.value)}
                    placeholder={variable.placeholder}
                    className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors ${
                      state.isTouched && !state.isValid && variable.required
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-gray-700 focus:ring-purple-500'
                    } ${isPassword ? 'pr-12' : ''}`}
                  />
                  {isPassword && (
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(variable.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
                    >
                      {state.showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-500">{variable.description}</p>

                {state.isTouched && !state.isValid && variable.required && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    This field is required
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep('accounts')}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setCurrentStep('confirm')}
          disabled={!allVariablesValid}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
        >
          Review & Confirm
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Render confirm step
  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white">Ready to Build!</h3>
        <p className="text-gray-400 mt-1">
          Review your configuration and start the build
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-4">
        <h4 className="font-medium text-white">Build Summary</h4>

        {/* Template */}
        <div className="flex items-center justify-between py-2 border-b border-gray-700">
          <span className="text-gray-400">Template</span>
          <span className="text-white flex items-center gap-2">
            <span>{template.icon}</span>
            {template.name}
          </span>
        </div>

        {/* Features */}
        <div className="py-2 border-b border-gray-700">
          <span className="text-gray-400">Features</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {enabledOptionals.map((id) => {
              const optional = template.requirements.optional.find((o) => o.id === id);
              return optional ? (
                <span
                  key={id}
                  className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs"
                >
                  {optional.name}
                </span>
              ) : null;
            })}
            {enabledOptionals.length === 0 && (
              <span className="text-sm text-gray-500">Base features only</span>
            )}
          </div>
        </div>

        {/* Accounts */}
        <div className="py-2 border-b border-gray-700">
          <span className="text-gray-400">Accounts Configured</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {requiredAccounts.map((account) => (
              <span
                key={account.id}
                className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {account.name}
              </span>
            ))}
          </div>
        </div>

        {/* Credentials */}
        <div className="py-2 border-b border-gray-700">
          <span className="text-gray-400">Credentials Provided</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {requiredVariables.map((variable) => (
              <span
                key={variable.id}
                className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {variable.name}
              </span>
            ))}
          </div>
        </div>

        {/* Token Cost */}
        <div className="flex items-center justify-between py-2">
          <span className="text-gray-400">Token Cost</span>
          <div className="text-right">
            <span className="text-xl font-bold text-white">{estimatedTokens} tokens</span>
            <p className="text-sm text-gray-500">
              Remaining after: {userTokenBalance - estimatedTokens} tokens
            </p>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
          <Info className="w-5 h-5 text-purple-400" />
          What Happens Next
        </h4>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
          <li>Your credentials are securely encrypted and stored</li>
          <li>The build process starts automatically (Seed → Radiance)</li>
          <li>Databases and services are configured for you</li>
          <li>You can customize the UI/UX when complete</li>
          <li>Your workspace is ready to use!</li>
        </ol>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <button
          onClick={() => setCurrentStep('variables')}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-8 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:from-gray-700 disabled:to-gray-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/25"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting Build...
            </>
          ) : (
            <>
              🌱 Plant the Seed
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
      {renderStepIndicator()}

      {currentStep === 'overview' && renderOverviewStep()}
      {currentStep === 'accounts' && renderAccountsStep()}
      {currentStep === 'variables' && renderVariablesStep()}
      {currentStep === 'confirm' && renderConfirmStep()}
    </div>
  );
}
