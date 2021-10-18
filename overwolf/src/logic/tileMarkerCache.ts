import { customMarkers } from '../Icons/MapIcons/customMarkers';
import { getIconName } from './icons';
import { getTileCacheKey } from './tileCache';
import { getTileCacheKeyFromWorldCoordinate } from './tiles';

export type MarkerCacheWindow = typeof window & {
    NWMM_MarkerCache: TileMarkerCache;
}

const markersUrl = 'https://www.newworld-map.com/markers.json';
type OnMarkersLoadedListener = () => void;

class TileMarkerCache {
    private static _instance: TileMarkerCache;
    private cache: ReadonlyMap<string, Marker[]> | undefined;
    private promise: Promise<ReadonlyMap<string, Marker[]>>;
    private onMarkersLoadedListeners = new Set<OnMarkersLoadedListener>();

    constructor() {
        this.promise = this.fillCache();
    }

    public static get isSupported() {
        return NWMM_APP_WINDOW === 'background';
    }

    public static get instance(): TileMarkerCache {
        if (!this.isSupported) {
            throw new Error('Using MarkerCache directly in this window is not supported. Use getMarkerCache instead.');
        }

        if (!TileMarkerCache._instance) {
            TileMarkerCache._instance = new TileMarkerCache();
        }

        return TileMarkerCache._instance;
    }

    public get isInitialized() {
        return this.cache !== undefined;
    }

    public get markerLoadPromise() {
        return this.promise;
    }

    public get = (tilePosition: Vector2) => {
        if (!this.cache) {
            return undefined;
        }

        const tileKey = getTileCacheKey(tilePosition);
        return this.cache.get(tileKey);
    }

    public registerOnMarkersLoaded = (listener: OnMarkersLoadedListener) => {
        this.onMarkersLoadedListeners.add(listener);
        return () => {
            this.onMarkersLoadedListeners.delete(listener);
        };
    }

    private fillCache = async () => {
        const tree = await this.getMarkerJson();

        const nextCache = new Map<string, Marker[]>();
        this.fillCacheWithTree(nextCache, tree);
        this.fillCacheWithTree(nextCache, customMarkers);

        this.cache = nextCache;
        this.onMarkersLoadedListeners.forEach(l => {
            l();
        });
        return nextCache as ReadonlyMap<string, Marker[]>;
    }

    private fillCacheWithTree(nextCache: Map<string, Marker[]>, tree: any) {
        for (const [category, catContent] of Object.entries(tree)) {
            if (category === 'areas') {
                continue;
            }

            for (const [type, typeContent] of Object.entries(catContent as any)) {
                for (const entryContent of Object.values(typeContent as any)) {
                    const pos = entryContent as Vector2;
                    const tileString = getTileCacheKeyFromWorldCoordinate(pos);

                    let markerList = nextCache.get(tileString);
                    if (!markerList) {
                        markerList = [];
                        nextCache.set(tileString, markerList);
                    }

                    let text;
                    if (category === 'monsters' && type === 'named') {
                        // Get the right name of named monsters
                        text = getIconName(category, (entryContent as { name: string }).name);
                    } else if (category === 'pois') {
                        // Get the right name of pois
                        text = getIconName(category, (entryContent as { name: string }).name);
                    } else {
                        text = getIconName(category, type);
                    }

                    const marker = {
                        category,
                        type,
                        pos,
                        text,
                    };
                    markerList.push(marker);
                }
            }
        }
    }

    private getMarkerJson = async () => {
        const req = await fetch(markersUrl, {
            method: 'get',
        });
        return await req.json();
    }
}

export function initializeTileMarkerCache() {
    if (TileMarkerCache.isSupported) {
        (window as MarkerCacheWindow).NWMM_MarkerCache = TileMarkerCache.instance;
    }
}

export function getTileMarkerCache() {
    return (overwolf.windows.getMainWindow() as MarkerCacheWindow).NWMM_MarkerCache;
}
