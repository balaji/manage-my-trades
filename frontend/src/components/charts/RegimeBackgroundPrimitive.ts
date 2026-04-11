import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { RegimeLabel } from '@/lib/api/technical-analysis';

export interface RegimeSegmentData {
  start: number; // UTC timestamp in seconds
  end: number;
  regime: RegimeLabel;
}

const REGIME_COLORS: Record<string, string> = {
  // Directional
  bullish: 'rgba(38, 166, 154, 0.10)',
  bearish: 'rgba(239, 83, 80, 0.10)',
  sideways: 'rgba(158, 158, 158, 0.07)',
  // Volatility
  low_vol: 'rgba(33, 150, 243, 0.08)',
  normal_vol: 'rgba(158, 158, 158, 0.07)',
  high_vol: 'rgba(255, 152, 0, 0.12)',
  // Combined
  bearish_high_vol: 'rgba(239, 83, 80, 0.18)',
  bearish_low_vol: 'rgba(239, 83, 80, 0.08)',
  bullish_low_vol: 'rgba(38, 166, 154, 0.08)',
  bullish_high_vol: 'rgba(38, 166, 154, 0.18)',
};

class RegimeRenderer implements IPrimitivePaneRenderer {
  private _segments: RegimeSegmentData[];
  private _chart: IChartApiBase<Time>;

  constructor(segments: RegimeSegmentData[], chart: IChartApiBase<Time>) {
    this._segments = segments;
    this._chart = chart;
  }

  draw(target: CanvasRenderingTarget2D): void {
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const timeScale = this._chart.timeScale();
      const ratio = scope.horizontalPixelRatio;
      const height = scope.bitmapSize.height;

      for (const segment of this._segments) {
        const x1 = timeScale.timeToCoordinate(segment.start as unknown as Time);
        const x2 = timeScale.timeToCoordinate(segment.end as unknown as Time);

        if (x1 === null || x2 === null) continue;

        const bitmapX1 = Math.round(x1 * ratio);
        const bitmapX2 = Math.round(x2 * ratio);

        ctx.fillStyle = REGIME_COLORS[segment.regime] ?? REGIME_COLORS.sideways;
        ctx.fillRect(bitmapX1, 0, bitmapX2 - bitmapX1, height);
      }
    });
  }
}

class RegimePaneView implements IPrimitivePaneView {
  private _segments: RegimeSegmentData[];
  private _chart: IChartApiBase<Time> | null;

  constructor(segments: RegimeSegmentData[], chart: IChartApiBase<Time> | null) {
    this._segments = segments;
    this._chart = chart;
  }

  zOrder(): PrimitivePaneViewZOrder {
    return 'bottom';
  }

  renderer(): IPrimitivePaneRenderer | null {
    if (!this._chart || this._segments.length === 0) return null;
    return new RegimeRenderer(this._segments, this._chart);
  }

  update(segments: RegimeSegmentData[], chart: IChartApiBase<Time> | null) {
    this._segments = segments;
    this._chart = chart;
  }
}

export class RegimeBackgroundPrimitive implements ISeriesPrimitive<Time> {
  private _segments: RegimeSegmentData[] = [];
  private _chart: IChartApiBase<Time> | null = null;
  private _requestUpdate: (() => void) | null = null;
  private _paneView: RegimePaneView;

  constructor() {
    this._paneView = new RegimePaneView([], null);
  }

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart;
    this._requestUpdate = param.requestUpdate;
    this._paneView.update(this._segments, this._chart);
  }

  detached(): void {
    this._chart = null;
    this._requestUpdate = null;
  }

  updateAllViews(): void {
    this._paneView.update(this._segments, this._chart);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }

  setSegments(segments: RegimeSegmentData[]): void {
    this._segments = segments;
    this._paneView.update(this._segments, this._chart);
    this._requestUpdate?.();
  }
}
