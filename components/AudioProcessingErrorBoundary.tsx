'use client';

import React, { ReactNode, Component } from 'react';
import { logger } from '@/lib/logger';

// ===== ERROR TYPES =====
export enum AudioErrorType {
  CONTEXT_CREATION_FAILED = 'CONTEXT_CREATION_FAILED',
  SPECTRAL_ANALYSIS_FAILED = 'SPECTRAL_ANALYSIS_FAILED',
  ML_INFERENCE_FAILED = 'ML_INFERENCE_FAILED',
  DEVICE_NOT_SUPPORTED = 'DEVICE_NOT_SUPPORTED',
  AUTOPLAY_BLOCKED = 'AUTOPLAY_BLOCKED',
  RESOURCE_CLEANUP_FAILED = 'RESOURCE_CLEANUP_FAILED'
}

export interface AudioError extends Error {
  type: AudioErrorType;
  recoverable: boolean;
}

// ===== FALLBACK UI COMPONENTS =====
const AudioFallbackUI = ({ 
  error, 
  onReset, 
  onRetry 
}: { 
  error: AudioError | null; 
  onReset: () => void;
  onRetry: () => void;
}) => {
  const getErrorMessage = () => {
    if (!error) return 'Unknown audio processing error';
    
    switch (error.type) {
      case AudioErrorType.CONTEXT_CREATION_FAILED:
        return 'Unable to initialize audio system. Please check your browser permissions.';
      case AudioErrorType.DEVICE_NOT_SUPPORTED:
        return 'Your browser does not support required audio features. Please update your browser.';
      case AudioErrorType.AUTOPLAY_BLOCKED:
        return 'Autoplay blocked. Please interact with the page to enable audio.';
      case AudioErrorType.ML_INFERENCE_FAILED:
        return 'Audio analysis failed. Please try a different audio file.';
      default:
        return error.message || 'Audio processing error occurred';
    }
  };

  const getRecoveryOptions = () => {
    if (!error) return ['reset'];
    
    switch (error.type) {
      case AudioErrorType.CONTEXT_CREATION_FAILED:
      case AudioErrorType.DEVICE_NOT_SUPPORTED:
        return ['reload'];
      case AudioErrorType.AUTOPLAY_BLOCKED:
        return ['retry', 'reset'];
      default:
        return ['retry', 'reset'];
    }
  };

  const options = getRecoveryOptions();

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 text-white p-4">
      <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-red-500/20">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Error Icon */}
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>

          {/* Error Message */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Audio Processing Error</h2>
            <p className="text-sm text-gray-400">{getErrorMessage()}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            {options.includes('retry') && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                Retry
              </button>
            )}
            
            {options.includes('reset') && (
              <button
                onClick={onReset}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                Reset App
              </button>
            )}

            {options.includes('reload') && (
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                  />
                </svg>
                Reload Page
              </button>
            )}
          </div>

          {/* Technical Details (dev only) */}
          {process.env.NODE_ENV === 'development' && error?.stack && (
            <details className="mt-4 text-xs text-left text-gray-500">
              <summary className="cursor-pointer">Technical Details</summary>
              <pre className="mt-2 p-2 bg-slate-900 rounded overflow-auto max-h-32">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== ERROR BOUNDARY WITH ASYNC SUPPORT =====
interface Props {
  children: ReactNode;
  onError?: (error: AudioError) => void;
  onRecover?: () => void;
}

interface State {
  hasError: boolean;
  error: AudioError | null;
  retryCount: number;
}

export class AudioProcessingErrorBoundary extends Component<Props, State> {
  private mounted = true;
  private resetKey = 0;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      retryCount: 0 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Convert to AudioError with type
    const audioError = error as AudioError;
    return { 
      hasError: true, 
      error: audioError,
      retryCount: 0 
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Audio Processing Error Boundary caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    // Notify external error handler
    this.props.onError?.(error as AudioError);
  }

  componentWillUnmount() {
    this.mounted = false;
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  // Reset with key to force remount children
  reset = () => {
    this.resetKey++;
    this.setState({ 
      hasError: false, 
      error: null,
      retryCount: 0 
    });
    this.props.onRecover?.();
  };

  // Retry with exponential backoff
  retry = async () => {
    const { retryCount } = this.state;
    
    if (retryCount >= 3) {
      logger.warn('Max retry attempts reached, resetting instead');
      this.reset();
      return;
    }

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    
    this.setState(prev => ({ 
      retryCount: prev.retryCount + 1 
    }));

    await new Promise(resolve => setTimeout(resolve, delay));
    
    if (this.mounted) {
      this.reset();
    }
  };

  // Global error handler for unhandled rejections
  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const error = event.reason;
    
    if (error?.message?.includes('audio') || error?.message?.includes('AudioContext') || error?.message?.includes('spectral')) {
      event.preventDefault();
      
      this.setState({
        hasError: true,
        error: {
          ...error,
          type: AudioErrorType.CONTEXT_CREATION_FAILED,
          recoverable: true
        } as AudioError
      });
    }
  };

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  render() {
    if (this.state.hasError) {
      return (
        <AudioFallbackUI
          key={this.resetKey}
          error={this.state.error}
          onReset={this.reset}
          onRetry={this.retry}
        />
      );
    }

    return this.props.children;
  }
}

// ===== HELPER: Audio context wrapper với error boundary =====
export const withAudioErrorBoundary = (Component: React.ComponentType) => {
  const WrappedComponent = (props: any) => (
    <AudioProcessingErrorBoundary>
      <Component {...props} />
    </AudioProcessingErrorBoundary>
  );
  WrappedComponent.displayName = `withAudioErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return WrappedComponent;
};

// ===== HELPER: Safe audio operation =====
export async function safeAudioOperation<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    logger.error(`Audio operation failed (${context}):`, error);
    
    // Classify error
    const audioError: AudioError = {
      ...error,
      type: error.name === 'NotAllowedError' 
        ? AudioErrorType.AUTOPLAY_BLOCKED
        : error.message?.includes('spectral')
          ? AudioErrorType.SPECTRAL_ANALYSIS_FAILED
          : error.message?.includes('ML')
            ? AudioErrorType.ML_INFERENCE_FAILED
            : AudioErrorType.CONTEXT_CREATION_FAILED,
      recoverable: error.name !== 'NotSupportedError'
    };
    
    throw audioError;
  }
}
