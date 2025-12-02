'use client';

/**
 * Image Editor Component
 *
 * Canvas-based image editor with:
 * - Background removal (make transparent)
 * - Color replacement
 * - Crop & resize
 * - Brightness/contrast adjustments
 * - Export to PNG with transparency
 *
 * @since 2025-12-02
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Eraser,
  Pipette,
  Crop,
  Sun,
  Contrast,
  Undo,
  Redo,
  Download,
  Save,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Palette,
  Trash2,
  Wand2,
} from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  imageName: string;
  onSave: (imageData: string, editAction: string) => Promise<void>;
  onClose: () => void;
}

type Tool = 'select' | 'eraser' | 'colorPicker' | 'colorReplace' | 'crop' | 'magicWand';

interface EditState {
  imageData: ImageData | null;
  tool: Tool;
  brushSize: number;
  tolerance: number;
  brightness: number;
  contrast: number;
  selectedColor: string | null;
  replaceColor: string;
}

export function ImageEditor({ imageUrl, imageName, onSave, onClose }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);

  const [editState, setEditState] = useState<EditState>({
    imageData: null,
    tool: 'select',
    brushSize: 20,
    tolerance: 30,
    brightness: 100,
    contrast: 100,
    selectedColor: null,
    replaceColor: '#ffffff',
  });

  // Load image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setEditState(prev => ({ ...prev, imageData }));
      setHistory([imageData]);
      setHistoryIndex(0);
      setLoading(false);
    };
    img.onerror = () => {
      console.error('Failed to load image');
      setLoading(false);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Save to history
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex], 0, 0);
    setHistoryIndex(newIndex);
  }, [history, historyIndex]);

  // Get pixel color at position
  const getPixelColor = useCallback((x: number, y: number): [number, number, number, number] | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    return [pixel[0], pixel[1], pixel[2], pixel[3]];
  }, []);

  // Erase at position (make transparent)
  const eraseAt = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const radius = editState.brushSize / 2;

    // Create circular eraser
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [editState.brushSize]);

  // Magic wand - flood fill to transparent
  const magicWandAt = useCallback((startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];

    const tolerance = editState.tolerance;

    const matchesTarget = (idx: number) => {
      return (
        Math.abs(data[idx] - targetR) <= tolerance &&
        Math.abs(data[idx + 1] - targetG) <= tolerance &&
        Math.abs(data[idx + 2] - targetB) <= tolerance &&
        data[idx + 3] > 0 // Not already transparent
      );
    };

    const visited = new Set<number>();
    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = (y * width + x) * 4;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited.has(idx)) continue;

      visited.add(idx);

      if (!matchesTarget(idx)) continue;

      // Make transparent
      data[idx + 3] = 0;

      // Add neighbors
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  }, [editState.tolerance]);

  // Replace color
  const replaceColorAt = useCallback((startX: number, startY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const startIdx = (startY * width + startX) * 4;
    const targetR = data[startIdx];
    const targetG = data[startIdx + 1];
    const targetB = data[startIdx + 2];

    // Parse replace color
    const hex = editState.replaceColor.replace('#', '');
    const newR = parseInt(hex.substring(0, 2), 16);
    const newG = parseInt(hex.substring(2, 4), 16);
    const newB = parseInt(hex.substring(4, 6), 16);

    const tolerance = editState.tolerance;

    for (let i = 0; i < data.length; i += 4) {
      if (
        Math.abs(data[i] - targetR) <= tolerance &&
        Math.abs(data[i + 1] - targetG) <= tolerance &&
        Math.abs(data[i + 2] - targetB) <= tolerance
      ) {
        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [editState.tolerance, editState.replaceColor]);

  // Apply brightness/contrast
  const applyFilters = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !history[0]) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Start from original
    ctx.putImageData(history[0], 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const brightness = (editState.brightness - 100) * 2.55;
    const contrast = editState.contrast / 100;
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness
      let r = data[i] + brightness;
      let g = data[i + 1] + brightness;
      let b = data[i + 2] + brightness;

      // Apply contrast
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;

      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imageData, 0, 0);
  }, [editState.brightness, editState.contrast, history]);

  // Remove background (simple algorithm based on edge detection)
  const removeBackground = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Get corner colors (likely background)
    const corners = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ];

    const bgColors: number[][] = [];
    for (const [x, y] of corners) {
      const idx = (y * width + x) * 4;
      bgColors.push([data[idx], data[idx + 1], data[idx + 2]]);
    }

    // Average background color
    const avgBg = [
      Math.round(bgColors.reduce((s, c) => s + c[0], 0) / 4),
      Math.round(bgColors.reduce((s, c) => s + c[1], 0) / 4),
      Math.round(bgColors.reduce((s, c) => s + c[2], 0) / 4),
    ];

    const tolerance = editState.tolerance;

    for (let i = 0; i < data.length; i += 4) {
      const diff =
        Math.abs(data[i] - avgBg[0]) +
        Math.abs(data[i + 1] - avgBg[1]) +
        Math.abs(data[i + 2] - avgBg[2]);

      if (diff < tolerance * 3) {
        data[i + 3] = 0; // Make transparent
      }
    }

    ctx.putImageData(imageData, 0, 0);
    saveToHistory();
  }, [editState.tolerance, saveToHistory]);

  // Mouse handlers
  const getCanvasCoords = useCallback((e: React.MouseEvent): [number, number] => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0];

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return [
      Math.floor((e.clientX - rect.left) * scaleX),
      Math.floor((e.clientY - rect.top) * scaleY),
    ];
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const [x, y] = getCanvasCoords(e);

    if (editState.tool === 'eraser') {
      setIsDrawing(true);
      eraseAt(x, y);
    } else if (editState.tool === 'colorPicker') {
      const color = getPixelColor(x, y);
      if (color) {
        const hex = `#${color[0].toString(16).padStart(2, '0')}${color[1].toString(16).padStart(2, '0')}${color[2].toString(16).padStart(2, '0')}`;
        setEditState(prev => ({ ...prev, selectedColor: hex }));
      }
    } else if (editState.tool === 'magicWand') {
      magicWandAt(x, y);
      saveToHistory();
    } else if (editState.tool === 'colorReplace') {
      replaceColorAt(x, y);
      saveToHistory();
    }
  }, [editState.tool, getCanvasCoords, eraseAt, getPixelColor, magicWandAt, replaceColorAt, saveToHistory]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing) return;

    const [x, y] = getCanvasCoords(e);

    if (editState.tool === 'eraser') {
      eraseAt(x, y);
    }
  }, [isDrawing, editState.tool, getCanvasCoords, eraseAt]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      saveToHistory();
    }
  }, [isDrawing, saveToHistory]);

  // Export as PNG
  const exportImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${imageName.replace(/\.[^.]+$/, '')}_edited.png`;
    link.href = dataUrl;
    link.click();
  }, [imageName]);

  // Save to server
  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      await onSave(dataUrl, 'edited');
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
        <div className="text-white">Loading image...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-medium">Editing: {imageName}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportImage}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 rounded text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-14 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-2 gap-1">
          <ToolButton
            icon={<Eraser />}
            active={editState.tool === 'eraser'}
            onClick={() => setEditState(prev => ({ ...prev, tool: 'eraser' }))}
            title="Eraser (make transparent)"
          />
          <ToolButton
            icon={<Wand2 />}
            active={editState.tool === 'magicWand'}
            onClick={() => setEditState(prev => ({ ...prev, tool: 'magicWand' }))}
            title="Magic Wand (select similar)"
          />
          <ToolButton
            icon={<Pipette />}
            active={editState.tool === 'colorPicker'}
            onClick={() => setEditState(prev => ({ ...prev, tool: 'colorPicker' }))}
            title="Color Picker"
          />
          <ToolButton
            icon={<Palette />}
            active={editState.tool === 'colorReplace'}
            onClick={() => setEditState(prev => ({ ...prev, tool: 'colorReplace' }))}
            title="Replace Color"
          />

          <div className="w-8 h-px bg-gray-700 my-2" />

          <ToolButton icon={<Undo />} onClick={undo} title="Undo" disabled={historyIndex <= 0} />
          <ToolButton icon={<Redo />} onClick={redo} title="Redo" disabled={historyIndex >= history.length - 1} />

          <div className="w-8 h-px bg-gray-700 my-2" />

          <ToolButton icon={<ZoomIn />} onClick={() => setZoom(z => Math.min(z + 0.25, 4))} title="Zoom In" />
          <ToolButton icon={<ZoomOut />} onClick={() => setZoom(z => Math.max(z - 0.25, 0.25))} title="Zoom Out" />
          <ToolButton icon={<RotateCcw />} onClick={() => setZoom(1)} title="Reset Zoom" />

          <div className="w-8 h-px bg-gray-700 my-2" />

          <ToolButton icon={<Trash2 />} onClick={removeBackground} title="Auto Remove Background" />
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#1a1a2e] flex items-center justify-center"
          style={{
            backgroundImage: 'linear-gradient(45deg, #2a2a3e 25%, transparent 25%), linear-gradient(-45deg, #2a2a3e 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a3e 75%), linear-gradient(-45deg, transparent 75%, #2a2a3e 75%)',
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center',
              cursor: editState.tool === 'eraser' ? 'crosshair' : editState.tool === 'colorPicker' ? 'crosshair' : 'default',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="max-w-full"
          />
        </div>

        {/* Settings Panel */}
        <div className="w-64 bg-gray-900 border-l border-gray-800 p-4 space-y-4 overflow-y-auto">
          {/* Tool Settings */}
          {(editState.tool === 'eraser' || editState.tool === 'magicWand') && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Brush Size</label>
              <input
                type="range"
                min="5"
                max="100"
                value={editState.brushSize}
                onChange={e => setEditState(prev => ({ ...prev, brushSize: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">{editState.brushSize}px</div>
            </div>
          )}

          {(editState.tool === 'magicWand' || editState.tool === 'colorReplace') && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Tolerance</label>
              <input
                type="range"
                min="0"
                max="100"
                value={editState.tolerance}
                onChange={e => setEditState(prev => ({ ...prev, tolerance: parseInt(e.target.value) }))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">{editState.tolerance}</div>
            </div>
          )}

          {editState.tool === 'colorReplace' && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Replace With</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editState.replaceColor}
                  onChange={e => setEditState(prev => ({ ...prev, replaceColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={editState.replaceColor}
                  onChange={e => setEditState(prev => ({ ...prev, replaceColor: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white"
                />
              </div>
            </div>
          )}

          {editState.selectedColor && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">Selected Color</label>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded border border-gray-600"
                  style={{ backgroundColor: editState.selectedColor }}
                />
                <span className="text-sm text-white">{editState.selectedColor}</span>
              </div>
            </div>
          )}

          {/* Adjustments */}
          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4" />
              Adjustments
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Brightness</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={editState.brightness}
                  onChange={e => setEditState(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{editState.brightness}%</div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Contrast</label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={editState.contrast}
                  onChange={e => setEditState(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500">{editState.contrast}%</div>
              </div>

              <button
                onClick={applyFilters}
                className="w-full px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm"
              >
                Apply Adjustments
              </button>
            </div>
          </div>

          {/* Zoom */}
          <div className="pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-400">Zoom: {Math.round(zoom * 100)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  active,
  onClick,
  title,
  disabled,
}: {
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        active
          ? 'bg-purple-600 text-white'
          : disabled
          ? 'text-gray-600 cursor-not-allowed'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {icon}
    </button>
  );
}

export default ImageEditor;
