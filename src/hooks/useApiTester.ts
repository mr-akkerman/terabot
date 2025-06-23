'use client';

import { useState } from 'react';
import { testApiSource } from '@/utils/api';
import type { ApiUserBase } from '@/types';

type ApiSource = Pick<ApiUserBase, 'apiUrl' | 'apiMethod' | 'apiHeaders'>;

interface UseApiTester {
  isLoading: boolean;
  result: {
    status: 'success' | 'error';
    message: string;
  } | null;
  testSource: (source: ApiSource) => Promise<void>;
  reset: () => void;
}

export function useApiTester(): UseApiTester {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<UseApiTester['result']>(null);

  const testSource = async (source: ApiSource) => {
    setIsLoading(true);
    setResult(null);

    const response = await testApiSource(source);

    if (response.success) {
      setResult({
        status: 'success',
        message: `Successfully fetched ${response.userCount} users.`,
      });
    } else {
      setResult({
        status: 'error',
        message: response.error,
      });
    }

    setIsLoading(false);
  };
  
  const reset = () => {
    setResult(null);
  }

  return { isLoading, result, testSource, reset };
} 