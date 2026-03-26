import axios from 'axios';
import { describe, expect, it } from 'vitest';

import { getErrorMessage, handleApiError } from './client';

describe('client error helpers', () => {
  it('prefers API error detail from axios responses', () => {
    const error = {
      response: {
        data: {
          detail: 'Backend validation failed',
        },
      },
      message: 'Request failed',
      isAxiosError: true,
    };

    expect(getErrorMessage(error)).toBe('Backend validation failed');
  });

  it('falls back to the generic error message for non-axios errors', () => {
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
    expect(getErrorMessage('unexpected')).toBe('An unknown error occurred');
  });

  it('throws a normalized Error instance', () => {
    const axiosError = new axios.AxiosError('Timed out');

    expect(() => handleApiError(axiosError)).toThrow('Timed out');
  });
});
