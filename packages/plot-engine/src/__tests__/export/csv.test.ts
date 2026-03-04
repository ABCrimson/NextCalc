import { describe, expect, it, vi, beforeEach } from 'vitest';
import { exportToCSV2D, exportToCSV3D, downloadAsCSV2D, downloadAsCSV3D } from '../../export/csv';
import type { Point2D, Point3D } from '../../types/index';

describe('exportToCSV2D', () => {
  const samplePoints: Point2D[] = [
    { x: 1, y: 2 },
    { x: 3, y: 4 },
    { x: 5.123456789, y: -6.987654321 },
  ];

  // ── Default options ───────────────────────────────────────────────

  it('should export with default options (comma delimiter, header, precision 6)', () => {
    const csv = exportToCSV2D(samplePoints);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('x,y');
    expect(lines[1]).toBe('1.000000,2.000000');
    expect(lines[2]).toBe('3.000000,4.000000');
    expect(lines[3]).toBe('5.123457,-6.987654');
  });

  it('should end each data line with a newline character', () => {
    const csv = exportToCSV2D([{ x: 1, y: 2 }]);
    expect(csv).toContain('1.000000,2.000000\n');
  });

  // ── Header ────────────────────────────────────────────────────────

  it('should include header by default', () => {
    const csv = exportToCSV2D(samplePoints);
    expect(csv.startsWith('x,y\n')).toBe(true);
  });

  it('should omit header when includeHeader is false', () => {
    const csv = exportToCSV2D(samplePoints, { includeHeader: false });
    expect(csv.startsWith('1.000000')).toBe(true);
  });

  // ── Delimiter ─────────────────────────────────────────────────────

  it('should use semicolon delimiter', () => {
    const csv = exportToCSV2D(samplePoints, { delimiter: ';' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('x;y');
    expect(lines[1]).toBe('1.000000;2.000000');
  });

  it('should use tab delimiter', () => {
    const csv = exportToCSV2D(samplePoints, { delimiter: '\t' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('x\ty');
    expect(lines[1]).toBe('1.000000\t2.000000');
  });

  // ── Precision ─────────────────────────────────────────────────────

  it('should respect custom precision', () => {
    const csv = exportToCSV2D([{ x: 1.23456789, y: 9.87654321 }], { precision: 2 });
    const lines = csv.split('\n');
    expect(lines[1]).toBe('1.23,9.88');
  });

  it('should handle precision of 0', () => {
    const csv = exportToCSV2D([{ x: 1.7, y: 2.3 }], { precision: 0 });
    const lines = csv.split('\n');
    expect(lines[1]).toBe('2,2');
  });

  // ── Empty input ───────────────────────────────────────────────────

  it('should return only header for empty point array', () => {
    const csv = exportToCSV2D([]);
    expect(csv).toBe('x,y\n');
  });

  it('should return empty string for empty array with no header', () => {
    const csv = exportToCSV2D([], { includeHeader: false });
    expect(csv).toBe('');
  });

  // ── Single point ──────────────────────────────────────────────────

  it('should handle a single point', () => {
    const csv = exportToCSV2D([{ x: 42, y: -7 }]);
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2); // header + 1 data line
    expect(lines[1]).toBe('42.000000,-7.000000');
  });

  // ── Negative and zero values ──────────────────────────────────────

  it('should format negative and zero values correctly', () => {
    const csv = exportToCSV2D([
      { x: 0, y: 0 },
      { x: -1, y: -2 },
    ]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('0.000000,0.000000');
    expect(lines[2]).toBe('-1.000000,-2.000000');
  });

  // ── Large dataset ─────────────────────────────────────────────────

  it('should handle large datasets', () => {
    const points: Point2D[] = Array.from({ length: 1000 }, (_, i) => ({
      x: i,
      y: Math.sin(i),
    }));
    const csv = exportToCSV2D(points);
    const lines = csv.split('\n').filter(Boolean);
    expect(lines).toHaveLength(1001); // header + 1000 data
  });
});

describe('exportToCSV3D', () => {
  const samplePoints: Point3D[] = [
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 },
  ];

  it('should export 3D points with default options', () => {
    const csv = exportToCSV3D(samplePoints);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('x,y,z');
    expect(lines[1]).toBe('1.000000,2.000000,3.000000');
    expect(lines[2]).toBe('4.000000,5.000000,6.000000');
  });

  it('should include z column in header', () => {
    const csv = exportToCSV3D(samplePoints);
    expect(csv.startsWith('x,y,z\n')).toBe(true);
  });

  it('should omit header when includeHeader is false', () => {
    const csv = exportToCSV3D(samplePoints, { includeHeader: false });
    expect(csv.startsWith('1.000000')).toBe(true);
  });

  it('should use custom delimiter for 3D', () => {
    const csv = exportToCSV3D(samplePoints, { delimiter: '|' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe('x|y|z');
    expect(lines[1]).toBe('1.000000|2.000000|3.000000');
  });

  it('should respect custom precision for 3D', () => {
    const csv = exportToCSV3D([{ x: 1.111, y: 2.222, z: 3.333 }], { precision: 1 });
    const lines = csv.split('\n');
    expect(lines[1]).toBe('1.1,2.2,3.3');
  });

  it('should return only header for empty 3D array', () => {
    const csv = exportToCSV3D([]);
    expect(csv).toBe('x,y,z\n');
  });
});

describe('downloadAsCSV2D', () => {
  let mockLink: {
    download: string;
    href: string;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
      remove: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((child) => child);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('should trigger a download with correct filename', () => {
    downloadAsCSV2D([{ x: 1, y: 2 }], 'data.csv');

    expect(mockLink.download).toBe('data.csv');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.remove).toHaveBeenCalled();
  });

  it('should append .csv if not present', () => {
    downloadAsCSV2D([{ x: 1, y: 2 }], 'data');
    expect(mockLink.download).toBe('data.csv');
  });

  it('should not double-append .csv extension', () => {
    downloadAsCSV2D([{ x: 1, y: 2 }], 'export.csv');
    expect(mockLink.download).toBe('export.csv');
  });

  it('should create a Blob and revoke the object URL', () => {
    downloadAsCSV2D([{ x: 1, y: 2 }], 'test');
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

describe('downloadAsCSV3D', () => {
  let mockLink: {
    download: string;
    href: string;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLink = {
      download: '',
      href: '',
      click: vi.fn(),
      remove: vi.fn(),
    };

    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation((child) => child);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-3d-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  it('should trigger a download for 3D data', () => {
    downloadAsCSV3D([{ x: 1, y: 2, z: 3 }], 'surface.csv');

    expect(mockLink.download).toBe('surface.csv');
    expect(mockLink.click).toHaveBeenCalled();
    expect(mockLink.remove).toHaveBeenCalled();
  });

  it('should append .csv if not present for 3D', () => {
    downloadAsCSV3D([{ x: 1, y: 2, z: 3 }], 'surface');
    expect(mockLink.download).toBe('surface.csv');
  });
});
