import type {
  IndicatorConfig as IndicatorRequestConfig,
  IndicatorResult,
  SupportedIndicator,
} from '@/lib/api/technical-analysis';

const SERIES_COLORS = ['#2196F3', '#FF5722', '#4CAF50', '#9C27B0', '#FF9800', '#00BCD4', '#E91E63', '#795548'];

export interface ChartReferenceLine {
  value: number;
  color: string;
}

export interface IndicatorSeriesConfig {
  id: string;
  selectionId: string;
  name: string;
  data: Array<{ timestamp: string; value: number }>;
  color: string;
}

export interface OscillatorSeriesConfig extends IndicatorSeriesConfig {
  referenceLines?: ChartReferenceLine[];
}

export interface IndicatorPresetOption {
  id: string;
  name: string;
  displayName: string;
  label: string;
  params: Record<string, unknown>;
  pane: 'overlay' | 'oscillator' | 'other';
  defaultSelected: boolean;
  color: string;
}

interface IndicatorDefinition {
  id: string;
  name: string;
  params: Record<string, unknown>;
  label: string;
  color?: string;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortObject((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

export function serializeIndicatorKey(name: string, params: Record<string, unknown> = {}): string {
  return `${name}:${JSON.stringify(sortObject(params))}`;
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatIndicatorLabel(name: string, params: Record<string, unknown>): string {
  if (typeof params.timeperiod === 'number') {
    return `${name} ${params.timeperiod}`;
  }

  const values = Object.values(params);
  if (values.length === 0) {
    return name;
  }

  return `${name} (${values.join(', ')})`;
}

function getPane(indicator: SupportedIndicator): 'overlay' | 'oscillator' | 'other' {
  if (indicator.chart?.pane) {
    return indicator.chart.pane;
  }
  return indicator.group === 'Overlap Studies' ? 'overlay' : 'oscillator';
}

function buildDefaultParams(indicator: SupportedIndicator): Record<string, unknown> | null {
  const preset = indicator.chart?.default_params_presets?.[0];
  if (preset) {
    return preset;
  }

  const params = (indicator.parameters ?? []).reduce<Record<string, unknown>>((acc, parameter) => {
    const name = typeof parameter.name === 'string' ? parameter.name : null;
    if (!name || parameter.default === undefined) {
      return acc;
    }
    acc[name] = parameter.default;
    return acc;
  }, {});

  if (
    (indicator.parameters ?? []).some(
      (parameter) => typeof parameter.name !== 'string' || parameter.default === undefined
    )
  ) {
    return null;
  }

  return params;
}

export function buildIndicatorPresetOptions(supportedIndicators: SupportedIndicator[]): IndicatorPresetOption[] {
  return supportedIndicators.flatMap((indicator, index) => {
    const params = buildDefaultParams(indicator);
    if (!params) {
      return [];
    }

    return [
      {
        id: serializeIndicatorKey(indicator.name, params),
        name: indicator.name,
        displayName: indicator.display_name,
        label: formatIndicatorLabel(indicator.display_name || indicator.name, params),
        params,
        pane: getPane(indicator),
        defaultSelected: Boolean(indicator.chart?.default_enabled),
        color: SERIES_COLORS[index % SERIES_COLORS.length],
      },
    ];
  });
}

export function buildDefaultIndicatorRequests(supportedIndicators: SupportedIndicator[]): IndicatorRequestConfig[] {
  return buildIndicatorPresetOptions(supportedIndicators)
    .filter(({ defaultSelected }) => defaultSelected)
    .map(({ name, params }) => ({ name, params }));
}

function buildCatalogMap(supportedIndicators: SupportedIndicator[]): Record<string, SupportedIndicator> {
  return Object.fromEntries(supportedIndicators.map((indicator) => [indicator.name, indicator]));
}

function matchDefinition(definitions: IndicatorDefinition[], result: IndicatorResult): IndicatorDefinition | undefined {
  const key = serializeIndicatorKey(result.name, result.params ?? {});
  return definitions.find((definition) => definition.id === key);
}

export function buildChartSeries(
  results: IndicatorResult[],
  supportedIndicators: SupportedIndicator[],
  definitions: IndicatorDefinition[],
  startDate?: string
): { overlays: IndicatorSeriesConfig[]; oscillators: OscillatorSeriesConfig[] } {
  const overlays: IndicatorSeriesConfig[] = [];
  const oscillators: OscillatorSeriesConfig[] = [];
  const catalog = buildCatalogMap(supportedIndicators);
  let colorIndex = 0;

  for (const result of results) {
    const indicator = catalog[result.name];
    const pane = indicator ? getPane(indicator) : 'oscillator';
    const definition = matchDefinition(definitions, result);
    const outputLabels = indicator?.chart?.output_labels ?? {};
    const outputEntries = Object.entries(result.outputs).map(([outputName, values]) => [
      outputName,
      startDate ? values.filter((value) => value.timestamp >= startDate) : values,
    ]) as Array<[string, Array<{ timestamp: string; value: number }>]>;

    for (const [outputName, values] of outputEntries) {
      const baseColor = definition?.color ?? SERIES_COLORS[colorIndex % SERIES_COLORS.length];
      const label =
        outputEntries.length > 1
          ? `${definition?.label ?? result.name} (${outputLabels[outputName] ?? titleCase(outputName)})`
          : (definition?.label ?? result.name);
      const selectionId = definition?.id ?? serializeIndicatorKey(result.name, result.params ?? {});
      const series = {
        id: `${selectionId}:${outputName}`,
        selectionId,
        name: label,
        data: values,
        color: baseColor,
      };

      if (pane === 'overlay') {
        overlays.push(series);
      } else {
        // 'oscillator' and 'other' both render as sub-pane charts
        oscillators.push({
          ...series,
          referenceLines: outputEntries.length === 1 ? indicator?.chart?.reference_lines : undefined,
        });
      }

      colorIndex += 1;
    }
  }

  return { overlays, oscillators };
}

export function buildStrategyIndicatorDefinitions(
  strategyIndicators: Array<{ alias: string; indicator: string; params?: Record<string, unknown> }>
): IndicatorDefinition[] {
  return strategyIndicators.map((indicator, index) => ({
    id: serializeIndicatorKey(indicator.indicator, indicator.params ?? {}),
    name: indicator.indicator,
    params: indicator.params ?? {},
    label: indicator.alias,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
  }));
}
