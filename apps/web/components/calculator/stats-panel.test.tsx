import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StatsPanel } from './stats-panel';

/**
 * Mock the math-engine module
 */
vi.mock('@nextcalc/math-engine/stats', () => ({
  mean: (data: number[]) => data.reduce((a, b) => a + b, 0) / data.length,
  median: (data: number[]) => {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      const left = sorted[mid - 1];
      const right = sorted[mid];
      if (left === undefined || right === undefined) return 0;
      return (left + right) / 2;
    }
    return sorted[mid] ?? 0;
  },
  mode: (data: number[]) => {
    const frequencies = new Map<number, number>();
    let maxFreq = 0;
    for (const val of data) {
      const count = (frequencies.get(val) ?? 0) + 1;
      frequencies.set(val, count);
      maxFreq = Math.max(maxFreq, count);
    }
    if (maxFreq === 1) return [];
    return Array.from(frequencies.entries())
      .filter(([, freq]) => freq === maxFreq)
      .map(([val]) => val)
      .sort((a, b) => a - b);
  },
  variance: (data: number[], sample = true) => {
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const sumSq = data.reduce((sum, val) => sum + (val - avg) ** 2, 0);
    return sumSq / (sample ? data.length - 1 : data.length);
  },
  stdDev: (data: number[], sample = true) => {
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const sumSq = data.reduce((sum, val) => sum + (val - avg) ** 2, 0);
    const variance = sumSq / (sample ? data.length - 1 : data.length);
    return Math.sqrt(variance);
  },
  range: (data: number[]) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    return { min, max, range: max - min };
  },
  quartiles: (data: number[]) => {
    const sorted = [...data].sort((a, b) => a - b);
    const percentile = (arr: number[], p: number) => {
      const index = (arr.length - 1) * p;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      const lowerVal = arr[lower];
      const upperVal = arr[upper];
      if (lowerVal === undefined || upperVal === undefined) return 0;
      return lowerVal * (1 - weight) + upperVal * weight;
    };
    return {
      q1: percentile(sorted, 0.25),
      q2: percentile(sorted, 0.5),
      q3: percentile(sorted, 0.75),
      iqr: percentile(sorted, 0.75) - percentile(sorted, 0.25),
    };
  },
  linearRegression: (x: number[], y: number[]) => {
    const n = x.length;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      if (xi === undefined || yi === undefined) continue;
      num += (xi - xMean) * (yi - yMean);
      den += (xi - xMean) ** 2;
    }
    const slope = num / den;
    const intercept = yMean - slope * xMean;
    const yPred = x.map((xi) => slope * (xi ?? 0) + intercept);
    const tss = y.reduce((sum, yi) => sum + ((yi ?? 0) - yMean) ** 2, 0);
    const rss = y.reduce((sum, yi, i) => {
      const pred = yPred[i];
      if (pred === undefined || yi === undefined) return sum;
      return sum + (yi - pred) ** 2;
    }, 0);
    return { slope, intercept, r2: 1 - rss / tss };
  },
  polynomialRegression: () => ({
    coefficients: [1, 2, 3],
    r2: 0.95,
  }),
  exponentialRegression: () => ({
    a: 1,
    b: 0.5,
    r2: 0.92,
  }),
  correlation: (x: number[], y: number[]) => {
    const n = x.length;
    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      denX = 0,
      denY = 0;
    for (let i = 0; i < n; i++) {
      const xi = x[i];
      const yi = y[i];
      if (xi === undefined || yi === undefined) continue;
      num += (xi - xMean) * (yi - yMean);
      denX += (xi - xMean) ** 2;
      denY += (yi - yMean) ** 2;
    }
    return num / Math.sqrt(denX * denY);
  },
  predict: (regression: Record<string, number>, x: number) => {
    if ('slope' in regression) {
      return (regression['slope'] ?? 0) * x + (regression['intercept'] ?? 0);
    }
    return 0;
  },
}));

describe('StatsPanel', () => {
  // Clipboard mock is already set up in vitest.setup.ts

  describe('Rendering', () => {
    it('renders the component with title and description', async () => {
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Statistical Analysis')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Descriptive statistics and regression analysis for your data'),
      ).toBeInTheDocument();
    });

    it('shows loading state initially', () => {
      render(<StatsPanel />);
      expect(screen.getByText(/Loading statistics module/)).toBeInTheDocument();
    });

    it('renders input tabs', async () => {
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /manual entry/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('tab', { name: /paste data/i })).toBeInTheDocument();
    });

    it('renders example buttons', async () => {
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /normal/i })).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /bimodal/i })).toBeInTheDocument();
    });
  });

  describe('Data Input', () => {
    it('accepts manual comma-separated input', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5');

      expect(input).toHaveValue('1, 2, 3, 4, 5');
    });

    it('accepts paste data input', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /paste data/i })).toBeInTheDocument();
      });

      const pasteTab = screen.getByRole('tab', { name: /paste data/i });
      await user.click(pasteTab);

      const textarea = screen.getByPlaceholderText(/one value per line/i);
      await user.type(textarea, '1\n2\n3\n4\n5');

      expect(textarea).toHaveValue('1\n2\n3\n4\n5');
    });

    it('calculates statistics when button is clicked', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5');

      const calcButton = screen.getByRole('button', { name: /calculate statistics/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByText('Descriptive Statistics')).toBeInTheDocument();
      });
    });

    it('calculates statistics on Enter key press', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Descriptive Statistics')).toBeInTheDocument();
      });
    });

    it('shows data count after processing', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByText('5 values')).toBeInTheDocument();
      });
    });

    it('clears data when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByText('5 values')).toBeInTheDocument();
      });

      const clearButtons = screen.getAllByRole('button', { name: /clear/i });
      const clearButton = clearButtons[0];
      if (!clearButton) throw new Error('Clear button not found');
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByText('5 values')).not.toBeInTheDocument();
      });
    });
  });

  describe('Example Datasets', () => {
    it('loads normal distribution example', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /normal/i })).toBeInTheDocument();
      });

      const normalButton = screen.getByRole('button', { name: /normal/i });
      await user.click(normalButton);

      await waitFor(() => {
        expect(screen.getByText('15 values')).toBeInTheDocument();
      });
    });

    it('loads bimodal distribution example', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /bimodal/i })).toBeInTheDocument();
      });

      const bimodalButton = screen.getByRole('button', { name: /bimodal/i });
      await user.click(bimodalButton);

      await waitFor(() => {
        expect(screen.getByText('12 values')).toBeInTheDocument();
      });
    });

    it('loads linear relationship example for regression', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /linear example/i })).toBeInTheDocument();
      });

      const linearButton = screen.getByRole('button', { name: /linear example/i });
      await user.click(linearButton);

      await waitFor(() => {
        const xInput = screen.getByLabelText(/x values input/i);
        expect(xInput).toHaveValue();
      });
    });
  });

  describe('Descriptive Statistics', () => {
    it('displays all descriptive statistics', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByText('Mean')).toBeInTheDocument();
      });

      expect(screen.getByText('Median')).toBeInTheDocument();
      expect(screen.getByText('Mode')).toBeInTheDocument();
      expect(screen.getByText('Minimum')).toBeInTheDocument();
      expect(screen.getByText('Maximum')).toBeInTheDocument();
      expect(screen.getByText('Range')).toBeInTheDocument();
      expect(screen.getByText(/Q1 \(25th/)).toBeInTheDocument();
      expect(screen.getByText(/Q3 \(75th/)).toBeInTheDocument();
      expect(screen.getByText('IQR')).toBeInTheDocument();
    });

    it('toggles between sample and population statistics', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByText(/Std Dev \(sample\)/i)).toBeInTheDocument();
      });

      const toggle = screen.getByLabelText(/sample statistics/i);
      await user.click(toggle);

      await waitFor(() => {
        expect(screen.getByText(/Std Dev \(population\)/i)).toBeInTheDocument();
      });
    });

    it('displays box plot visualization', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        const boxPlotElements = screen.getAllByText('Box Plot Visualization');
        expect(boxPlotElements.length).toBeGreaterThan(0);
      });

      expect(screen.getByRole('img', { name: /box plot/i })).toBeInTheDocument();
    });

    it('copies individual statistics to clipboard', async () => {
      const user = userEvent.setup();
      // Setup clipboard spy for this test
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByLabelText(/copy mean/i)).toBeInTheDocument();
      });

      const copyButton = screen.getByLabelText(/copy mean/i);
      await user.click(copyButton);

      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalled();
      });
    });

    it('copies all statistics to clipboard', async () => {
      const user = userEvent.setup();
      // Setup clipboard spy for this test
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, '1, 2, 3, 4, 5{Enter}');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy all statistics/i })).toBeInTheDocument();
      });

      const copyAllButton = screen.getByRole('button', { name: /copy all statistics/i });
      await user.click(copyAllButton);

      expect(writeTextSpy).toHaveBeenCalled();
    });
  });

  describe('Regression Analysis', () => {
    it('accepts X and Y data inputs', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/x values input/i)).toBeInTheDocument();
      });

      const xInput = screen.getByLabelText(/x values input/i);
      const yInput = screen.getByLabelText(/y values input/i);

      await user.type(xInput, '1, 2, 3, 4, 5');
      await user.type(yInput, '2, 4, 6, 8, 10');

      expect(xInput).toHaveValue('1, 2, 3, 4, 5');
      expect(yInput).toHaveValue('2, 4, 6, 8, 10');
    });

    it('calculates linear regression', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/x values input/i)).toBeInTheDocument();
      });

      const xInput = screen.getByLabelText(/x values input/i);
      const yInput = screen.getByLabelText(/y values input/i);

      await user.type(xInput, '1, 2, 3, 4, 5');
      await user.type(yInput, '2, 4, 6, 8, 10');

      const calcButton = screen.getByRole('button', { name: /calculate regression/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByText('Regression Results')).toBeInTheDocument();
      });
    });

    it('shows R² quality indicator', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/x values input/i)).toBeInTheDocument();
      });

      const xInput = screen.getByLabelText(/x values input/i);
      const yInput = screen.getByLabelText(/y values input/i);

      await user.type(xInput, '1, 2, 3, 4, 5');
      await user.type(yInput, '2, 4, 6, 8, 10');

      const calcButton = screen.getByRole('button', { name: /calculate regression/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByText(/R² =/)).toBeInTheDocument();
      });
    });

    it('changes regression type', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/select regression type/i)).toBeInTheDocument();
      });

      const select = screen.getByLabelText(/select regression type/i);
      await user.click(select);

      const polynomialOption = screen.getByRole('option', { name: /polynomial/i });
      await user.click(polynomialOption);

      // Should show degree selector
      await waitFor(() => {
        expect(screen.getByLabelText(/select polynomial degree/i)).toBeInTheDocument();
      });
    });

    it('makes predictions from regression model', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/x values input/i)).toBeInTheDocument();
      });

      const xInput = screen.getByLabelText(/x values input/i);
      const yInput = screen.getByLabelText(/y values input/i);

      await user.type(xInput, '1, 2, 3, 4, 5');
      await user.type(yInput, '2, 4, 6, 8, 10');

      const calcButton = screen.getByRole('button', { name: /calculate regression/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/prediction x value/i)).toBeInTheDocument();
      });

      const predictionInput = screen.getByLabelText(/prediction x value/i);
      await user.type(predictionInput, '6');

      const predictButton = screen.getByRole('button', { name: /predict y/i });
      await user.click(predictButton);

      await waitFor(() => {
        expect(screen.getByText(/Predicted Y value/)).toBeInTheDocument();
      });
    });

    it('shows error for mismatched data lengths', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/x values input/i)).toBeInTheDocument();
      });

      const xInput = screen.getByLabelText(/x values input/i);
      const yInput = screen.getByLabelText(/y values input/i);

      await user.type(xInput, '1, 2, 3');
      await user.type(yInput, '2, 4, 6, 8, 10');

      const calcButton = screen.getByRole('button', { name: /calculate regression/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByText(/data length mismatch/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', async () => {
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByLabelText(/manual data entry/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/x values input/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/y values input/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select regression type/i)).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      // Tab should move focus to interactive elements
      await user.tab();

      // Verify focus moved away from body (something received focus)
      expect(document.activeElement).not.toBe(document.body);

      // Input should be reachable and typeable
      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.click(input);
      await user.type(input, '1, 2, 3, 4, 5');

      // Verify the input received the value
      expect(input).toHaveValue('1, 2, 3, 4, 5');
    });

    it('dismisses error with keyboard', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, 'invalid data');

      const calcButton = screen.getByRole('button', { name: /calculate statistics/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/dismiss error/i)).toBeInTheDocument();
      });

      const dismissButton = screen.getByLabelText(/dismiss error/i);
      await user.click(dismissButton);

      await waitFor(() => {
        expect(screen.queryByLabelText(/dismiss error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error for invalid data', async () => {
      const user = userEvent.setup();
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/comma or space-separated/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/comma or space-separated/i);
      await user.type(input, 'abc, def, ghi');

      const calcButton = screen.getByRole('button', { name: /calculate statistics/i });
      await user.click(calcButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid data/i)).toBeInTheDocument();
      });
    });

    it('shows error for empty input', async () => {
      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /calculate statistics/i })).toBeInTheDocument();
      });

      const calcButton = screen.getByRole('button', { name: /calculate statistics/i });
      expect(calcButton).toBeDisabled();
    });
  });

  describe('Responsive Design', () => {
    it('renders correctly on mobile viewport', async () => {
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Statistical Analysis')).toBeInTheDocument();
      });
    });

    it('renders correctly on tablet viewport', async () => {
      global.innerWidth = 768;
      global.dispatchEvent(new Event('resize'));

      render(<StatsPanel />);

      await waitFor(() => {
        expect(screen.getByText('Statistical Analysis')).toBeInTheDocument();
      });
    });
  });
});
