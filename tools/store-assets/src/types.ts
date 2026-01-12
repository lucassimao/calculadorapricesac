export type StoreKey = 'appstore' | 'play';

export interface SlotConfig {
  id: number;
  key: string;
  keywords?: string[];
}

export interface StoreConfig {
  width: number;
  height: number;
  format: 'png' | 'jpg' | 'jpeg';
  baseWidth?: number;
  baseHeight?: number;
  aspectRatio?: string;
}

export interface LayoutConfig {
  textTopPct: number;
  textSidePct: number;
  textMaxWidthPct: number;
  textBackdropHeightPct: number;
  screenshotWidthPct: number;
  screenshotTopPct: number;
  screenshotBottomPct: number;
}

export interface DefaultsConfig {
  copyDir: string;
  screenshotDir: string;
  guideDir: string;
  maskDir: string;
  framePathApp: string;
  framePathPlay: string;
  outputDir: string;
  baseWidth: number;
  baseHeight: number;
}

export interface ModelsConfig {
  image: string;
  imageSize: string;
  aspectRatio: string;
}

export interface Config {
  locales: string[];
  devices: string[];
  slots: SlotConfig[];
  stores: Record<StoreKey, StoreConfig>;
  banners: Record<StoreKey, StoreConfig>;
  icons: Record<StoreKey, StoreConfig>;
  layout: LayoutConfig;
  defaults: DefaultsConfig;
  models: ModelsConfig;
}

export interface CopyEntry {
  headline: string;
  subhead: string;
}

export type CopyFile = Record<string, CopyEntry>;

export interface ImageRequest {
  prompt: string;
  screenshotPath?: string;
  guidePath?: string;
  maskPath?: string;
  framePath?: string;
  useFrame: boolean;
}
