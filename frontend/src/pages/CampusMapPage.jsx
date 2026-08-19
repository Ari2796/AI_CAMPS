import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Search, Navigation, Layers, Compass, ZoomIn, ZoomOut, RotateCcw, 
  MapPin, X, ArrowRightLeft, Clock, Footprints, ChevronDown, 
  Info, Sparkles, Building, GraduationCap, Utensils, Trophy, Home, Cpu,
  Phone, ArrowRight, ExternalLink
} from 'lucide-react';
import { 
  MAP_DIMENSIONS, CATEGORIES, SEARCH_INDEX, DETAILS_MAP, 
  DETAILED_TAGS, OVERVIEW_TAGS 
} from '../data/campus_map_full_dataset';
import { CAMPUS_PLACES } from '../data/campus_map_data';
import { findShortestRoadRoute, PLACE_NODE_MAP } from '../data/campus_road_navigator';
import CampusRoutesSvg from '../components/CampusRoutesSvg';

const CampusMapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Map state
  const [activeLayer, setActiveLayer] = useState('dark'); // 'dark' | 'light' | 'sat'
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [activeFloorTab, setActiveFloorTab] = useState(0);

  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [fromPlaceId, setFromPlaceId] = useState('main-gate');
  const [toPlaceId, setToPlaceId] = useState('');
  const [activeRouteSegments, setActiveRouteSegments] = useState([]);
  const [routeDistance, setRouteDistance] = useState(0);

  // Pan & Zoom state
  const [scale, setScale] = useState(0.85);
  const [position, setPosition] = useState({ x: -200, y: -250 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);

  // Read URL query params on mount (e.g. /map?to=placement-cell or /map?from=main-gate&to=pearl)
  useEffect(() => {
    const toParam = searchParams.get('to');
    const fromParam = searchParams.get('from');

    if (toParam) {
      const match = SEARCH_INDEX.find(s => s.id === toParam || s.match.toLowerCase() === toParam.toLowerCase())
        || CAMPUS_PLACES.find(p => p.id === toParam);
      
      if (match) {
        selectSearchResult(match);
        if (fromParam) {
          setIsNavigating(true);
          setFromPlaceId(fromParam);
          setToPlaceId(match.id);
        }
      }
    }
  }, [searchParams]);

  // Real-time Search Autocomplete Filter (Matching exact GeoBITs room/lab behavior)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const results = SEARCH_INDEX.filter(item => 
      item.match.toLowerCase().includes(q) || 
      item.name.toLowerCase().includes(q) ||
      item.floor.toLowerCase().includes(q)
    ).slice(0, 12);
    setSearchResults(results);
  }, [searchQuery]);

  // Center map on specific (x, y) coordinates with smooth transition
  const centerOnCoordinates = useCallback((targetX, targetY, targetScale = null) => {
    if (!containerRef.current) return;
    const currentScale = targetScale || scale;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    const newX = (containerWidth / 2) - (targetX * currentScale);
    const newY = (containerHeight / 2) - (targetY * currentScale);

    if (targetScale) setScale(targetScale);
    setPosition({ x: newX, y: newY });
  }, [scale]);

  // Double-Click to Move Map to Clicked Viewport Point
  const handleDoubleClick = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickClientX = e.clientX - rect.left;
    const clickClientY = e.clientY - rect.top;

    // Convert screen click point to map canvas coordinates
    const mapX = (clickClientX - position.x) / scale;
    const mapY = (clickClientY - position.y) / scale;

    // Smoothly center on clicked map coordinate and zoom in slightly
    const targetScale = Math.min(scale * 1.35, 2.0);
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;

    setScale(Number(targetScale.toFixed(2)));
    setPosition({
      x: (containerWidth / 2) - (mapX * targetScale),
      y: (containerHeight / 2) - (mapY * targetScale)
    });
  };

  // Recalculate route using Official Vector Road Segments
  useEffect(() => {
    if (isNavigating && fromPlaceId && toPlaceId) {
      const result = findShortestRoadRoute(fromPlaceId, toPlaceId);
      setActiveRouteSegments(result.segments);
      setRouteDistance(result.distance);

      const startPlace = getPlaceCoordinates(fromPlaceId);
      const endPlace = getPlaceCoordinates(toPlaceId);

      if (startPlace && endPlace) {
        const midX = (startPlace.x + endPlace.x) / 2;
        const midY = (startPlace.y + endPlace.y) / 2;
        centerOnCoordinates(midX, midY, 0.9);
      }
    } else {
      setActiveRouteSegments([]);
      setRouteDistance(0);
    }
  }, [isNavigating, fromPlaceId, toPlaceId, centerOnCoordinates]);

  // Helper to resolve coordinates for any place ID
  const getPlaceCoordinates = (id) => {
    const known = CAMPUS_PLACES.find(p => p.id === id);
    if (known) return { x: known.x, y: known.y };

    const tagL4 = DETAILED_TAGS.find(t => t.id === id);
    if (tagL4) {
      return {
        x: Math.round(parseInt(tagL4.left, 10) / 1.5),
        y: Math.round(parseInt(tagL4.top, 10) / 1.5)
      };
    }

    const tagL3 = OVERVIEW_TAGS.find(t => t.id === id);
    if (tagL3) {
      return {
        x: parseInt(tagL3.left, 10),
        y: parseInt(tagL3.top, 10)
      };
    }

    // Default fallbacks for common sub-departments
    if (id.includes('ib') || id.includes('placement') || id.includes('training')) return { x: 775, y: 1490 };
    if (id.includes('sf') || id.includes('sunflower')) return { x: 1330, y: 1300 };
    if (id.includes('as')) return { x: 1050, y: 1490 };
    if (id.includes('mechanic')) return { x: 1390, y: 1413 };

    return { x: 1050, y: 1490 };
  };

  // Mouse Drag / Pan handlers
  const handleMouseDown = (e) => {
    if (e.target.closest('.interactive-overlay') || e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Handlers for Mobile Pan
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Zoom controls
  const handleZoom = (delta) => {
    setScale(prev => {
      const newScale = Math.min(Math.max(prev + delta, 0.4), 2.2);
      return Number(newScale.toFixed(2));
    });
  };

  const handleResetView = () => {
    setScale(0.85);
    setPosition({ x: -200, y: -250 });
    setSelectedPlace(null);
  };

  const selectSearchResult = (item) => {
    setSearchQuery(item.match);
    setIsSearchFocused(false);

    const details = DETAILS_MAP[item.id] || {};
    const coords = getPlaceCoordinates(item.id);

    const placeObj = {
      id: item.id,
      name: item.match || details.name || item.name,
      shortName: details.main || item.name,
      category: 'academic',
      x: coords.x,
      y: coords.y,
      description: `${item.match || details.name} located in Bannari Amman Institute of Technology (${item.floor || ''}).`,
      details: {
        head: '',
        floors: details.floors || []
      }
    };

    setSelectedPlace(placeObj);
    setActiveFloorTab(item.floorIdx || 0);
    centerOnCoordinates(coords.x, coords.y, 1.35);
  };

  const getCategoryIcon = (iconName) => {
    switch (iconName) {
      case 'GraduationCap': return <GraduationCap size={16} />;
      case 'Cpu': return <Cpu size={16} />;
      case 'Home': return <Home size={16} />;
      case 'Utensils': return <Utensils size={16} />;
      case 'Building': return <Building size={16} />;
      case 'Trophy': return <Trophy size={16} />;
      case 'MapPin': return <MapPin size={16} />;
      default: return <Sparkles size={16} />;
    }
  };

  const swapNavigation = () => {
    setFromPlaceId(toPlaceId);
    setToPlaceId(fromPlaceId);
  };

  const startNavigationTo = (place) => {
    setIsNavigating(true);
    setToPlaceId(place.id);
    if (!fromPlaceId || fromPlaceId === place.id) {
      setFromPlaceId('main-gate');
    }
  };

  const isZoomedIn = scale >= 1.05;
  const walkMinutes = Math.max(1, Math.round(routeDistance / 75));

  const startCoords = isNavigating ? getPlaceCoordinates(fromPlaceId) : null;
  const endCoords = isNavigating ? getPlaceCoordinates(toPlaceId) : null;

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] bg-slate-950 overflow-hidden select-none font-sans text-slate-100">
      
      {/* Top Floating Header & Search Bar */}
      <div className="absolute top-4 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* GeoBITs Brand & Live Search Dropdown */}
        <div className="pointer-events-auto relative w-full sm:w-80 md:w-96">
          <div className="flex items-center gap-2 bg-slate-900/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-700/70 rounded-2xl p-1.5 shadow-2xl transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
            <div className="pl-3 text-emerald-400">
              <Search size={18} />
            </div>
            <input 
              type="text"
              placeholder="Search classes, labs, placement cell, hostels..."
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs sm:text-sm text-slate-100 placeholder-slate-400 w-full py-1.5 px-2"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown matching exact GeoBITs screenshot format */}
          {isSearchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden max-h-80 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-zinc-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onMouseDown={() => selectSearchResult(item)}
                  className="p-3.5 hover:bg-emerald-50/80 dark:hover:bg-zinc-800/80 cursor-pointer transition-colors"
                >
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 leading-tight">
                    {item.match}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    {item.floor}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Action Controls: Layer Switcher & Nav Toggle */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Layer switcher */}
          <div className="flex items-center bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-2xl p-1 shadow-xl">
            <button
              onClick={() => setActiveLayer('dark')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeLayer === 'dark'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Dark
            </button>
            <button
              onClick={() => setActiveLayer('light')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeLayer === 'light'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => setActiveLayer('sat')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeLayer === 'sat'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Navigation Mode Button */}
          <button
            onClick={() => {
              setIsNavigating(!isNavigating);
              if (!isNavigating && selectedPlace) {
                setToPlaceId(selectedPlace.id);
              }
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl border transition-all cursor-pointer ${
              isNavigating
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-emerald-500/20'
                : 'bg-slate-900/90 text-emerald-400 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <Navigation size={15} />
            <span>{isNavigating ? 'Exit Nav' : 'Directions'}</span>
          </button>
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="absolute top-20 left-4 right-4 z-20 overflow-x-auto no-scrollbar pointer-events-auto flex items-center gap-2 pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id);
              setSearchQuery('');
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap backdrop-blur-md border transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30 font-semibold'
                : 'bg-slate-900/80 text-slate-300 border-slate-700/50 hover:bg-slate-800 hover:text-white'
            }`}
          >
            {getCategoryIcon(cat.icon)}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Navigation Directions Floating Bar */}
      {isNavigating && (
        <div className="absolute top-32 left-4 right-4 sm:left-6 sm:w-96 z-30 bg-slate-900/95 backdrop-blur-lg border border-emerald-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Navigation size={14} />
              <span>Campus Road Navigator</span>
            </div>
            <button 
              onClick={() => setIsNavigating(false)}
              className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          {/* From / To Dropdowns */}
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-12 text-slate-400 font-semibold">From:</span>
              <select
                value={fromPlaceId}
                onChange={(e) => setFromPlaceId(e.target.value)}
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 outline-none focus:border-emerald-500"
              >
                {CAMPUS_PLACES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center my-1">
              <button 
                onClick={swapNavigation}
                className="p-1 rounded-full bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
                title="Swap Start and Destination"
              >
                <ArrowRightLeft size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-12 text-slate-400 font-semibold">To:</span>
              <select
                value={toPlaceId}
                onChange={(e) => setToPlaceId(e.target.value)}
                className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-200 outline-none focus:border-emerald-500"
              >
                <option value="">-- Select Destination --</option>
                {CAMPUS_PLACES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Route Summary */}
          {activeRouteSegments.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs bg-slate-800/50 rounded-xl p-2.5 border border-slate-700/50">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Footprints size={14} />
                  <span>~{routeDistance} meters</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Clock size={14} />
                  <span>~{walkMinutes} min walk</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                Follow the illuminated green road paths directly from <strong>{CAMPUS_PLACES.find(p => p.id === fromPlaceId)?.shortName || fromPlaceId}</strong> to <strong>{CAMPUS_PLACES.find(p => p.id === toPlaceId)?.shortName || toPlaceId}</strong>.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Interactive Zoomable/Pannable Map Container */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className={`w-full h-full cursor-${isDragging ? 'grabbing' : 'grab'} bg-slate-950 overflow-hidden relative`}
      >
        <div 
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.18s ease-out',
            width: `${MAP_DIMENSIONS.width}px`,
            height: `${MAP_DIMENSIONS.height}px`
          }}
          className="relative"
        >
          {/* Layer 1: Background Vector Map (Dark or Light) or Satellite Image */}
          {activeLayer === 'dark' && (
            <img 
              src="/map/campus-dark.svg" 
              alt="BIT Campus Dark Map"
              className="absolute inset-0 w-full h-full pointer-events-none object-fill"
            />
          )}
          {activeLayer === 'light' && (
            <img 
              src="/map/campus-light.svg" 
              alt="BIT Campus Light Map"
              className="absolute inset-0 w-full h-full pointer-events-none object-fill bg-[#2a374b]"
            />
          )}
          {activeLayer === 'sat' && (
            <img 
              src="/map/campus-sat.webp" 
              alt="BIT Campus Satellite Aerial"
              className="absolute inset-0 w-full h-full pointer-events-none object-fill"
            />
          )}

          {/* Layer 2: Official Vector Road Network Layer (Lights up exact road paths!) */}
          <CampusRoutesSvg activeSegments={activeRouteSegments} />

          {/* Navigation Start & Destination Animated Pins */}
          {isNavigating && startCoords && (
            <div 
              style={{
                top: `${startCoords.y}px`,
                left: `${startCoords.x}px`,
                transform: 'translate(-50%, -100%)'
              }}
              className="absolute z-50 pointer-events-none animate-bounce"
            >
              <div className="flex flex-col items-center">
                <div className="px-2.5 py-1 rounded-xl bg-emerald-500 text-slate-950 text-[11px] font-bold shadow-2xl border border-white whitespace-nowrap">
                  START
                </div>
                <div className="w-3 h-3 bg-emerald-500 rotate-45 -mt-1 border-r border-b border-white" />
              </div>
            </div>
          )}

          {isNavigating && endCoords && (
            <div 
              style={{
                top: `${endCoords.y}px`,
                left: `${endCoords.x}px`,
                transform: 'translate(-50%, -100%)'
              }}
              className="absolute z-50 pointer-events-none animate-bounce"
            >
              <div className="flex flex-col items-center">
                <div className="px-2.5 py-1 rounded-xl bg-rose-500 text-white text-[11px] font-bold shadow-2xl border border-white whitespace-nowrap">
                  DESTINATION
                </div>
                <div className="w-3 h-3 bg-rose-500 rotate-45 -mt-1 border-r border-b border-white" />
              </div>
            </div>
          )}

          {/* Unified Clean Campus Tags Layer (Zoom-Responsive without green dots) */}
          {(isZoomedIn ? DETAILED_TAGS : OVERVIEW_TAGS).map((tag, idx) => {
            const rawLeft = parseInt(tag.left, 10);
            const rawTop = parseInt(tag.top, 10);
            const normalizedX = isZoomedIn ? Math.round(rawLeft / 1.5) : rawLeft;
            const normalizedY = isZoomedIn ? Math.round(rawTop / 1.5) : rawTop;

            const isSelected = selectedPlace?.id === tag.id;
            const isFrom = fromPlaceId === tag.id;
            const isTo = toPlaceId === tag.id;

            return (
              <div
                key={`tag-${isZoomedIn ? 'det' : 'ov'}-${idx}`}
                style={{
                  top: `${normalizedY}px`,
                  left: `${normalizedX}px`,
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const det = DETAILS_MAP[tag.id] || {};
                  setSelectedPlace({
                    id: tag.id,
                    name: det.name || tag.name,
                    shortName: det.main || tag.name,
                    category: 'academic',
                    x: normalizedX,
                    y: normalizedY,
                    description: `${det.name || tag.name} located in Bannari Amman Institute of Technology.`,
                    details: {
                      head: '',
                      floors: det.floors || []
                    }
                  });
                  setActiveFloorTab(0);
                  if (isNavigating && !toPlaceId) {
                    setToPlaceId(tag.id);
                  }
                }}
                className={`absolute z-20 cursor-pointer transition-all duration-200 ${
                  isSelected || isFrom || isTo ? 'scale-125 z-40' : 'hover:scale-110'
                }`}
              >
                <span 
                  className={`px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-medium transition-all shadow-md whitespace-nowrap ${
                    isFrom
                      ? 'bg-emerald-500 text-slate-950 font-bold ring-2 ring-emerald-300 shadow-emerald-500/50'
                      : isTo
                      ? 'bg-rose-500 text-white font-bold ring-2 ring-rose-300 shadow-rose-500/50'
                      : isSelected
                      ? 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400 shadow-emerald-500/50'
                      : 'text-white'
                  }`}
                  style={!isSelected && !isFrom && !isTo ? {
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(148, 163, 184, 0.35)',
                    textShadow: '0 1px 2px #000'
                  } : {}}
                >
                  {tag.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Bottom-Right Zoom & View Controls */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col items-center gap-2">
        <button
          onClick={() => handleZoom(0.25)}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 flex items-center justify-center shadow-xl transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => handleZoom(-0.25)}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 flex items-center justify-center shadow-xl transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
        <button
          onClick={handleResetView}
          className="w-10 h-10 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 flex items-center justify-center shadow-xl transition-all cursor-pointer"
          title="Reset View"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Helper double-click hint tooltip on initial load */}
      <div className="absolute bottom-6 left-6 z-20 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400">
        <span>💡 <strong>Tip:</strong> Double-click anywhere to center the map</span>
      </div>

      {/* Bottom Place Detail Slide-Over Card */}
      {selectedPlace && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200">
          
          {/* Card Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {selectedPlace.category || 'Location'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                {selectedPlace.name}
              </h3>
            </div>
            <button
              onClick={() => setSelectedPlace(null)}
              className="p-1 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Description & In-Charge */}
          <div className="py-3 space-y-2.5 text-xs text-slate-300">
            <p className="leading-relaxed text-slate-300">
              {selectedPlace.description}
            </p>
            {selectedPlace.details?.head && (
              <div className="flex items-center gap-2 bg-slate-800/50 p-2.5 rounded-xl border border-slate-700/40 text-emerald-300">
                <Info size={14} className="shrink-0 text-emerald-400" />
                <span className="text-[11px]">{selectedPlace.details.head}</span>
              </div>
            )}
          </div>

          {/* Floor Directory Tabs */}
          {selectedPlace.details?.floors && selectedPlace.details.floors.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Floor Directory:
              </div>
              {/* Floor selector chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {selectedPlace.details.floors.map((floor, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFloorTab(idx)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      activeFloorTab === idx
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {floor.name}
                  </button>
                ))}
              </div>
              {/* Floor Rooms list */}
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 max-h-28 overflow-y-auto space-y-1">
                {selectedPlace.details.floors[activeFloorTab]?.rooms?.map((room, rIdx) => (
                  <div key={rIdx} className="flex items-center gap-2 text-[11px] text-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    <span>{room}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 mt-2 border-t border-slate-800 flex items-center gap-2">
            <button
              onClick={() => startNavigationTo(selectedPlace)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <Navigation size={14} />
              <span>Directions Here</span>
            </button>
            <button
              onClick={() => {
                setIsNavigating(true);
                setFromPlaceId(selectedPlace.id);
                if (!toPlaceId || toPlaceId === selectedPlace.id) {
                  setToPlaceId('library');
                }
              }}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Navigate From Here"
            >
              From Here
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default CampusMapPage;
